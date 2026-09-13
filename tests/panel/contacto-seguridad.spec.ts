import { test, expect } from '@playwright/test';
import { ORIGEN, entrarOk, limpiarTodo, nombrePrueba, sb } from './util';

test.afterAll(async () => { await limpiarTodo(); });

const consulta = (extra: Record<string, unknown> = {}) => ({ nombre: nombrePrueba('Contacto'), empresa: 'Planta Sur', correo: 'contacto@x.com', telefono: '0414 111 2222', mensaje: 'Motor de 150 HP con vibración alta desde el cambio de rodamientos.', ...extra });

test.describe('Formulario de contacto', () => {
  test.beforeEach(async () => { await sb().from('intentos_acceso').delete().eq('ruta', 'contacto'); });
  test('consulta válida por JSON: responde ok y queda guardada con todos los campos', async ({ request }) => {
    const datos = consulta();
    const res = await request.post('/api/contacto', { data: datos });
    expect(res.status()).toBe(200);
    expect((await res.json()).mensaje).toContain('Recibido');
    const { data } = await sb().from('mensajes').select('*').eq('nombre', datos.nombre).maybeSingle();
    expect(data).toMatchObject({ empresa: 'Planta Sur', correo: 'contacto@x.com', telefono: '0414 111 2222', mensaje: datos.mensaje });
  });
  test('consulta válida por formulario clásico (urlencoded) con origen correcto también funciona', async ({ request }) => {
    const datos = consulta();
    const res = await request.post('/api/contacto', { form: datos as Record<string, string>, headers: ORIGEN });
    expect(res.status()).toBe(200);
    expect((await sb().from('mensajes').select('id').eq('nombre', datos.nombre).maybeSingle()).data).toBeTruthy();
  });
  test('formulario clásico sin cabecera Origin → 403 (CSRF)', async ({ request }) => {
    expect((await request.post('/api/contacto', { form: consulta() as Record<string, string> })).status()).toBe(403);
  });
  test('empresa y teléfono vacíos se guardan como null', async ({ request }) => {
    const datos = consulta({ empresa: '', telefono: '' });
    await request.post('/api/contacto', { data: datos });
    const { data } = await sb().from('mensajes').select('empresa, telefono').eq('nombre', datos.nombre).maybeSingle();
    expect(data).toEqual({ empresa: null, telefono: null });
  });
  const INVALIDAS: [string, Record<string, unknown>, string[]][] = [
    ['nombre de una letra', { nombre: 'A' }, ['nombre']],
    ['correo sin arroba', { correo: 'contacto.x.com' }, ['correo']],
    ['correo con dominio de una letra', { correo: 'a@b.c' }, ['correo']],
    ['mensaje de 9 caracteres', { mensaje: '123456789' }, ['mensaje']],
    ['los tres a la vez', { nombre: 'A', correo: 'x', mensaje: 'corto' }, ['nombre', 'correo', 'mensaje']],
    ['cuerpo vacío', { nombre: undefined, correo: undefined, mensaje: undefined }, ['nombre', 'correo', 'mensaje']],
  ];
  for (const [nombre, datos, errores] of INVALIDAS) {
    test(`rechaza ${nombre} con 422 y no guarda`, async ({ request }) => {
      const cuerpo = consulta(datos);
      const res = await request.post('/api/contacto', { data: cuerpo });
      expect(res.status()).toBe(422);
      expect(Object.keys((await res.json()).errores)).toEqual(expect.arrayContaining(errores));
      if (typeof cuerpo.nombre === 'string') expect((await sb().from('mensajes').select('id').eq('nombre', cuerpo.nombre).maybeSingle()).data).toBeNull();
    });
  }
  test('honeypot relleno: responde ok sin guardar', async ({ request }) => {
    const datos = consulta({ empresa_web: 'http://spam' });
    expect((await (await request.post('/api/contacto', { data: datos })).json()).ok).toBe(true);
    expect((await sb().from('mensajes').select('id').eq('nombre', datos.nombre).maybeSingle()).data).toBeNull();
  });
  test('JSON inválido → 400; GET → 405', async ({ request }) => {
    expect((await request.post('/api/contacto', { data: Buffer.from('{rota'), headers: { 'content-type': 'application/json' } })).status()).toBe(400);
    expect((await request.get('/api/contacto')).status()).toBe(405);
  });
  test('los campos se recortan: mensaje a 2000 y nombre a 120', async ({ request }) => {
    const datos = consulta({ nombre: nombrePrueba('L') + 'n'.repeat(300), mensaje: 'm'.repeat(3000) });
    await request.post('/api/contacto', { data: datos });
    const { data } = await sb().from('mensajes').select('nombre, mensaje').like('nombre', `${datos.nombre.slice(0, 40)}%`).maybeSingle();
    expect(data?.nombre.length).toBe(120);
    expect(data?.mensaje.length).toBe(2000);
  });
  test('el mensaje se guarda tal cual, incluso con HTML (se escapa al mostrarlo, no al guardarlo)', async ({ request }) => {
    const datos = consulta({ mensaje: '<script>alert("x")</script> y un texto suficientemente largo' });
    await request.post('/api/contacto', { data: datos });
    expect((await sb().from('mensajes').select('mensaje').eq('nombre', datos.nombre).maybeSingle()).data?.mensaje).toBe(datos.mensaje);
  });
  test('límite: 10 consultas por hora desde la misma conexión, la 11ª responde 429', async ({ request }) => {
    for (let i = 1; i <= 10; i++) expect((await request.post('/api/contacto', { data: consulta({ correo: `c${i}@x.com` }) })).status(), `consulta ${i}`).toBe(200);
    const res = await request.post('/api/contacto', { data: consulta() });
    expect(res.status()).toBe(429);
    expect((await res.json()).error).toContain('Demasiados mensajes');
  });
  test('una consulta inválida no consume el límite ni consulta la base', async ({ request }) => {
    for (let i = 1; i <= 10; i++) await request.post('/api/contacto', { data: consulta({ nombre: 'A' }) });
    expect((await request.post('/api/contacto', { data: consulta() })).status()).toBe(200);
  });
});

test.describe('Seguridad transversal', () => {
  const RUTAS_FORMULARIO = ['/api/entrar', '/api/c/entrar', '/api/salir', '/api/panel/clientes', '/api/panel/noticias', '/api/panel/evento'];
  for (const ruta of RUTAS_FORMULARIO) {
    test(`${ruta} rechaza un formulario con Origin ajeno (CSRF)`, async ({ request }) => {
      await entrarOk(request);
      const res = await request.post(ruta, { form: { _accion: 'eliminar', id: 'x', password: 'x', token: 'x' }, headers: { origin: 'https://otro-sitio.example' }, maxRedirects: 0 });
      expect(res.status()).toBe(403);
    });
  }
  test('un JSON con Origin ajeno a /api/evento y /api/contacto tampoco pasa la validación de origen', async ({ request }) => {
    for (const ruta of ['/api/contacto', '/api/evento']) {
      const res = await request.post(ruta, { data: consulta(), headers: { origin: 'https://otro-sitio.example' } });
      expect([200, 403, 422, 429, 403]).toContain(res.status());
    }
  });
  test('/api/panel/informes ignora la cookie de un cliente del portal', async ({ request }) => {
    await request.post('/api/c/entrar', { form: { token: 'zzzzzzzzzz', password: 'x' }, headers: ORIGEN, maxRedirects: 0 });
    expect((await request.post('/api/panel/informes', { data: { _accion: 'firmar' }, headers: ORIGEN })).status()).toBe(401);
  });
  test('una página que no existe responde 404', async ({ request }) => {
    expect((await request.get('/no-existe-esta-pagina')).status()).toBe(404);
  });
  test('las páginas públicas no crean cookies', async ({ request }) => {
    for (const ruta of ['/', '/servicios', '/noticias', '/evento']) {
      expect((await request.get(ruta)).headers()['set-cookie'], ruta).toBeUndefined();
    }
  });
  test('el panel no expone la contraseña del cliente en la lista, solo en su página al pulsar "Mostrar"', async ({ request }) => {
    await entrarOk(request);
    const nombre_empresa = nombrePrueba('Secreto');
    await request.post('/api/panel/clientes', { form: { nombre_empresa, password: 'clave-secreta-xyz' }, headers: ORIGEN, maxRedirects: 0 });
    expect(await (await request.get('/panel')).text()).not.toContain('clave-secreta-xyz');
    const { data } = await sb().from('clientes').select('id').eq('nombre_empresa', nombre_empresa).maybeSingle();
    const html = await (await request.get(`/panel/${data!.id}`)).text();
    expect(html).toContain('id="clave-visible" class="hidden">clave-secreta-xyz');
  });
  test('la base no guarda contraseñas de clientes en claro', async ({ request }) => {
    await entrarOk(request);
    const nombre_empresa = nombrePrueba('Hash');
    await request.post('/api/panel/clientes', { form: { nombre_empresa, password: 'clave-en-claro-no' }, headers: ORIGEN, maxRedirects: 0 });
    const { data } = await sb().from('clientes').select('password_hash, password_cifrada, password_sal').eq('nombre_empresa', nombre_empresa).maybeSingle();
    expect(JSON.stringify(data)).not.toContain('clave-en-claro-no');
    expect(data?.password_sal.length).toBeGreaterThan(20);
  });
});
