export const prerender = false;

import type { APIRoute } from 'astro';
import { sb } from '../../lib/supabase';
import { eventoAbierto, eventoActual } from '../../lib/evento';
import { bloqueado, ipDe, registrarIntento } from '../../lib/limite';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

export const POST: APIRoute = async (ctx) => {
  const { request } = ctx;
  const ip = ipDe(ctx);
  if (await bloqueado(ip, 'evento', 120, 60)) return json({ ok: false, error: 'Demasiados registros desde esta conexión. Intente más tarde.' }, 429);
  const { data: eventos } = await sb().from('eventos').select('id, inicio, fin, forzar_abierto').order('creado_en', { ascending: false });
  const evento = eventoActual(eventos ?? []);
  if (!evento || !eventoAbierto(evento)) return json({ ok: false, error: 'El registro para el evento no está disponible en este momento.' }, 403);

  let data: Record<string, unknown> = {};
  try { data = await request.json(); } catch { return json({ ok: false, error: 'Solicitud inválida.' }, 400); }
  if (clean(data.empresa_web)) return json({ ok: true }); // honeypot

  const nombre = clean(data.nombre, 120);
  const correo = clean(data.correo, 160);
  const telefono = clean(data.telefono, 40);
  const errores: Record<string, string> = {};
  if (nombre.length < 2) errores.nombre = 'Indique su nombre.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) errores.correo = 'Indique un correo válido.';
  if (Object.keys(errores).length) return json({ ok: false, errores }, 422);

  const { error } = await sb().from('registro_evento').insert({ nombre, correo, telefono: telefono || null, evento_id: evento.id });
  if (error) { console.error('[evento] no se pudo registrar', error); return json({ ok: false, error: 'No pudimos registrar su participación. Intente de nuevo.' }, 500); }
  await registrarIntento(ip, 'evento');
  return json({ ok: true });
};
