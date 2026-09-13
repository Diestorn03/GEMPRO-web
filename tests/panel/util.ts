/**
 * Ayudantes de la suite del panel: lectura de .env.pruebas, cliente de Supabase de PRUEBAS para
 * verificar y limpiar, inicio de sesión por API y por navegador, y fabricación de datos.
 * Todo dato creado lleva el prefijo PRUEBA- y se borra en la limpieza final de cada archivo.
 */
import { readFileSync } from 'node:fs';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const BASE = 'http://127.0.0.1:4322';
export const PREFIJO = 'PRUEBA-';
const REF_PRODUCCION = 'bcasqdjkilnefnqgfbnh';

function leerEnv(ruta: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const l = linea.trim();
    const i = l.indexOf('=');
    if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return env;
}
export const ENV = leerEnv('.env.pruebas');
if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL.includes(REF_PRODUCCION)) {
  throw new Error('La suite del panel solo corre contra la base de PRUEBAS (.env.pruebas). Ver README.');
}

let cliente: SupabaseClient | null = null;
/** Cliente de Supabase de pruebas con service_role: verifica lo que el servidor escribió y limpia. */
export function sb(): SupabaseClient {
  if (!cliente) cliente = createClient(new URL(ENV.SUPABASE_URL).origin, ENV.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return cliente;
}

export const sufijo = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const nombrePrueba = (que: string) => `${PREFIJO}${que}-${sufijo()}`;

/** Los formularios del sitio van con comprobación de origen (CSRF): sin esta cabecera Astro responde 403. */
export const ORIGEN = { origin: BASE };

/** Inicia sesión del panel por API; deja la cookie en el contexto. Devuelve la respuesta (303 a /panel si entró). */
export async function entrar(request: APIRequestContext, password = ENV.ADMIN_PASSWORD, recordar = false) {
  return request.post('/api/entrar', { form: { password, ...(recordar ? { recordar: 'on' } : {}) }, headers: ORIGEN, maxRedirects: 0 });
}
export async function entrarOk(request: APIRequestContext) {
  const res = await entrar(request);
  expect(res.status(), 'inicio de sesión del panel').toBe(303);
  expect(res.headers()['location']).toBe('/panel');
}
/** Inicia sesión en el navegador con el formulario real de /entrar. */
export async function entrarPagina(page: Page, password = ENV.ADMIN_PASSWORD) {
  await page.goto('/entrar');
  await page.fill('#password', password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Formulario del panel por API (urlencoded o multipart), con origen correcto y sin seguir la redirección. */
export function formulario(request: APIRequestContext, ruta: string, campos: Record<string, string>, archivos?: Record<string, { name: string; mimeType: string; buffer: Buffer }>) {
  if (archivos) {
    const multipart: Record<string, unknown> = { ...campos };
    for (const [k, v] of Object.entries(archivos)) multipart[k] = v;
    return request.post(ruta, { multipart: multipart as never, headers: ORIGEN, maxRedirects: 0 });
  }
  return request.post(ruta, { form: campos, headers: ORIGEN, maxRedirects: 0 });
}
/** A dónde redirige una respuesta 303 del panel (ruta + query), para leer ?error= o ?nuevo=. */
export const destino = (res: { status(): number; headers(): Record<string, string> }) => {
  expect(res.status()).toBe(303);
  return res.headers()['location'] ?? '';
};

/** Crea un cliente por la API del panel y devuelve su fila de la base. */
export async function crearCliente(request: APIRequestContext, datos: Partial<{ nombre_empresa: string; contacto: string; contacto_cargo: string; contacto_correo: string; password: string }> = {}, logo?: { name: string; mimeType: string; buffer: Buffer }) {
  const nombre_empresa = datos.nombre_empresa ?? nombrePrueba('Cliente');
  const campos = { nombre_empresa, contacto: datos.contacto ?? 'Persona de prueba', contacto_cargo: datos.contacto_cargo ?? '', contacto_correo: datos.contacto_correo ?? '', password: datos.password ?? 'clave-de-prueba-123' };
  const res = await formulario(request, '/api/panel/clientes', campos, logo ? { logo } : undefined);
  const a = destino(res);
  expect(a, 'creación del cliente').toContain('nuevo=1');
  const { data } = await sb().from('clientes').select('*').eq('nombre_empresa', nombre_empresa).maybeSingle();
  expect(data, 'el cliente quedó en la base').toBeTruthy();
  return data as { id: string; token: string; nombre_empresa: string; contacto: string | null; contacto_cargo: string | null; contacto_correo: string | null; logo_url: string | null; password_sal: string; password_hash: string; password_cifrada: string | null };
}

/** Crea una noticia por la API del panel y devuelve su fila. */
export async function crearNoticia(request: APIRequestContext, datos: Partial<{ titulo: string; contenido: string; publicado: boolean }> = {}, imagen?: { name: string; mimeType: string; buffer: Buffer }) {
  const titulo = datos.titulo ?? nombrePrueba('Noticia');
  const campos: Record<string, string> = { titulo, contenido: datos.contenido ?? 'Primer párrafo de prueba.\n\nSegundo párrafo de prueba.', imagen_actual: '' };
  if (datos.publicado !== false) campos.publicado = 'on';
  const res = await formulario(request, '/api/panel/noticias', campos, imagen ? { imagen } : undefined);
  expect(destino(res)).toBe('/panel/noticias');
  const { data } = await sb().from('noticias').select('*').eq('titulo', titulo).maybeSingle();
  expect(data, 'la noticia quedó en la base').toBeTruthy();
  return data as { id: string; titulo: string; contenido: string; imagen_url: string | null; publicado: boolean };
}

/** Fechas para eventos: `horas` relativo a ahora, en el formato del <input type=datetime-local> en hora Venezuela. */
export function local(horasDesdeAhora: number): string {
  const d = new Date(Date.now() + horasDesdeAhora * 3600e3 - 4 * 3600e3);
  return d.toISOString().slice(0, 16);
}
/** Crea un evento (crear = fechas obligatorias) y devuelve su fila. */
export async function crearEvento(request: APIRequestContext, datos: Partial<{ nombre: string; inicio: string; fin: string }> = {}) {
  const nombre = datos.nombre ?? nombrePrueba('Evento');
  const res = await formulario(request, '/api/panel/evento', { _accion: 'crear', nombre, inicio: datos.inicio ?? local(24), fin: datos.fin ?? local(30) });
  expect(destino(res), 'creación del evento').toContain('creado=1');
  const { data } = await sb().from('eventos').select('*').eq('nombre', nombre).maybeSingle();
  expect(data, 'el evento quedó en la base').toBeTruthy();
  return data as { id: string; nombre: string; inicio: string | null; fin: string | null; forzar_abierto: boolean | null };
}

/** PNG de 1×1 válido (transparente), JPEG mínimo y un "archivo" que no es imagen. */
export const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
export const JPEG_1PX = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
export const PDF_MINIMO = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
export const archivo = (name: string, mimeType: string, buffer: Buffer) => ({ name, mimeType, buffer });

/** Borra todo lo que las pruebas crearon (prefijo PRUEBA-) en tablas y buckets. */
export async function limpiarTodo() {
  const s = sb();
  const { data: clientes } = await s.from('clientes').select('id').like('nombre_empresa', `${PREFIJO}%`);
  for (const c of clientes ?? []) {
    for (const bucket of ['informes-tecnicos', 'clientes-logos']) {
      const { data: objetos } = await s.storage.from(bucket).list(c.id, { limit: 1000 });
      if (objetos?.length) await s.storage.from(bucket).remove(objetos.map((o) => `${c.id}/${o.name}`));
    }
  }
  await s.from('clientes').delete().like('nombre_empresa', `${PREFIJO}%`);
  const { data: noticias } = await s.from('noticias').select('imagen_url').like('titulo', `${PREFIJO}%`);
  const rutas = (noticias ?? []).map((n) => n.imagen_url?.split('noticias-imagenes/')[1]).filter(Boolean) as string[];
  if (rutas.length) await s.storage.from('noticias-imagenes').remove(rutas);
  await s.from('noticias').delete().like('titulo', `${PREFIJO}%`);
  await s.from('registro_evento').delete().like('nombre', `${PREFIJO}%`);
  await s.from('eventos').delete().like('nombre', `${PREFIJO}%`);
  await s.from('mensajes').delete().like('nombre', `${PREFIJO}%`);
  await s.from('intentos_acceso').delete().neq('ruta', 'latido');
}
