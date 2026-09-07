export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { sb } from '../../../lib/supabase';

/** Guarda la configuración de apertura/cierre del evento. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const inicio = String(form.get('inicio') ?? '').trim();
  const fin = String(form.get('fin') ?? '').trim();
  const forzar = String(form.get('forzar') ?? 'auto'); // 'auto' | 'abierto' | 'cerrado'

  await sb().from('evento_config').update({
    inicio: inicio ? new Date(inicio).toISOString() : null,
    fin: fin ? new Date(fin).toISOString() : null,
    forzar_abierto: forzar === 'abierto' ? true : forzar === 'cerrado' ? false : null,
    actualizado_en: new Date().toISOString(),
  }).eq('id', true);

  return redirect('/panel/evento?guardado=1', 303);
};

/** Lista de registros para exportar a CSV o elegir un ganador (solo lo consume /panel/evento). */
export const GET: APIRoute = async ({ cookies }) => {
  if (!estaAutenticado(cookies)) return new Response(JSON.stringify({ error: 'Sin sesión' }), { status: 401 });
  const { data } = await sb().from('registro_evento').select('nombre, correo, telefono, creado_en').order('creado_en', { ascending: false });
  return new Response(JSON.stringify(data ?? []), { headers: { 'Content-Type': 'application/json' } });
};
