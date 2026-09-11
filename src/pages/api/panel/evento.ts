export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { aIso, chocaCon } from '../../../lib/evento';
import { sb } from '../../../lib/supabase';

const UUID = /^[0-9a-f-]{36}$/;

/** Eventos: crear, guardar (nombre, fechas e interruptor) y eliminar (sus registros se borran en cascada). */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const accion = String(form.get('_accion') ?? 'guardar');
  const id = String(form.get('id') ?? '');
  const nombre = String(form.get('nombre') ?? '').trim().slice(0, 120);
  const inicioRaw = String(form.get('inicio') ?? '').trim();
  const finRaw = String(form.get('fin') ?? '').trim();
  const inicio = aIso(inicioRaw);
  const fin = aIso(finRaw);
  const forzar = String(form.get('forzar') ?? 'auto'); // 'auto' | 'abierto' | 'cerrado'
  const forzar_abierto = forzar === 'abierto' ? true : forzar === 'cerrado' ? false : null;
  const volver = (q: string) => redirect(`/panel/evento?${q}`, 303);
  /** Solo un evento a la vez: si las fechas (o el forzado abierto) se cruzan con otro evento, no se guarda. */
  const choque = async (candidato: { id?: string; inicio: string | null; fin: string | null; forzar_abierto: boolean | null }) => {
    const { data } = await sb().from('eventos').select('id, nombre, inicio, fin, forzar_abierto');
    const otro = chocaCon(candidato, (data ?? []) as { id: string; nombre: string; inicio: string | null; fin: string | null; forzar_abierto: boolean | null }[]);
    return otro ? volver(`error=2&con=${encodeURIComponent(otro.nombre)}`) : null;
  };

  if (accion === 'eliminar') {
    if (UUID.test(id)) await sb().from('eventos').delete().eq('id', id);
    return volver('eliminado=1');
  }
  if (accion === 'crear') {
    if (!nombre || !inicio || !fin || fin <= inicio) return volver('error=1');
    const ocupado = await choque({ inicio, fin, forzar_abierto: null });
    if (ocupado) return ocupado;
    const { error } = await sb().from('eventos').insert({ nombre, inicio, fin, forzar_abierto: null });
    if (error) { console.error('[panel/evento] no se pudo crear', error); return volver('error=1'); }
    return volver('creado=1');
  }
  // Vacío se permite (evento "sin fechas"); escrito pero inválido (30 de febrero, formato raro) NO se
  // guarda como vacío en silencio: da error y conserva las fechas que ya tenía.
  if (!UUID.test(id) || (inicioRaw && !inicio) || (finRaw && !fin) || (inicio && fin && fin <= inicio)) return volver('error=1');
  const ocupado = await choque({ id, inicio, fin, forzar_abierto });
  if (ocupado) return ocupado;
  const { error } = await sb().from('eventos').update({ ...(nombre ? { nombre } : {}), inicio, fin, forzar_abierto }).eq('id', id);
  if (error) { console.error('[panel/evento] no se pudo guardar', error); return volver('error=1'); }
  return volver('guardado=1');
};

/** Registros de un evento, para el CSV y el sorteo: ?evento=<uuid>. */
export const GET: APIRoute = async ({ cookies, url }) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (!estaAutenticado(cookies)) return json({ error: 'Sin sesión' }, 401);
  const evento = url.searchParams.get('evento') ?? '';
  if (!UUID.test(evento)) return json({ error: 'Evento inválido' }, 400);
  const { data } = await sb().from('registro_evento').select('nombre, correo, telefono, creado_en').eq('evento_id', evento).order('creado_en', { ascending: false });
  return json(data ?? []);
};
