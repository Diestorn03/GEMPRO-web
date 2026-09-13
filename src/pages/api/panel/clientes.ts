export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado, hashContrasena } from '../../../lib/auth';
import { cifrar } from '../../../lib/cifrado';
import { sb, nuevoToken, nuevaSal } from '../../../lib/supabase';

const MIN_CLAVE = 8;
const UUID = /^[0-9a-f-]{36}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INFORMES = 'informes-tecnicos';
const LOGOS = 'clientes-logos';
const LOGO_MAX = 2 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Sube el logo al bucket público y devuelve su URL y su ruta. undefined = no vino archivo;
 *  null = no sirve (no es imagen, pasa de 2 MB o el bucket no existe: ver supabase/fase9). */
async function subirLogo(entrada: FormDataEntryValue | null, clienteId: string): Promise<{ url: string; ruta: string } | null | undefined> {
  if (!(entrada instanceof File) || entrada.size === 0) return undefined;
  if (!entrada.type.startsWith('image/') || entrada.size > LOGO_MAX) return null;
  const ruta = `${clienteId}/${Date.now()}.${EXT[entrada.type] ?? 'jpg'}`;
  const { error } = await sb().storage.from(LOGOS).upload(ruta, entrada, { contentType: entrada.type });
  if (error) { console.error('[panel/clientes] no se pudo subir el logo', error); return null; }
  return { url: sb().storage.from(LOGOS).getPublicUrl(ruta).data.publicUrl, ruta };
}
/** Borra los logos guardados de un cliente (todos, o todos menos `conservar` al reemplazarlo). */
async function borrarLogos(clienteId: string, conservar?: string) {
  const { data } = await sb().storage.from(LOGOS).list(clienteId, { limit: 100 });
  const rutas = (data ?? []).map((a) => `${clienteId}/${a.name}`).filter((r) => r !== conservar);
  if (rutas.length) await sb().storage.from(LOGOS).remove(rutas);
}
/** Las columnas de la fase 9 todavía no existen en la base. */
const faltaFase9 = (e: { message: string } | null) => !!e && /contacto_cargo|contacto_correo|logo_url/.test(e.message);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const accion = String(form.get('_accion') ?? 'crear');
  const id = String(form.get('id') ?? '');
  const password = String(form.get('password') ?? '');
  const campo = (n: string, max: number) => String(form.get(n) ?? '').trim().slice(0, max);
  const contacto = campo('contacto', 120);
  const contactoCargo = campo('contacto_cargo', 80);
  const contactoCorreo = campo('contacto_correo', 160);

  if (accion === 'eliminar') {
    if (UUID.test(id)) {
      // Borrar primero los archivos del cliente en Storage: la fila de la tabla se borra en
      // cascada, pero eso no toca los buckets — sin esto, informes y logo quedan huérfanos.
      const { data: archivos } = await sb().storage.from(INFORMES).list(id, { limit: 1000 });
      if (archivos?.length) await sb().storage.from(INFORMES).remove(archivos.map((a) => `${id}/${a.name}`));
      await borrarLogos(id);
      await sb().from('clientes').delete().eq('id', id);
    }
    return redirect('/panel', 303);
  }

  if (accion === 'clave') {
    if (!UUID.test(id)) return redirect('/panel', 303);
    if (password.length < MIN_CLAVE) return redirect(`/panel/${id}?error=clave`, 303);
    const sal = nuevaSal();
    const { error } = await sb().from('clientes').update({ password_sal: sal, password_hash: hashContrasena(password, sal), password_cifrada: cifrar(password) }).eq('id', id);
    if (error) { console.error('[panel/clientes] no se pudo cambiar la contraseña', error); return redirect(`/panel/${id}?error=clave`, 303); }
    return redirect(`/panel/${id}?clave=1`, 303);
  }

  if (accion === 'datos') {
    // Persona de contacto, cargo, correo y logo de un cliente ya creado (el cliente los ve en su portal, no los edita).
    if (!UUID.test(id)) return redirect('/panel', 303);
    if (contactoCorreo && !CORREO.test(contactoCorreo)) return redirect(`/panel/${id}?error=correo`, 303);
    const logo = await subirLogo(form.get('logo'), id);
    if (logo === null) return redirect(`/panel/${id}?error=logo`, 303);
    const datos = { contacto: contacto || null, contacto_cargo: contactoCargo || null, contacto_correo: contactoCorreo || null, ...(logo ? { logo_url: logo.url } : {}) };
    const { error } = await sb().from('clientes').update(datos).eq('id', id);
    if (error) { console.error('[panel/clientes] no se pudieron guardar los datos', error); return redirect(`/panel/${id}?error=${faltaFase9(error) ? 'fase9' : 'datos'}`, 303); }
    if (logo) await borrarLogos(id, logo.ruta);
    return redirect(`/panel/${id}?datos=1`, 303);
  }

  // crear
  const nombreEmpresa = campo('nombre_empresa', 120);
  if (!nombreEmpresa || password.length < MIN_CLAVE) return redirect('/panel?error=1', 303);
  if (contactoCorreo && !CORREO.test(contactoCorreo)) return redirect('/panel?error=correo', 303);

  const nuevoId = crypto.randomUUID();
  const sal = nuevaSal();
  const fila = { id: nuevoId, nombre_empresa: nombreEmpresa, contacto: contacto || null, contacto_cargo: contactoCargo || null, contacto_correo: contactoCorreo || null, token: nuevoToken(), password_sal: sal, password_hash: hashContrasena(password, sal) };
  let { error } = await sb().from('clientes').insert({ ...fila, password_cifrada: cifrar(password) });
  if (error?.message.includes('password_cifrada')) {
    // La columna llega con supabase/fase6-clientes-eventos.sql; hasta que se ejecute, el cliente se crea igual (sin contraseña visible).
    console.error('[panel/clientes] falta la columna password_cifrada: ejecutar fase6');
    ({ error } = await sb().from('clientes').insert(fila));
  }
  if (error) { console.error('[panel/clientes] no se pudo crear', error); return redirect(`/panel?error=${faltaFase9(error) ? 'fase9' : '1'}`, 303); }
  // El logo va después de crear la fila: si falla, el cliente existe igual y el logo se sube desde su página.
  const logo = await subirLogo(form.get('logo'), nuevoId);
  if (logo === null) return redirect('/panel?nuevo=1&error=logo', 303);
  if (logo) await sb().from('clientes').update({ logo_url: logo.url }).eq('id', nuevoId);
  return redirect('/panel?nuevo=1', 303);
};
