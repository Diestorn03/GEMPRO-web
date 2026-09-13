export const prerender = false;

import type { APIRoute } from 'astro';
import { sb } from '../../lib/supabase';
import { igual } from '../../lib/auth';

/**
 * Latido diario (cron de Vercel, ver vercel.json): una ESCRITURA real en la base para que el
 * proyecto gratuito de Supabase no se pause por inactividad. Deja solo la fila más reciente, y
 * /api/salud la muestra como `ultimo_latido` para poder comprobar que el cron corre.
 *
 * Vercel firma sus llamadas de cron con `Authorization: Bearer CRON_SECRET` en cuanto esa
 * variable existe (Project Settings → Environment Variables). En Vercel es obligatoria: sin ella
 * el endpoint responde 503 en vez de quedar abierto a que cualquiera gaste cuota de Supabase con
 * escrituras. En local (sin VERCEL) se puede probar sin la variable.
 */
export const GET: APIRoute = async ({ request }) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto && process.env.VERCEL) return new Response('Falta CRON_SECRET en Vercel', { status: 503 });
  if (secreto && !igual(request.headers.get('authorization') ?? '', `Bearer ${secreto}`)) {
    return new Response('No autorizado', { status: 401 });
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const { error } = await sb().from('intentos_acceso').insert({ ip: 'cron', ruta: 'latido' });
  if (error) return json({ ok: false, error: error.message }, 500);
  const { data } = await sb().from('intentos_acceso').select('id').eq('ruta', 'latido').order('creado_en', { ascending: false });
  if (data && data.length > 1) await sb().from('intentos_acceso').delete().in('id', data.slice(1).map((d) => d.id));
  return json({ ok: true });
};
