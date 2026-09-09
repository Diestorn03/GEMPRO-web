export const prerender = false;

import type { APIRoute } from 'astro';
import { sb } from '../../lib/supabase';

/**
 * Latido diario (cron de Vercel, ver vercel.json): una ESCRITURA real en la base para que el
 * proyecto gratuito de Supabase no se pause por inactividad. Deja solo la fila más reciente, y
 * /api/salud la muestra como `ultimo_latido` para poder comprobar que el cron corre.
 */
export const GET: APIRoute = async () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const { error } = await sb().from('intentos_acceso').insert({ ip: 'cron', ruta: 'latido' });
  if (error) return json({ ok: false, error: error.message }, 500);
  const { data } = await sb().from('intentos_acceso').select('id').eq('ruta', 'latido').order('creado_en', { ascending: false });
  if (data && data.length > 1) await sb().from('intentos_acceso').delete().in('id', data.slice(1).map((d) => d.id));
  return json({ ok: true });
};
