import { test, expect, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import sharp from 'sharp';
import { BASE, ORIGEN, crearEvento, destino, entrar, entrarOk, entrarPagina, formulario, limpiarTodo, local, nombrePrueba, sb } from './util';

const UUID_AJENO = '11111111-2222-4333-8444-555555555555';
/** La base de pruebas es solo nuestra: cada prueba arranca sin eventos ni registros. */
async function sinEventos() {
  await sb().from('registro_evento').delete().neq('id', UUID_AJENO);
  await sb().from('eventos').delete().neq('id', UUID_AJENO);
  await sb().from('intentos_acceso').delete().eq('ruta', 'evento');
}
test.beforeEach(async ({ request }) => { await sinEventos(); await entrarOk(request); });
test.afterAll(async () => { await sinEventos(); await limpiarTodo(); });

const registrar = (request: APIRequestContext, datos: Record<string, unknown>) => request.post('/api/evento', { data: { nombre: nombrePrueba('Persona'), empresa: 'Planta Norte', cargo: 'Mecánico', correo: 'p@x.com', telefono: '0414 000 0000', ...datos } });
const eventoDe = async (nombre: string) => (await sb().from('eventos').select('*').eq('nombre', nombre).maybeSingle()).data!;
const ACTIVO = () => ({ inicio: local(-1), fin: local(2) });

test.describe('Sin eventos', () => {
  test('el panel avisa que no hay evento y que el QR está desactivado; la página pública está cerrada; el registro responde 403', async ({ request }) => {
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).toContain('No hay ningún evento activo ni programado');
    expect(panel).toContain('QR desactivado: ningún evento activo');
    expect(await (await request.get('/evento')).text()).toContain('El registro no está disponible');
    expect((await registrar(request, {})).status()).toBe(403);
  });
});

test.describe('Crear eventos', () => {
  test('programado a futuro: tarjeta principal "Próximo evento", QR desactivado, registro 403', async ({ request }) => {
    const e = await crearEvento(request);
    expect(e.forzar_abierto).toBeNull();
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).toContain('Próximo evento (programado)');
    expect(panel).toContain(e.nombre);
    expect(panel).toContain('QR desactivado');
    expect((await registrar(request, {})).status()).toBe(403);
  });
  test('activo ahora: tarjeta "Evento activo", pill "Registro abierto", formulario público y registro con empresa y cargo', async ({ request }) => {
    const e = await crearEvento(request, ACTIVO());
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).toContain('Evento activo');
    expect(panel).toContain(`Registro abierto: ${e.nombre}`);
    expect(await (await request.get('/evento')).text()).toContain('Regístrate y participa');
    const res = await registrar(request, { nombre: 'PRUEBA-Juan Pérez', telefono: '0414 000 0000' });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const { data } = await sb().from('registro_evento').select('*').eq('evento_id', e.id);
    expect(data?.length).toBe(1);
    expect(data![0]).toMatchObject({ nombre: 'PRUEBA-Juan Pérez', empresa: 'Planta Norte', cargo: 'Mecánico', correo: 'p@x.com', telefono: '0414 000 0000' });
  });
  test('ya terminado (fechas pasadas): va directo al historial como cerrado', async ({ request }) => {
    const e = await crearEvento(request, { inicio: local(-5), fin: local(-3) });
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).toContain('No hay ningún evento activo ni programado');
    expect(panel).toContain(e.nombre);
    expect(panel).toMatch(new RegExp(`${e.nombre}[\\s\\S]{0,200}cerrado`));
  });
  const INVALIDOS: [string, Record<string, string>][] = [
    ['sin nombre', { nombre: '', inicio: local(1), fin: local(2) }],
    ['sin fecha de apertura', { nombre: 'PRUEBA-x', inicio: '', fin: local(2) }],
    ['sin fecha de cierre', { nombre: 'PRUEBA-x', inicio: local(1), fin: '' }],
    ['cierre igual a apertura', { nombre: 'PRUEBA-x', inicio: '2030-01-01T10:00', fin: '2030-01-01T10:00' }],
    ['cierre antes de apertura', { nombre: 'PRUEBA-x', inicio: local(3), fin: local(1) }],
    ['30 de febrero', { nombre: 'PRUEBA-x', inicio: '2030-02-30T10:00', fin: '2030-03-01T10:00' }],
    ['hora 25', { nombre: 'PRUEBA-x', inicio: '2030-01-01T25:00', fin: '2030-01-02T10:00' }],
    ['formato con segundos', { nombre: 'PRUEBA-x', inicio: '2030-01-01T10:00:00', fin: '2030-01-02T10:00' }],
    ['texto en vez de fecha', { nombre: 'PRUEBA-x', inicio: 'mañana', fin: 'pasado' }],
    ['fecha ISO con zona', { nombre: 'PRUEBA-x', inicio: '2030-01-01T10:00Z', fin: '2030-01-02T10:00' }],
  ];
  for (const [nombre, campos] of INVALIDOS) {
    test(`rechaza ${nombre} con error=1 y no crea nada`, async ({ request }) => {
      expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'crear', ...campos }))).toBe('/panel/evento?error=1');
      expect((await sb().from('eventos').select('*', { count: 'exact', head: true })).count).toBe(0);
    });
  }
  test('las fechas se guardan en hora de Venezuela (UTC-4)', async ({ request }) => {
    await crearEvento(request, { nombre: nombrePrueba('Hora'), inicio: '2030-06-10T18:00', fin: '2030-06-10T20:00' });
    const e = await eventoDe((await sb().from('eventos').select('nombre').like('nombre', 'PRUEBA-Hora%').maybeSingle()).data!.nombre);
    expect(new Date(e.inicio!).toISOString()).toBe('2030-06-10T22:00:00.000Z');
    expect(new Date(e.fin!).toISOString()).toBe('2030-06-11T00:00:00.000Z');
  });
  test('nombre con HTML se muestra escapado en el panel', async ({ request }) => {
    const nombre = `${nombrePrueba('E')} <b onmouseover=x>`;
    await formulario(request, '/api/panel/evento', { _accion: 'crear', nombre, inicio: local(1), fin: local(2) });
    const html = await (await request.get('/panel/evento')).text();
    expect(html).toContain('&lt;b onmouseover=x&gt;');
  });
});

test.describe('Un solo evento a la vez', () => {
  test('crear uno que se cruce con el activo → error=2 con su nombre', async ({ request }) => {
    const activo = await crearEvento(request, ACTIVO());
    const res = await formulario(request, '/api/panel/evento', { _accion: 'crear', nombre: nombrePrueba('Choque'), inicio: local(1), fin: local(3) });
    expect(destino(res)).toBe(`/panel/evento?error=2&con=${encodeURIComponent(activo.nombre)}`);
    expect((await sb().from('eventos').select('*', { count: 'exact', head: true })).count).toBe(1);
    const panel = await (await request.get(`/panel/evento?error=2&con=${encodeURIComponent(activo.nombre)}`)).text();
    expect(panel).toContain('Solo puede haber un evento a la vez');
  });
  test('crear uno que se cruce con un programado → error=2', async ({ request }) => {
    const prog = await crearEvento(request, { inicio: local(24), fin: local(30) });
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'crear', nombre: nombrePrueba('Choque'), inicio: local(29), fin: local(35) }))).toBe(`/panel/evento?error=2&con=${encodeURIComponent(prog.nombre)}`);
  });
  test('crear uno que empieza justo cuando termina el otro no choca', async ({ request }) => {
    await crearEvento(request, { inicio: '2030-01-01T10:00', fin: '2030-01-01T12:00' });
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'crear', nombre: nombrePrueba('Seguido'), inicio: '2030-01-01T12:00', fin: '2030-01-01T14:00' }))).toBe('/panel/evento?creado=1');
  });
  test('con un activo, otro futuro sin cruce se crea y espera su fecha', async ({ request }) => {
    const activo = await crearEvento(request, ACTIVO());
    const futuro = await crearEvento(request, { inicio: local(48), fin: local(50) });
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).toContain(`Registro abierto: ${activo.nombre}`);
    expect(panel).toContain('Esperan su fecha de apertura');
    expect(panel).toMatch(new RegExp(`${futuro.nombre}[\\s\\S]{0,200}programado`));
  });
  test('dos programados: el más cercano es el próximo, el otro espera', async ({ request }) => {
    const lejano = await crearEvento(request, { inicio: local(100), fin: local(102) });
    const cercano = await crearEvento(request, { inicio: local(10), fin: local(12) });
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel.indexOf('Próximo evento (programado)')).toBeLessThan(panel.indexOf(cercano.nombre));
    expect(panel).toMatch(new RegExp(`${lejano.nombre}[\\s\\S]{0,200}programado`));
  });
  test('abrir ahora un programado mientras hay uno activo → error=2', async ({ request }) => {
    const activo = await crearEvento(request, ACTIVO());
    const prog = await crearEvento(request, { inicio: local(48), fin: local(50) });
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'abrir', id: prog.id }))).toBe(`/panel/evento?error=2&con=${encodeURIComponent(activo.nombre)}`);
  });
});

test.describe('Abrir y cerrar a mano', () => {
  test('cerrar el activo: cierre = ahora, pasa al historial, QR desactivado y registro 403', async ({ request }) => {
    const e = await crearEvento(request, ACTIVO());
    await registrar(request, {});
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'cerrar', id: e.id }))).toBe('/panel/evento?cerrado=1');
    const fila = await eventoDe(e.nombre);
    expect(Math.abs(new Date(fila.fin!).getTime() - Date.now())).toBeLessThan(15_000);
    expect(fila.inicio).toBe(e.inicio);
    const panel = await (await request.get('/panel/evento?cerrado=1')).text();
    expect(panel).toContain('Evento cerrado y pasado al historial');
    expect(panel).toContain('No hay ningún evento activo ni programado');
    expect(panel).toMatch(new RegExp(`${e.nombre}[\\s\\S]{0,200}cerrado`));
    expect(panel).toContain('QR desactivado');
    expect((await registrar(request, {})).status()).toBe(403);
    expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true }).eq('evento_id', e.id)).count).toBe(1);
  });
  test('abrir ahora un programado: apertura = ahora, QR activo y los registros van a ese evento', async ({ request }) => {
    const e = await crearEvento(request, { inicio: local(48), fin: local(50) });
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'abrir', id: e.id }))).toBe('/panel/evento?abierto=1');
    const fila = await eventoDe(e.nombre);
    expect(Math.abs(new Date(fila.inicio!).getTime() - Date.now())).toBeLessThan(15_000);
    expect(fila.fin).toBe(e.fin);
    expect(await (await request.get('/panel/evento')).text()).toContain(`Registro abierto: ${e.nombre}`);
    expect((await registrar(request, {})).status()).toBe(200);
    expect((await sb().from('registro_evento').select('evento_id').maybeSingle()).data?.evento_id).toBe(e.id);
  });
  test('abrir ahora uno cuyo cierre ya pasó → error=1', async ({ request }) => {
    const e = await crearEvento(request, { inicio: local(-5), fin: local(-3) });
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'abrir', id: e.id }))).toBe('/panel/evento?error=1');
  });
  test('cerrar y luego abrir el siguiente: el historial conserva el primero con sus registros', async ({ request }) => {
    const primero = await crearEvento(request, ACTIVO());
    await registrar(request, {});
    await registrar(request, {});
    await formulario(request, '/api/panel/evento', { _accion: 'cerrar', id: primero.id });
    const segundo = await crearEvento(request, { inicio: local(24), fin: local(30) });
    await formulario(request, '/api/panel/evento', { _accion: 'abrir', id: segundo.id });
    await registrar(request, {});
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).toContain(`Registro abierto: ${segundo.nombre}`);
    expect(panel).toMatch(new RegExp(`${primero.nombre}[\\s\\S]{0,300}2</span> registros`));
    expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true }).eq('evento_id', primero.id)).count).toBe(2);
    expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true }).eq('evento_id', segundo.id)).count).toBe(1);
  });
  test('fila antigua forzada abierta sin fechas: cuenta como activa; cerrarla le pone fechas reales', async ({ request }) => {
    const nombre = nombrePrueba('Legado');
    await sb().from('eventos').insert({ nombre, inicio: null, fin: null, forzar_abierto: true });
    expect(await (await request.get('/evento')).text()).toContain('Regístrate y participa');
    const e = await eventoDe(nombre);
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'cerrar', id: e.id }))).toBe('/panel/evento?cerrado=1');
    const fila = await eventoDe(nombre);
    expect(fila.forzar_abierto).toBeNull();
    expect(new Date(fila.fin!).getTime()).toBeGreaterThan(new Date(fila.inicio!).getTime());
    expect(await (await request.get('/evento')).text()).toContain('El registro no está disponible');
  });
  test('dos filas antiguas abiertas a la vez: el panel avisa y el QR registra en la más reciente', async ({ request }) => {
    const vieja = nombrePrueba('Vieja');
    const nueva = nombrePrueba('Nueva');
    await sb().from('eventos').insert({ nombre: vieja, inicio: null, fin: null, forzar_abierto: true, creado_en: new Date(Date.now() - 86400e3).toISOString() });
    await sb().from('eventos').insert({ nombre: nueva, inicio: null, fin: null, forzar_abierto: true });
    expect(await (await request.get('/panel/evento')).text()).toContain('Hay 2 eventos abiertos a la vez');
    await registrar(request, {});
    expect((await sb().from('registro_evento').select('evento_id').maybeSingle()).data?.evento_id).toBe((await eventoDe(nueva)).id);
  });
});

test.describe('Guardar cambios', () => {
  test('activo: cambia nombre y cierre; la apertura no se toca aunque se mande otra', async ({ request }) => {
    const e = await crearEvento(request, ACTIVO());
    const nuevo = nombrePrueba('Renombrado');
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'guardar', id: e.id, nombre: nuevo, inicio: local(-10), fin: local(5) }))).toBe('/panel/evento?guardado=1');
    const fila = await eventoDe(nuevo);
    expect(fila.inicio).toBe(e.inicio);
    expect(fila.fin).not.toBe(e.fin);
  });
  test('programado: cambia apertura y cierre', async ({ request }) => {
    const e = await crearEvento(request, { inicio: local(24), fin: local(30) });
    await formulario(request, '/api/panel/evento', { _accion: 'guardar', id: e.id, nombre: e.nombre, inicio: local(40), fin: local(44) });
    const fila = await eventoDe(e.nombre);
    expect(fila.inicio).not.toBe(e.inicio);
    expect(fila.fin).not.toBe(e.fin);
  });
  const MALOS: [string, (id: string) => Record<string, string>, string][] = [
    ['cierre antes de apertura', (id) => ({ _accion: 'guardar', id, nombre: 'x', inicio: local(30), fin: local(25) }), '/panel/evento?error=1'],
    ['fecha inválida escrita', (id) => ({ _accion: 'guardar', id, nombre: 'x', inicio: '2030-02-30T10:00', fin: local(30) }), '/panel/evento?error=1'],
    ['id inexistente', () => ({ _accion: 'guardar', id: UUID_AJENO, nombre: 'x', inicio: local(1), fin: local(2) }), '/panel/evento?error=1'],
    ['id que no es UUID', () => ({ _accion: 'guardar', id: 'abc', nombre: 'x', inicio: local(1), fin: local(2) }), '/panel/evento?error=1'],
    ['acción desconocida con id válido', (id) => ({ _accion: 'volar', id, nombre: 'x' }), '/panel/evento?error=1'],
  ];
  for (const [nombre, campos, esperado] of MALOS) {
    test(`rechaza ${nombre}`, async ({ request }) => {
      const e = await crearEvento(request, { inicio: local(24), fin: local(30) });
      expect(destino(await formulario(request, '/api/panel/evento', campos(e.id)))).toBe(esperado);
      expect((await eventoDe(e.nombre)).inicio).toBe(e.inicio);
    });
  }
  test('guardar fechas que se cruzan con otro programado → error=2', async ({ request }) => {
    const a = await crearEvento(request, { inicio: local(24), fin: local(30) });
    const b = await crearEvento(request, { inicio: local(48), fin: local(52) });
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'guardar', id: a.id, nombre: a.nombre, inicio: local(47), fin: local(49) }))).toBe(`/panel/evento?error=2&con=${encodeURIComponent(b.nombre)}`);
  });
  test('guardar sin tocar las fechas conserva las que tenía', async ({ request }) => {
    const e = await crearEvento(request, { inicio: local(24), fin: local(30) });
    await formulario(request, '/api/panel/evento', { _accion: 'guardar', id: e.id, nombre: e.nombre + ' v2', inicio: '', fin: '' });
    const fila = await eventoDe(e.nombre + ' v2');
    expect(fila.inicio).toBe(e.inicio);
    expect(fila.fin).toBe(e.fin);
  });
});

test.describe('Eliminar', () => {
  test('programado sin registros → eliminado=1', async ({ request }) => {
    const e = await crearEvento(request);
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'eliminar', id: e.id }))).toBe('/panel/evento?eliminado=1');
    expect((await sb().from('eventos').select('id').eq('id', e.id).maybeSingle()).data).toBeNull();
  });
  test('con registros → error=3 y todo sigue ahí', async ({ request }) => {
    const e = await crearEvento(request, ACTIVO());
    await registrar(request, {});
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'eliminar', id: e.id }))).toBe(`/panel/evento?error=3&con=${encodeURIComponent(e.nombre)}`);
    expect((await sb().from('eventos').select('id').eq('id', e.id).maybeSingle()).data).toBeTruthy();
    expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true }).eq('evento_id', e.id)).count).toBe(1);
    expect(await (await request.get(`/panel/evento?error=3&con=${encodeURIComponent(e.nombre)}`)).text()).toContain('forma parte del historial');
  });
  test('cerrado con registros tampoco se elimina; el botón no aparece', async ({ request }) => {
    const e = await crearEvento(request, ACTIVO());
    await registrar(request, {});
    await formulario(request, '/api/panel/evento', { _accion: 'cerrar', id: e.id });
    const panel = await (await request.get('/panel/evento')).text();
    expect(panel).not.toContain('value="eliminar"');
    expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'eliminar', id: e.id }))).toContain('error=3');
  });
  for (const id of ['', 'abc', UUID_AJENO]) {
    test(`eliminar con id «${id || 'vacío'}» → error=1 y no borra nada`, async ({ request }) => {
      await crearEvento(request);
      expect(destino(await formulario(request, '/api/panel/evento', { _accion: 'eliminar', id }))).toBe('/panel/evento?error=1');
      expect((await sb().from('eventos').select('*', { count: 'exact', head: true })).count).toBe(1);
    });
  }
});

test.describe('Registro público por QR', () => {
  test.beforeEach(async ({ request }) => { await crearEvento(request, ACTIVO()); });
  const CASOS: [string, Record<string, unknown>, string[]][] = [
    ['nombre de 1 letra', { nombre: 'A' }, ['nombre']],
    ['sin empresa', { empresa: '' }, ['empresa']],
    ['sin cargo', { cargo: '' }, ['cargo']],
    ['correo sin dominio', { correo: 'ana@' }, ['correo']],
    ['correo sin arroba', { correo: 'ana.com' }, ['correo']],
    ['sin teléfono', { telefono: '' }, ['telefono']],
    ['teléfono de 3 dígitos', { telefono: '041' }, ['telefono']],
    ['todo vacío', { nombre: '', empresa: '', cargo: '', correo: '', telefono: '' }, ['nombre', 'empresa', 'cargo', 'correo', 'telefono']],
  ];
  for (const [nombre, datos, errores] of CASOS) {
    test(`rechaza ${nombre} con 422`, async ({ request }) => {
      const res = await registrar(request, datos);
      expect(res.status()).toBe(422);
      expect(Object.keys((await res.json()).errores)).toEqual(expect.arrayContaining(errores));
      expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true })).count).toBe(0);
    });
  }
  test('honeypot relleno: responde ok pero no guarda', async ({ request }) => {
    const res = await registrar(request, { empresa_web: 'bot' });
    expect((await res.json()).ok).toBe(true);
    expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true })).count).toBe(0);
  });
  test('cuerpo que no es JSON → 400', async ({ request }) => {
    expect((await request.post('/api/evento', { data: Buffer.from('nombre=x'), headers: { 'content-type': 'application/json' } })).status()).toBe(400);
  });
  test('campos largos se recortan', async ({ request }) => {
    await registrar(request, { nombre: 'PRUEBA-' + 'n'.repeat(300), empresa: 'e'.repeat(300), cargo: 'c'.repeat(300), telefono: '0'.repeat(300) });
    const { data } = await sb().from('registro_evento').select('telefono, nombre, empresa, cargo').maybeSingle();
    expect(data?.telefono?.length).toBe(40);
    expect(data?.nombre.length).toBe(120);
    expect(data?.empresa.length).toBe(120);
    expect(data?.cargo.length).toBe(80);
  });
  test('cinco registros en paralelo quedan los cinco', async ({ request }) => {
    const res = await Promise.all([1, 2, 3, 4, 5].map((i) => registrar(request, { correo: `p${i}@x.com` })));
    expect(res.map((r) => r.status())).toEqual([200, 200, 200, 200, 200]);
    expect((await sb().from('registro_evento').select('*', { count: 'exact', head: true })).count).toBe(5);
  });
  test('límite: 120 registros por hora desde la misma conexión, el 121º responde 429', async ({ request }) => {
    // Un registro real para saber con qué IP nos ve el servidor; el resto del cupo se siembra en la tabla.
    expect((await registrar(request, { correo: 'p1@x.com' })).status()).toBe(200);
    const { data: ultimo } = await sb().from('intentos_acceso').select('ip').eq('ruta', 'evento').order('creado_en', { ascending: false }).limit(1).maybeSingle();
    expect(ultimo?.ip).toBeTruthy();
    await sb().from('intentos_acceso').insert(Array.from({ length: 118 }, () => ({ ip: ultimo!.ip, ruta: 'evento' })));
    expect((await registrar(request, { correo: 'p120@x.com' })).status(), 'el registro número 120 todavía pasa').toBe(200);
    expect((await registrar(request, { correo: 'p121@x.com' })).status(), 'el 121 se bloquea').toBe(429);
  });
  test('el formulario público (navegador) registra y muestra el agradecimiento', async ({ page }) => {
    await page.goto('/evento');
    await page.fill('#ev-nombre', 'PRUEBA-Desde navegador');
    await page.fill('#ev-empresa', 'Empresa Web');
    await page.fill('#ev-cargo', 'Gerente');
    await page.fill('#ev-correo', 'web@x.com');
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.locator('#tarjeta-evento')).toContainText('Gracias, quedaste registrado');
    const { data } = await sb().from('registro_evento').select('empresa, cargo').eq('correo', 'web@x.com').maybeSingle();
    expect(data).toEqual({ empresa: 'Empresa Web', cargo: 'Gerente' });
  });
  test('el formulario público muestra los errores del servidor sin recargar', async ({ page }) => {
    await page.goto('/evento');
    await page.fill('#ev-nombre', 'X');
    await page.fill('#ev-empresa', 'E');
    await page.fill('#ev-cargo', 'C');
    await page.fill('#ev-correo', 'no-correo');
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await expect(page.locator('.error-evento')).toContainText('Indique su nombre');
    await expect(page.locator('.error-evento')).toContainText('correo válido');
  });
});

test.describe('CSV, sorteo y QR', () => {
  test('GET /api/panel/evento: registros del evento (los más nuevos primero) con empresa y cargo', async ({ request }) => {
    const e = await crearEvento(request, ACTIVO());
    await registrar(request, { nombre: 'PRUEBA-Primero', correo: 'a@x.com' });
    await new Promise((r) => setTimeout(r, 30));
    await registrar(request, { nombre: 'PRUEBA-Segundo', correo: 'b@x.com' });
    const res = await request.get(`/api/panel/evento?evento=${e.id}`);
    expect(res.status()).toBe(200);
    const lista = await res.json();
    expect(lista.map((r: { nombre: string }) => r.nombre)).toEqual(['PRUEBA-Segundo', 'PRUEBA-Primero']);
    expect(lista[0]).toMatchObject({ empresa: 'Planta Norte', cargo: 'Mecánico' });
  });
  test('GET /api/panel/evento con uuid inválido → 400; evento sin registros → []', async ({ request }) => {
    expect((await request.get('/api/panel/evento?evento=abc')).status()).toBe(400);
    const e = await crearEvento(request);
    expect(await (await request.get(`/api/panel/evento?evento=${e.id}`)).json()).toEqual([]);
  });
  test('exportar CSV desde el panel: cabecera con Empresa y Cargo, una fila por registro y celdas peligrosas neutralizadas', async ({ page, request }) => {
    await crearEvento(request, ACTIVO());
    await registrar(request, { nombre: 'PRUEBA-Ana', correo: 'ana@x.com' });
    await registrar(request, { nombre: '=SUMA(1;2)', correo: 'formula@x.com' });
    await entrarPagina(page);
    await page.goto('/panel/evento');
    const [descarga] = await Promise.all([page.waitForEvent('download'), page.locator('button[data-csv]').first().click()]);
    const csv = readFileSync((await descarga.path())!, 'utf8');
    const filas = csv.trim().split('\n');
    expect(filas[0]).toContain('"Nombre","Empresa","Cargo","Correo","Teléfono","Fecha (Venezuela)"');
    expect(filas.length).toBe(3);
    expect(csv).toContain('"PRUEBA-Ana","Planta Norte","Mecánico","ana@x.com"');
    expect(csv).toContain('"\'=SUMA(1;2)"');
  });
  test('elegir ganador muestra a alguien registrado con su empresa', async ({ page, request }) => {
    await crearEvento(request, ACTIVO());
    await registrar(request, { nombre: 'PRUEBA-Única', correo: 'unica@x.com' });
    await entrarPagina(page);
    await page.goto('/panel/evento');
    await page.locator('button[data-ganador]').first().click();
    await expect(page.locator('[data-resultado]').first()).toContainText('Ganador: PRUEBA-Única (Planta Norte, Mecánico) — unica@x.com');
  });
  test('sorteo sin registros lo dice', async ({ page, request }) => {
    await crearEvento(request, ACTIVO());
    await entrarPagina(page);
    await page.goto('/panel/evento');
    await page.locator('button[data-ganador]').first().click();
    await expect(page.locator('[data-resultado]').first()).toContainText('no tiene registros');
  });
  test('el QR PNG se descarga, pesa lo esperado y decodifica a la URL del evento', async ({ request }) => {
    const res = await request.get('/api/panel/qr?formato=png&estilo=gempro');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(res.headers()['content-disposition']).toContain('qr-evento-gempro-gempro.png');
    const png = await res.body();
    expect(png.length).toBeGreaterThan(20_000);
    const { data, info } = await sharp(png).resize(800).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const leido = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height);
    expect(leido?.data).toBe(`${BASE}/evento`);
  });
  test('el QR clásico también decodifica y el SVG es un SVG', async ({ request }) => {
    const png = await (await request.get('/api/panel/qr?formato=png&estilo=clasico')).body();
    const { data, info } = await sharp(png).resize(800).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height)?.data).toBe(`${BASE}/evento`);
    const svg = await request.get('/api/panel/qr?formato=svg&estilo=gempro');
    expect(svg.headers()['content-type']).toBe('image/svg+xml');
    expect(await svg.text()).toContain('<svg');
  });
  test('la vista previa del QR en el panel es una imagen incrustada', async ({ request }) => {
    const html = await (await request.get('/panel/evento')).text();
    expect(html).toContain('alt="QR estilo GEMPRO"');
    expect(html).toContain('src="data:image/png;base64,');
  });
});

test.describe('Panel de eventos (navegador)', () => {
  test('crear, abrir ahora, cerrar y ver en el historial usando la interfaz', async ({ page }) => {
    await entrarPagina(page);
    await page.goto('/panel/evento');
    const nombre = nombrePrueba('UI');
    await page.fill('#nuevo-nombre', nombre);
    await page.locator('#nuevo-inicio').evaluate((el: HTMLInputElement, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, local(48));
    await page.locator('#nuevo-fin').evaluate((el: HTMLInputElement, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, local(50));
    await page.getByRole('button', { name: 'Crear evento' }).click();
    await expect(page).toHaveURL(/creado=1$/);
    await expect(page.locator('main')).toContainText('Próximo evento (programado)');
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Abrir ahora' }).click();
    await expect(page).toHaveURL(/abierto=1$/);
    await expect(page.locator('main')).toContainText(`Registro abierto: ${nombre}`);
    await page.getByRole('button', { name: 'Cerrar evento ahora' }).click();
    await expect(page).toHaveURL(/cerrado=1$/);
    await expect(page.locator('main')).toContainText('QR desactivado');
    await expect(page.locator('main')).toContainText('Eventos cerrados');
    await expect(page.locator('[data-tarjeta]', { hasText: nombre })).toContainText('cerrado');
  });
  test('el calendario propio deja elegir día y hora y "Cierra" se corrige si queda antes de "Abre"', async ({ page }) => {
    await entrarPagina(page);
    await page.goto('/panel/evento');
    const formulario = page.locator('form', { has: page.locator('input[name=_accion][value=crear]') });
    await formulario.locator('.fecha-boton').first().click();
    await expect(formulario.locator('.fecha-panel').first()).toBeVisible();
    await formulario.locator('.fecha-panel').first().locator('.fecha-dia:not(.vacio)').last().click();
    await formulario.locator('.fecha-panel').first().getByRole('button', { name: 'Listo' }).click();
    const inicio = await formulario.locator('#nuevo-inicio').inputValue();
    const fin = await formulario.locator('#nuevo-fin').inputValue();
    expect(inicio).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(fin > inicio).toBe(true);
  });
  test('sin sesión el botón de descarga del QR manda a /entrar', async ({ page }) => {
    await page.goto('/api/panel/qr?formato=png');
    await expect(page).toHaveURL(/\/entrar$/);
  });
  test('la sesión del panel también sirve tras un intento fallido previo', async ({ request }) => {
    await entrar(request, 'mala');
    await entrarOk(request);
    expect((await request.get('/panel/evento')).status()).toBe(200);
    await sb().from('intentos_acceso').delete().eq('ruta', 'entrar');
  });
});
