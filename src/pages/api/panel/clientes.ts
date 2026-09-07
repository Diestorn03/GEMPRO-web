export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado, hashContrasena } from '../../../lib/auth';
import { sb, nuevoToken, nuevaSal } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const accion = String(form.get('_accion') ?? 'crear');

  if (accion === 'eliminar') {
    const id = String(form.get('id') ?? '');
    if (id) {
      // Borrar primero los archivos del cliente en Storage: la fila de la tabla se borra en
      // cascada, pero eso no toca el bucket — sin esto, los informes quedan huérfanos.
      const { data: archivos } = await sb().storage.from('informes-tecnicos').list(id);
      if (archivos?.length) await sb().storage.from('informes-tecnicos').remove(archivos.map((a) => `${id}/${a.name}`));
      await sb().from('clientes').delete().eq('id', id);
    }
    return redirect('/panel', 303);
  }

  const nombreEmpresa = String(form.get('nombre_empresa') ?? '').trim().slice(0, 120);
  const contacto = String(form.get('contacto') ?? '').trim().slice(0, 120);
  const password = String(form.get('password') ?? '');
  if (!nombreEmpresa || password.length < 4) return redirect('/panel?error=1', 303);

  const sal = nuevaSal();
  const { error } = await sb().from('clientes').insert({
    nombre_empresa: nombreEmpresa,
    contacto: contacto || null,
    token: nuevoToken(),
    password_sal: sal,
    password_hash: hashContrasena(password, sal),
  });
  if (error) { console.error('[panel/clientes] no se pudo crear', error); return redirect('/panel?error=1', 303); }
  return redirect('/panel?nuevo=1', 303);
};
