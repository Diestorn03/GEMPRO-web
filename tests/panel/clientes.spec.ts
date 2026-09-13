import { test, expect } from '@playwright/test';
import { ENV, ORIGEN, PNG_1PX, JPEG_1PX, PDF_MINIMO, archivo, crearCliente, destino, entrarOk, entrarPagina, formulario, limpiarTodo, nombrePrueba, sb } from './util';

test.beforeEach(async ({ request }) => { await entrarOk(request); });
test.afterAll(async () => { await limpiarTodo(); });

const UUID_AJENO = '11111111-2222-4333-8444-555555555555';

test.describe('Crear acceso de cliente', () => {
  test('mínimo (empresa + contraseña): token de 10 caracteres, hash scrypt y contraseña cifrada', async ({ request }) => {
    const c = await crearCliente(request, { contacto: '' });
    expect(c.token).toMatch(/^[a-z0-9]{10}$/);
    expect(c.password_hash.startsWith('scrypt$')).toBe(true);
    expect(c.password_cifrada).toMatch(/^[0-9a-f]+\.[0-9a-f]+\.[0-9a-f]+$/);
    expect(c.contacto).toBeNull();
    expect(c.logo_url).toBeNull();
  });
  test('completo: contacto, cargo, correo y logo PNG accesible por URL pública', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'Ana Pérez', contacto_cargo: 'Jefa de mantenimiento', contacto_correo: 'ana@empresa.com' }, archivo('logo.png', 'image/png', PNG_1PX));
    expect(c.contacto).toBe('Ana Pérez');
    expect(c.contacto_cargo).toBe('Jefa de mantenimiento');
    expect(c.contacto_correo).toBe('ana@empresa.com');
    expect(c.logo_url).toContain(`/clientes-logos/${c.id}/`);
    expect(c.logo_url).toMatch(/\.png$/);
    const img = await request.get(c.logo_url!);
    expect(img.status()).toBe(200);
    expect(img.headers()['content-type']).toContain('image/png');
  });
  for (const [tipo, mime, ext, buffer] of [['JPEG', 'image/jpeg', 'jpg', JPEG_1PX], ['SVG', 'image/svg+xml', 'svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')], ['WebP declarado', 'image/webp', 'webp', PNG_1PX]] as const) {
    test(`logo ${tipo} se guarda con extensión .${ext}`, async ({ request }) => {
      const c = await crearCliente(request, {}, archivo(`logo.${ext}`, mime, buffer as Buffer));
      expect(c.logo_url).toMatch(new RegExp(`\\.${ext}$`));
    });
  }
  test('logo que no es imagen (PDF): el cliente se crea, el logo se rechaza con error=logo', async ({ request }) => {
    const nombre_empresa = nombrePrueba('Cliente');
    const res = await formulario(request, '/api/panel/clientes', { nombre_empresa, password: 'clave-de-prueba-123' }, { logo: archivo('doc.pdf', 'application/pdf', PDF_MINIMO) });
    expect(destino(res)).toBe('/panel?nuevo=1&error=logo');
    const { data } = await sb().from('clientes').select('logo_url').eq('nombre_empresa', nombre_empresa).maybeSingle();
    expect(data?.logo_url).toBeNull();
  });
  test('logo de más de 2 MB se rechaza aunque diga ser PNG', async ({ request }) => {
    const grande = Buffer.concat([PNG_1PX, Buffer.alloc(2 * 1024 * 1024 + 1)]);
    const res = await formulario(request, '/api/panel/clientes', { nombre_empresa: nombrePrueba('Cliente'), password: 'clave-de-prueba-123' }, { logo: archivo('grande.png', 'image/png', grande) });
    expect(destino(res)).toBe('/panel?nuevo=1&error=logo');
  });
  const INVALIDOS: [string, Record<string, string>, string][] = [
    ['sin nombre de empresa', { nombre_empresa: '', password: 'clave-de-prueba-123' }, '/panel?error=1'],
    ['nombre solo espacios', { nombre_empresa: '   ', password: 'clave-de-prueba-123' }, '/panel?error=1'],
    ['contraseña de 7 caracteres', { nombre_empresa: 'PRUEBA-x', password: '1234567' }, '/panel?error=1'],
    ['sin contraseña', { nombre_empresa: 'PRUEBA-x' }, '/panel?error=1'],
    ['correo sin arroba', { nombre_empresa: 'PRUEBA-x', password: 'clave-de-prueba-123', contacto_correo: 'ana.empresa.com' }, '/panel?error=correo'],
    ['correo sin dominio', { nombre_empresa: 'PRUEBA-x', password: 'clave-de-prueba-123', contacto_correo: 'ana@' }, '/panel?error=correo'],
    ['correo con espacios', { nombre_empresa: 'PRUEBA-x', password: 'clave-de-prueba-123', contacto_correo: 'ana perez@empresa.com' }, '/panel?error=correo'],
  ];
  for (const [nombre, campos, esperado] of INVALIDOS) {
    test(`rechaza ${nombre}`, async ({ request }) => {
      expect(destino(await formulario(request, '/api/panel/clientes', campos))).toBe(esperado);
    });
  }
  test('contraseña de exactamente 8 caracteres se acepta', async ({ request }) => {
    const c = await crearCliente(request, { password: '12345678' });
    expect(c.id).toBeTruthy();
  });
  test('correo en mayúsculas se acepta y se guarda tal cual', async ({ request }) => {
    const c = await crearCliente(request, { contacto_correo: 'Gerencia@Empresa.COM' });
    expect(c.contacto_correo).toBe('Gerencia@Empresa.COM');
  });
  test('nombre de 300 caracteres se recorta a 120', async ({ request }) => {
    const largo = nombrePrueba('L') + 'x'.repeat(300);
    const res = await formulario(request, '/api/panel/clientes', { nombre_empresa: largo, password: 'clave-de-prueba-123' });
    expect(destino(res)).toBe('/panel?nuevo=1');
    const { data } = await sb().from('clientes').select('nombre_empresa').eq('nombre_empresa', largo.slice(0, 120)).maybeSingle();
    expect(data?.nombre_empresa.length).toBe(120);
  });
  test('dos clientes con el mismo nombre conviven con tokens distintos', async ({ request }) => {
    const nombre = nombrePrueba('Repetido');
    const res1 = await formulario(request, '/api/panel/clientes', { nombre_empresa: nombre, password: 'clave-de-prueba-123' });
    const res2 = await formulario(request, '/api/panel/clientes', { nombre_empresa: nombre, password: 'clave-de-prueba-123' });
    expect(destino(res1)).toBe('/panel?nuevo=1');
    expect(destino(res2)).toBe('/panel?nuevo=1');
    const { data } = await sb().from('clientes').select('token').eq('nombre_empresa', nombre);
    expect(data?.length).toBe(2);
    expect(data![0].token).not.toBe(data![1].token);
  });
  test('un nombre con HTML se guarda tal cual y el navegador lo muestra como texto, sin crear etiquetas', async ({ request, page }) => {
    const nombre = `${nombrePrueba('X')} <img src=x onerror=alert(1)>`;
    await formulario(request, '/api/panel/clientes', { nombre_empresa: nombre, password: 'clave-de-prueba-123' });
    const html = await (await request.get('/panel')).text();
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;'); // en el texto visible va escapado
    await entrarPagina(page);
    await expect(page.locator('img[src="x"]')).toHaveCount(0); // ninguna etiqueta nació del nombre
    await expect(page.locator('.fila-cliente', { hasText: '<img src=x onerror=alert(1)>' })).toHaveCount(1); // y se lee tal cual
  });
  test('la lista del panel muestra empresa, contacto · cargo · correo, link del portal y logo', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'Luis Rojas', contacto_cargo: 'Gerente', contacto_correo: 'luis@planta.com' }, archivo('logo.png', 'image/png', PNG_1PX));
    const html = await (await request.get('/panel')).text();
    expect(html).toContain(c.nombre_empresa);
    expect(html).toContain('Luis Rojas · Gerente · luis@planta.com');
    expect(html).toContain(`/c/${c.token}`);
    expect(html).toContain(`src="${c.logo_url}"`);
  });
});

test.describe('Datos y logo de un cliente existente', () => {
  test('editar contacto, cargo y correo', async ({ request }) => {
    const c = await crearCliente(request);
    const res = await formulario(request, '/api/panel/clientes', { _accion: 'datos', id: c.id, contacto: 'Nueva Persona', contacto_cargo: 'Supervisor', contacto_correo: 'nueva@empresa.com' });
    expect(destino(res)).toBe(`/panel/${c.id}?datos=1`);
    const { data } = await sb().from('clientes').select('contacto, contacto_cargo, contacto_correo').eq('id', c.id).maybeSingle();
    expect(data).toEqual({ contacto: 'Nueva Persona', contacto_cargo: 'Supervisor', contacto_correo: 'nueva@empresa.com' });
  });
  test('vaciar los campos los deja en null', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'Alguien', contacto_cargo: 'Cargo', contacto_correo: 'a@b.co' });
    await formulario(request, '/api/panel/clientes', { _accion: 'datos', id: c.id, contacto: '', contacto_cargo: '', contacto_correo: '' });
    const { data } = await sb().from('clientes').select('contacto, contacto_cargo, contacto_correo').eq('id', c.id).maybeSingle();
    expect(data).toEqual({ contacto: null, contacto_cargo: null, contacto_correo: null });
  });
  test('correo inválido al editar → error=correo y nada cambia', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'Original' });
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'datos', id: c.id, contacto: 'Cambiado', contacto_correo: 'mal' }))).toBe(`/panel/${c.id}?error=correo`);
    const { data } = await sb().from('clientes').select('contacto').eq('id', c.id).maybeSingle();
    expect(data?.contacto).toBe('Original');
  });
  test('cambiar el logo sube el nuevo y borra el anterior del bucket', async ({ request }) => {
    const c = await crearCliente(request, {}, archivo('logo.png', 'image/png', PNG_1PX));
    const res = await formulario(request, '/api/panel/clientes', { _accion: 'datos', id: c.id, contacto: 'X' }, { logo: archivo('nuevo.jpg', 'image/jpeg', JPEG_1PX) });
    expect(destino(res)).toBe(`/panel/${c.id}?datos=1`);
    const { data } = await sb().from('clientes').select('logo_url').eq('id', c.id).maybeSingle();
    expect(data?.logo_url).toMatch(/\.jpg$/);
    expect(data?.logo_url).not.toBe(c.logo_url);
    const { data: objetos } = await sb().storage.from('clientes-logos').list(c.id);
    expect(objetos?.length).toBe(1);
    expect(data?.logo_url).toContain(objetos![0].name);
  });
  test('logo que no es imagen al editar → error=logo y los datos no cambian', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'Original' });
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'datos', id: c.id, contacto: 'Cambiado' }, { logo: archivo('doc.pdf', 'application/pdf', PDF_MINIMO) }))).toBe(`/panel/${c.id}?error=logo`);
    const { data } = await sb().from('clientes').select('contacto, logo_url').eq('id', c.id).maybeSingle();
    expect(data).toEqual({ contacto: 'Original', logo_url: null });
  });
  test('sin archivo de logo se conservan datos y logo anteriores', async ({ request }) => {
    const c = await crearCliente(request, {}, archivo('logo.png', 'image/png', PNG_1PX));
    await formulario(request, '/api/panel/clientes', { _accion: 'datos', id: c.id, contacto: 'Solo texto' });
    const { data } = await sb().from('clientes').select('logo_url').eq('id', c.id).maybeSingle();
    expect(data?.logo_url).toBe(c.logo_url);
  });
  for (const id of ['', 'no-es-uuid', UUID_AJENO.slice(0, 20)]) {
    test(`id inválido «${id}» en datos → vuelve a /panel sin tocar nada`, async ({ request }) => {
      expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'datos', id, contacto: 'x' }))).toBe('/panel');
    });
  }
  test('la página del cliente muestra logo, contacto, cargo, correo y el formulario de edición', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'María López', contacto_cargo: 'Directora', contacto_correo: 'maria@x.com' }, archivo('logo.png', 'image/png', PNG_1PX));
    const html = await (await request.get(`/panel/${c.id}`)).text();
    expect(html).toContain('Datos del cliente');
    expect(html).toContain('María López');
    expect(html).toContain('Directora');
    expect(html).toContain('mailto:maria@x.com');
    expect(html).toContain(`src="${c.logo_url}"`);
    expect(html).toContain('Editar datos y logo');
    expect(html).toContain(`/c/${c.token}`);
  });
  test('la página de un cliente inexistente vuelve a /panel', async ({ request }) => {
    expect(destino(await request.get(`/panel/${UUID_AJENO}`, { maxRedirects: 0 }))).toBe('/panel');
  });
});

test.describe('Contraseña del cliente', () => {
  test('cambiarla renueva sal, hash y cifrado', async ({ request }) => {
    const c = await crearCliente(request);
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'clave', id: c.id, password: 'otra-clave-nueva' }))).toBe(`/panel/${c.id}?clave=1`);
    const { data } = await sb().from('clientes').select('password_sal, password_hash, password_cifrada').eq('id', c.id).maybeSingle();
    expect(data?.password_sal).not.toBe(c.password_sal);
    expect(data?.password_hash).not.toBe(c.password_hash);
    expect(data?.password_cifrada).not.toBe(c.password_cifrada);
  });
  test('contraseña corta → error=clave', async ({ request }) => {
    const c = await crearCliente(request);
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'clave', id: c.id, password: 'corta' }))).toBe(`/panel/${c.id}?error=clave`);
  });
  test('id inválido → /panel', async ({ request }) => {
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'clave', id: 'x', password: 'clave-larga-ok' }))).toBe('/panel');
  });
});

test.describe('Portal del cliente', () => {
  const entrarPortal = (request: Parameters<typeof formulario>[0], token: string, password: string, recordar = false) =>
    formulario(request, '/api/c/entrar', { token, password, ...(recordar ? { recordar: 'on' } : {}) });

  test('token inexistente → 404; token con caracteres raros → 404', async ({ request }) => {
    expect((await request.get('/c/zzzzzzzzzz')).status()).toBe(404);
    expect((await request.get('/c/..%2F..%2Fetc')).status()).toBe(404);
  });
  test('sin sesión muestra el acceso con nombre de la empresa y logo, sin listar informes', async ({ request }) => {
    const c = await crearCliente(request, {}, archivo('logo.png', 'image/png', PNG_1PX));
    const html = await (await request.get(`/c/${c.token}`)).text();
    expect(html).toContain(`Portal de ${c.nombre_empresa}`);
    expect(html).toContain(`src="${c.logo_url}"`);
    expect(html).toContain('Ingrese la contraseña');
    expect(html).not.toContain('Descargar ↓');
  });
  test('contraseña incorrecta → error=1; correcta → entra y ve contacto, cargo, correo y logo (solo lectura)', async ({ request }) => {
    const c = await crearCliente(request, { contacto: 'Pedro Gil', contacto_cargo: 'Planificador', contacto_correo: 'pedro@x.com', password: 'clave-cliente-1' }, archivo('logo.png', 'image/png', PNG_1PX));
    expect(destino(await entrarPortal(request, c.token, 'incorrecta'))).toBe(`/c/${c.token}?error=1`);
    const ok = await entrarPortal(request, c.token, 'clave-cliente-1');
    expect(destino(ok)).toBe(`/c/${c.token}`);
    expect(ok.headers()['set-cookie']).toContain('gp_cliente=');
    const html = await (await request.get(`/c/${c.token}`)).text();
    expect(html).toContain('Sus informes técnicos');
    expect(html).toContain('Contacto: Pedro Gil · Planificador · pedro@x.com');
    expect(html).toContain(`src="${c.logo_url}"`);
    expect(html).not.toContain('<form');
  });
  test('la sesión de un cliente no abre el portal de otro', async ({ request }) => {
    const a = await crearCliente(request, { password: 'clave-cliente-a' });
    const b = await crearCliente(request, { password: 'clave-cliente-b' });
    await entrarPortal(request, a.token, 'clave-cliente-a');
    expect(await (await request.get(`/c/${a.token}`)).text()).toContain('Sus informes técnicos');
    expect(await (await request.get(`/c/${b.token}`)).text()).toContain('Ingrese la contraseña');
  });
  test('cambiar la contraseña desde el panel cierra la sesión abierta del portal', async ({ request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    await entrarPortal(request, c.token, 'clave-cliente-1');
    expect(await (await request.get(`/c/${c.token}`)).text()).toContain('Sus informes técnicos');
    await formulario(request, '/api/panel/clientes', { _accion: 'clave', id: c.id, password: 'clave-cliente-2' });
    expect(await (await request.get(`/c/${c.token}`)).text()).toContain('Ingrese la contraseña');
    expect(destino(await entrarPortal(request, c.token, 'clave-cliente-1'))).toBe(`/c/${c.token}?error=1`);
    expect(destino(await entrarPortal(request, c.token, 'clave-cliente-2'))).toBe(`/c/${c.token}`);
  });
  test('"recordar" da cookie de 30 días; sin marcar, cookie de sesión', async ({ request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    expect((await entrarPortal(request, c.token, 'clave-cliente-1')).headers()['set-cookie']).not.toMatch(/Max-Age/i);
    expect((await entrarPortal(request, c.token, 'clave-cliente-1', true)).headers()['set-cookie']).toMatch(/Max-Age=2592000/);
  });
  test('token vacío o contraseña vacía → error=1 sin consultar', async ({ request }) => {
    expect(destino(await entrarPortal(request, '', 'x'))).toBe('/c/?error=1');
    const c = await crearCliente(request);
    expect(destino(await entrarPortal(request, c.token, ''))).toBe(`/c/${c.token}?error=1`);
  });
  test('10 fallos seguidos bloquean el portal (error=2) hasta limpiar los intentos', async ({ request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    for (let i = 0; i < 10; i++) await entrarPortal(request, c.token, 'mala');
    expect(destino(await entrarPortal(request, c.token, 'clave-cliente-1'))).toBe(`/c/${c.token}?error=2`);
    await sb().from('intentos_acceso').delete().eq('ruta', 'cliente');
    expect(destino(await entrarPortal(request, c.token, 'clave-cliente-1'))).toBe(`/c/${c.token}`);
  });
  test('sin cabecera Origin el acceso del portal se rechaza (CSRF)', async ({ request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    expect((await request.post('/api/c/entrar', { form: { token: c.token, password: 'clave-cliente-1' }, maxRedirects: 0 })).status()).toBe(403);
  });
});

test.describe('Informes técnicos', () => {
  const firmar = (request: Parameters<typeof formulario>[0], cliente_id: string, nombre_archivo: string, tamano = 1000) =>
    request.post('/api/panel/informes', { data: { _accion: 'firmar', cliente_id, nombre_archivo, tamano }, headers: ORIGEN });
  const registrar = (request: Parameters<typeof formulario>[0], cliente_id: string, nombre_archivo: string, ruta_storage: string) =>
    request.post('/api/panel/informes', { data: { _accion: 'registrar', cliente_id, nombre_archivo, ruta_storage }, headers: ORIGEN });
  async function subir(request: Parameters<typeof formulario>[0], cliente_id: string, nombre: string, contenido = PDF_MINIMO) {
    const f = await firmar(request, cliente_id, nombre, contenido.length);
    expect(f.status(), 'firmar').toBe(200);
    const { url, ruta } = await f.json();
    expect(ruta.startsWith(`${cliente_id}/`)).toBe(true);
    const put = await request.put(url, { data: contenido, headers: { 'content-type': 'application/pdf' } });
    expect(put.status(), 'PUT a Storage').toBe(200);
    const r = await registrar(request, cliente_id, nombre, ruta);
    expect(r.status(), 'registrar').toBe(200);
    return ruta as string;
  }

  test('subida completa: firmar, PUT directo a Storage, registrar; el portal lo lista y la descarga firmada responde un PDF', async ({ request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    const ruta = await subir(request, c.id, 'Informe de vibraciones.pdf');
    const { data } = await sb().from('informes').select('*').eq('cliente_id', c.id);
    expect(data?.length).toBe(1);
    expect(data![0].nombre_archivo).toBe('Informe de vibraciones.pdf');
    expect(data![0].ruta_storage).toBe(ruta);
    await formulario(request, '/api/c/entrar', { token: c.token, password: 'clave-cliente-1' });
    const html = await (await request.get(`/c/${c.token}`)).text();
    expect(html).toContain('Informe de vibraciones.pdf');
    expect(html).toContain('1 documento disponible');
    const firmada = html.match(/href="(https:[^"]+\/object\/sign\/[^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
    expect(firmada, 'enlace firmado en el portal').toBeTruthy();
    const descarga = await request.get(firmada!);
    expect(descarga.status()).toBe(200);
    expect(descarga.headers()['content-type']).toContain('application/pdf');
    expect((await descarga.body()).equals(PDF_MINIMO)).toBe(true);
  });
  test('tres informes: tres filas, el portal los muestra del más nuevo al más viejo', async ({ request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    for (const n of ['A.pdf', 'B.pdf', 'C.pdf']) { await subir(request, c.id, n); await new Promise((r) => setTimeout(r, 30)); }
    await formulario(request, '/api/c/entrar', { token: c.token, password: 'clave-cliente-1' });
    const html = await (await request.get(`/c/${c.token}`)).text();
    expect(html).toContain('3 documentos disponibles');
    expect(html.indexOf('C.pdf')).toBeLessThan(html.indexOf('A.pdf'));
  });
  test('nombre con caracteres raros: la ruta en Storage queda saneada y el nombre original se conserva', async ({ request }) => {
    const c = await crearCliente(request);
    const original = 'Informe ñandú #3 (final) ✓.pdf';
    const ruta = await subir(request, c.id, original);
    const saneado = original.replace(/[^a-zA-Z0-9._-]/g, '_'); // misma regla que api/panel/informes.ts
    expect(ruta.endsWith(`-${saneado}`)).toBe(true);
    expect(ruta.startsWith(`${c.id}/`)).toBe(true);
    const { data } = await sb().from('informes').select('nombre_archivo').eq('cliente_id', c.id).maybeSingle();
    expect(data?.nombre_archivo).toBe('Informe ñandú #3 (final) ✓.pdf');
  });
  const RECHAZOS: [string, () => Record<string, unknown>, number][] = [
    ['tamaño mayor a 20 MB', () => ({ _accion: 'firmar', nombre_archivo: 'x.pdf', tamano: 20 * 1024 * 1024 + 1 }), 413],
    ['cliente_id que no es UUID', () => ({ _accion: 'firmar', cliente_id: 'abc', nombre_archivo: 'x.pdf', tamano: 10 }), 400],
    ['cliente inexistente', () => ({ _accion: 'firmar', cliente_id: UUID_AJENO, nombre_archivo: 'x.pdf', tamano: 10 }), 404],
    ['sin nombre de archivo', () => ({ _accion: 'firmar', nombre_archivo: '', tamano: 10 }), 400],
    ['acción desconocida', () => ({ _accion: 'volar', nombre_archivo: 'x.pdf' }), 400],
    ['registrar sin haber subido', () => ({ _accion: 'registrar', nombre_archivo: 'x.pdf', ruta_storage: 'CLIENTE/no-existe.pdf' }), 409],
    ['registrar con ruta de otro cliente', () => ({ _accion: 'registrar', nombre_archivo: 'x.pdf', ruta_storage: `${UUID_AJENO}/x.pdf` }), 400],
    ['cuerpo que no es JSON válido', () => ({}), 400],
  ];
  for (const [nombre, cuerpo, esperado] of RECHAZOS) {
    test(`rechaza ${nombre} (${esperado})`, async ({ request }) => {
      const c = await crearCliente(request);
      const body = cuerpo();
      if (!('cliente_id' in body)) body.cliente_id = c.id;
      if (typeof body.ruta_storage === 'string') body.ruta_storage = (body.ruta_storage as string).replace('CLIENTE', c.id);
      const res = nombre.includes('JSON') ? await request.post('/api/panel/informes', { data: '{no es json', headers: { ...ORIGEN, 'content-type': 'application/json' } }) : await request.post('/api/panel/informes', { data: body, headers: ORIGEN });
      expect(res.status()).toBe(esperado);
    });
  }
  test('eliminar un informe borra la fila y el archivo de Storage', async ({ request }) => {
    const c = await crearCliente(request);
    const ruta = await subir(request, c.id, 'borrar.pdf');
    const { data: inf } = await sb().from('informes').select('id').eq('cliente_id', c.id).maybeSingle();
    expect(destino(await formulario(request, '/api/panel/informes', { _accion: 'eliminar', cliente_id: c.id, id: inf!.id }))).toBe(`/panel/${c.id}`);
    expect((await sb().from('informes').select('id').eq('id', inf!.id).maybeSingle()).data).toBeNull();
    const { data: objetos } = await sb().storage.from('informes-tecnicos').list(c.id);
    expect(objetos?.some((o) => `${c.id}/${o.name}` === ruta)).toBe(false);
  });
  test('eliminar con un ruta_storage ajeno en el formulario solo borra el informe indicado', async ({ request }) => {
    const c = await crearCliente(request);
    const rutaA = await subir(request, c.id, 'A.pdf');
    await subir(request, c.id, 'B.pdf');
    const { data: b } = await sb().from('informes').select('id').eq('cliente_id', c.id).eq('nombre_archivo', 'B.pdf').maybeSingle();
    await formulario(request, '/api/panel/informes', { _accion: 'eliminar', cliente_id: c.id, id: b!.id, ruta_storage: rutaA });
    const { data: objetos } = await sb().storage.from('informes-tecnicos').list(c.id);
    expect(objetos?.some((o) => `${c.id}/${o.name}` === rutaA)).toBe(true);
    expect((await sb().from('informes').select('id').eq('cliente_id', c.id)).data?.length).toBe(1);
  });
  test('eliminar un informe inexistente no rompe', async ({ request }) => {
    const c = await crearCliente(request);
    expect(destino(await formulario(request, '/api/panel/informes', { _accion: 'eliminar', cliente_id: c.id, id: UUID_AJENO }))).toBe(`/panel/${c.id}`);
  });
  test('eliminar un cliente borra sus informes, sus archivos y su logo', async ({ request }) => {
    const c = await crearCliente(request, {}, archivo('logo.png', 'image/png', PNG_1PX));
    await subir(request, c.id, 'uno.pdf');
    await subir(request, c.id, 'dos.pdf');
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'eliminar', id: c.id }))).toBe('/panel');
    expect((await sb().from('clientes').select('id').eq('id', c.id).maybeSingle()).data).toBeNull();
    expect((await sb().from('informes').select('id').eq('cliente_id', c.id)).data?.length).toBe(0);
    expect((await sb().storage.from('informes-tecnicos').list(c.id)).data?.length).toBe(0);
    expect((await sb().storage.from('clientes-logos').list(c.id)).data?.length).toBe(0);
    expect((await request.get(`/c/${c.token}`)).status()).toBe(404);
  });
  test('eliminar cliente con id inválido no borra nada', async ({ request }) => {
    const antes = (await sb().from('clientes').select('*', { count: 'exact', head: true })).count;
    expect(destino(await formulario(request, '/api/panel/clientes', { _accion: 'eliminar', id: 'x' }))).toBe('/panel');
    expect((await sb().from('clientes').select('*', { count: 'exact', head: true })).count).toBe(antes);
  });
});

test.describe('Panel de clientes (navegador)', () => {
  test('crear cliente con logo desde el formulario y buscarlo', async ({ page }) => {
    await entrarPagina(page);
    const nombre = nombrePrueba('Navegador');
    await page.fill('#nombre_empresa', nombre);
    await page.fill('#contacto', 'Carla Díaz');
    await page.fill('#contacto_cargo', 'Analista');
    await page.fill('#contacto_correo', 'carla@x.com');
    await page.fill('#password_cliente', 'clave-navegador-1');
    await page.setInputFiles('#logo', { name: 'logo.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(page).toHaveURL(/\/panel\?nuevo=1$/);
    await expect(page.getByText('Cliente creado')).toBeVisible();
    await expect(page.locator('.fila-cliente', { hasText: nombre })).toContainText('Carla Díaz · Analista · carla@x.com');
    await expect(page.locator('#buscador-clientes')).toHaveAttribute('data-listo', '1'); // el filtro se engancha en astro:page-load
    await page.fill('#buscador-clientes', nombre.toLowerCase());
    await expect(page.locator('.fila-cliente:visible')).toHaveCount(1);
    await page.fill('#buscador-clientes', 'zzz-no-existe-zzz');
    await expect(page.locator('#sin-resultados')).toBeVisible();
    const { data } = await sb().from('clientes').select('logo_url').eq('nombre_empresa', nombre).maybeSingle();
    expect(data?.logo_url).toBeTruthy();
  });
  test('en la página del cliente: mostrar contraseña, subir un informe por el navegador y eliminarlo', async ({ page, request }) => {
    const c = await crearCliente(request, { password: 'clave-cliente-1' });
    await entrarPagina(page);
    await page.goto(`/panel/${c.id}`);
    await expect(page.locator('#clave-visible')).toBeHidden();
    await page.click('#ver-clave');
    await expect(page.locator('#clave-visible')).toHaveText('clave-cliente-1');
    await page.setInputFiles('#archivos', { name: 'desde-navegador.pdf', mimeType: 'application/pdf', buffer: PDF_MINIMO });
    await page.click('#btn-subir');
    // El nombre aparece antes en el texto de progreso ("Subiendo 1 de 1: …"); lo que confirma la subida es la fila
    // del informe que la página pinta al recargarse, con su botón de eliminar.
    const filaInforme = page.locator('form', { has: page.locator('input[name=_accion][value=eliminar]') });
    await expect(filaInforme).toHaveCount(1, { timeout: 45_000 });
    await expect(page.locator('main')).toContainText('desde-navegador.pdf');
    expect((await sb().from('informes').select('id').eq('cliente_id', c.id)).data?.length).toBe(1);
    page.once('dialog', (d) => d.accept());
    await page.locator('form', { has: page.locator('input[name=_accion][value=eliminar]') }).filter({ has: page.getByRole('button', { name: 'Eliminar' }) }).first().getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.locator('main')).not.toContainText('desde-navegador.pdf');
    expect((await sb().from('informes').select('id').eq('cliente_id', c.id)).data?.length).toBe(0);
  });
  test('editar datos y logo desde la página del cliente', async ({ page, request }) => {
    const c = await crearCliente(request);
    await entrarPagina(page);
    await page.goto(`/panel/${c.id}`);
    await page.getByText('Editar datos y logo').click();
    await page.fill('#contacto', 'Editado Navegador');
    await page.fill('#contacto_cargo', 'Coordinador');
    await page.fill('#contacto_correo', 'editado@x.com');
    await page.setInputFiles('#logo', { name: 'logo.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.getByRole('button', { name: 'Guardar datos' }).click();
    await expect(page).toHaveURL(new RegExp(`/panel/${c.id}\\?datos=1$`));
    await expect(page.getByText('Datos del cliente actualizados')).toBeVisible();
    await expect(page.locator('main')).toContainText('Editado Navegador');
    await expect(page.locator('main')).toContainText('Coordinador');
    const { data } = await sb().from('clientes').select('logo_url, contacto_correo').eq('id', c.id).maybeSingle();
    expect(data?.logo_url).toBeTruthy();
    expect(data?.contacto_correo).toBe('editado@x.com');
  });
});
