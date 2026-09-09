export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado, hashContrasena } from '../../../lib/auth';
import { cifrar } from '../../../lib/cifrado';
import { sb, nuevoToken, nuevaSal } from '../../../lib/supabase';

const MIN_CLAVE = 8;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const accion = String(form.get('_accion') ?? 'crear');
  const id = String(form.get('id') ?? '');
  const password = String(form.get('password') ?? '');

  if (accion === 'eliminar') {
    if (id) {
      // Borrar primero los archivos del cliente en Storage: la fila de la tabla se borra en
      // cascada, pero eso no toca el bucket — sin esto, los informes quedan huérfanos.
      const { data: archivos } = await sb().storage.from('informes-tecnicos').list(id, { limit: 1000 });
      if (archivos?.length) await sb().storage.from('informes-tecnicos').remove(archivos.map((a) => `${id}/${a.name}`));
      await sb().from('clientes').delete().eq('id', id);
    }
    return redirect('/panel', 303);
  }

  if (accion === 'clave') {
    if (!id) return redirect('/panel', 303);
    if (password.length < MIN_CLAVE) return redirect(`/panel/${id}?error=clave`, 303);
    const sal = nuevaSal();
    const { error } = await sb().from('clientes').update({ password_sal: sal, password_hash: hashContrasena(password, sal), password_cifrada: cifrar(password) }).eq('id', id);
    if (error) { console.error('[panel/clientes] no se pudo cambiar la contraseña', error); return redirect(`/panel/${id}?error=clave`, 303); }
    return redirect(`/panel/${id}?clave=1`, 303);
  }

  const nombreEmpresa = String(form.get('nombre_empresa') ?? '').trim().slice(0, 120);
  const contacto = String(form.get('contacto') ?? '').trim().slice(0, 120);
  if (!nombreEmpresa || password.length < MIN_CLAVE) return redirect('/panel?error=1', 303);

  const sal = nuevaSal();
  const fila = { nombre_empresa: nombreEmpresa, contacto: contacto || null, token: nuevoToken(), password_sal: sal, password_hash: hashContrasena(password, sal) };
  let { error } = await sb().from('clientes').insert({ ...fila, password_cifrada: cifrar(password) });
  if (error?.message.includes('password_cifrada')) {
    // La columna llega con supabase/fase6-clientes-eventos.sql; hasta que se ejecute, el cliente se crea igual (sin contraseña visible).
    console.error('[panel/clientes] falta la columna password_cifrada: ejecutar fase6');
    ({ error } = await sb().from('clientes').insert(fila));
  }
  if (error) { console.error('[panel/clientes] no se pudo crear', error); return redirect('/panel?error=1', 303); }
  return redirect('/panel?nuevo=1', 303);
};
