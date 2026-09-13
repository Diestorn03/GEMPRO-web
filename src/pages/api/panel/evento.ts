export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { aIso, chocaCon, type Evento } from '../../../lib/evento';
import { sb } from '../../../lib/supabase';

const UUID = /^[0-9a-f-]{36}$/;
const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : NaN);

/**
 * Eventos del panel: crear, guardar (nombre y fechas), abrir ahora, cerrar ahora y eliminar.
 * Sin banderas de "forzado": abrir y cerrar a mano mueven la fecha de apertura o de cierre al
 * instante actual, así el evento queda exactamente como si el horario se hubiera cumplido y el
 * historial refleja cuándo estuvo abierto de verdad. Un evento con registros no se elimina: es
 * historial (se exporta su CSV). Solo un evento a la vez: crear, guardar o abrir algo que se cruce
 * con otro evento devuelve error=2 con el nombre del que estorba.
 */
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
  const ahora = new Date().toISOString();
  const volver = (q: string) => redirect(`/panel/evento?${q}`, 303);
  const fallo = (donde: string, e: unknown) => { console.error(`[panel/evento] ${donde}`, e); return volver('error=1'); };
  const choque = async (candidato: { id?: string; inicio: string | null; fin: string | null }) => {
    const { data } = await sb().from('eventos').select('id, nombre, inicio, fin, forzar_abierto');
    const otro = chocaCon({ ...candidato, forzar_abierto: null }, (data ?? []) as Evento[]);
    return otro ? volver(`error=2&con=${encodeURIComponent(otro.nombre)}`) : null;
  };

  if (accion === 'crear') {
    if (!nombre || !inicio || !fin || fin <= inicio) return volver('error=1');
    const ocupado = await choque({ inicio, fin });
    if (ocupado) return ocupado;
    const { error } = await sb().from('eventos').insert({ nombre, inicio, fin, forzar_abierto: null });
    if (error) return fallo('no se pudo crear', error);
    return volver('creado=1');
  }

  if (!UUID.test(id)) return volver('error=1');
  const { data: evento } = await sb().from('eventos').select('id, nombre, inicio, fin, forzar_abierto, creado_en').eq('id', id).maybeSingle();
  if (!evento) return volver('error=1');

  if (accion === 'eliminar') {
    const { count } = await sb().from('registro_evento').select('*', { count: 'exact', head: true }).eq('evento_id', id);
    if (count) return volver(`error=3&con=${encodeURIComponent(evento.nombre)}`);
    const { error } = await sb().from('eventos').delete().eq('id', id);
    if (error) return fallo('no se pudo eliminar', error);
    return volver('eliminado=1');
  }

  if (accion === 'cerrar') {
    // El cierre pasa a este instante; si nunca tuvo apertura (fila antigua forzada), se le pone una un minuto antes.
    const inicioValido = ms(evento.inicio) < Date.now() ? evento.inicio : new Date(Date.now() - 60_000).toISOString();
    const { error } = await sb().from('eventos').update({ inicio: inicioValido, fin: ahora, forzar_abierto: null }).eq('id', id);
    if (error) return fallo('no se pudo cerrar', error);
    return volver('cerrado=1');
  }

  if (accion === 'abrir') {
    // La apertura pasa a este instante; el cierre programado se respeta, así que tiene que estar en el futuro.
    if (!(ms(evento.fin) > Date.now())) return volver('error=1');
    const ocupado = await choque({ id, inicio: ahora, fin: evento.fin });
    if (ocupado) return ocupado;
    const { error } = await sb().from('eventos').update({ inicio: ahora, forzar_abierto: null }).eq('id', id);
    if (error) return fallo('no se pudo abrir', error);
    return volver('abierto=1');
  }

  // guardar: nombre y fechas. Escrito pero inválido (30 de febrero, formato raro) no se guarda en silencio.
  if ((inicioRaw && !inicio) || (finRaw && !fin)) return volver('error=1');
  // Evento en curso: la apertura ya ocurrió y no se toca (el campo va bloqueado); solo se mueve el cierre.
  const enCurso = ms(evento.inicio) <= Date.now() && Date.now() < ms(evento.fin);
  const nuevoInicio = enCurso ? evento.inicio : inicio;
  const nuevoFin = fin ?? evento.fin;
  if (!nuevoInicio || !nuevoFin || nuevoFin <= nuevoInicio) return volver('error=1');
  const ocupado = await choque({ id, inicio: nuevoInicio, fin: nuevoFin });
  if (ocupado) return ocupado;
  const { error } = await sb().from('eventos').update({ ...(nombre ? { nombre } : {}), inicio: nuevoInicio, fin: nuevoFin, forzar_abierto: null }).eq('id', id);
  if (error) return fallo('no se pudo guardar', error);
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
