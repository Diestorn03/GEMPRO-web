export interface EventoConfig {
  inicio: string | null;
  fin: string | null;
  forzar_abierto: boolean | null;
}

/**
 * Por defecto CERRADO si nadie ha configurado nada — así nunca queda una página de registro
 * abierta por accidente antes de que GEMPRO decida activarla.
 */
export function eventoAbierto(config: EventoConfig | null | undefined): boolean {
  if (!config) return false;
  if (config.forzar_abierto === true) return true;
  if (config.forzar_abierto === false) return false;
  if (!config.inicio && !config.fin) return false;
  const ahora = Date.now();
  if (config.inicio && ahora < new Date(config.inicio).getTime()) return false;
  if (config.fin && ahora > new Date(config.fin).getTime()) return false;
  return true;
}

/** Regla única para /evento, /api/evento y el panel: el evento abierto más reciente; si ninguno
 *  está abierto, el más reciente (para mostrarlo como "actual, cerrado"). `eventos` viene
 *  ordenado por creado_en descendente. */
export function eventoActual<T extends EventoConfig>(eventos: T[]): T | null {
  return eventos.find(eventoAbierto) ?? eventos[0] ?? null;
}

/** true si el evento todavía no empezó (tiene fecha de apertura y está en el futuro). */
export function esFuturo(e: EventoConfig, ahora = Date.now()): boolean {
  return !!e.inicio && ahora < new Date(e.inicio).getTime();
}

/** Lo que muestra el panel: `enCurso` (abierto ahora), `programados` (empiezan después, del más
 *  cercano al más lejano) y `anteriores` (lo demás, del más reciente al más viejo). `actual` es la
 *  tarjeta principal: el que está en curso; si no hay, el próximo programado; si no, el último pasado.
 *  Antes un evento futuro caía en "anteriores" como "cerrado" y, sin evento abierto, el último
 *  creado (aunque fuera futuro) se mostraba como "último evento (cerrado)". */
export function clasificar<T extends EventoConfig>(eventos: T[], ahora = Date.now()) {
  const enCurso = eventos.find((e) => eventoAbierto(e)) ?? null;
  const resto = eventos.filter((e) => e !== enCurso);
  const programados = resto.filter((e) => esFuturo(e, ahora)).sort((a, b) => new Date(a.inicio!).getTime() - new Date(b.inicio!).getTime());
  const anteriores = resto.filter((e) => !esFuturo(e, ahora));
  const actual = enCurso ?? programados[0] ?? anteriores[0] ?? null;
  return { actual, enCurso, programados: programados.filter((e) => e !== actual), anteriores: anteriores.filter((e) => e !== actual) };
}

/** Venezuela es UTC-4 fijo (sin horario de verano desde 2016). Las funciones de Vercel corren en
 *  UTC: sin esto, "18:00" escrito en el panel se guardaba como las 18:00 UTC = 14:00 en Maracaibo. */
const VET = '-04:00';
/** De <input type=datetime-local> ("2026-09-10T18:00", hora Venezuela) a ISO UTC. null si vacío o inválido.
 *  Inválido incluye fechas que no existen: "2026-02-30" no da error en JavaScript, "rueda" al 2 de
 *  marzo en silencio. Se exige el formato exacto y que la fecha vuelva igual al pasarla por aLocal(). */
export function aIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(local + VET);
  if (isNaN(+d)) return null;
  const iso = d.toISOString();
  return aLocal(iso) === local ? iso : null;
}
/** De ISO UTC al valor de <input type=datetime-local> en hora Venezuela. */
export function aLocal(iso: string | null | undefined): string {
  return iso ? new Date(new Date(iso).getTime() - 4 * 3600e3).toISOString().slice(0, 16) : '';
}

/** Ventana [desde, hasta] en ms en la que el evento está o estará abierto; null si nunca lo estará.
 *  Forzado abierto = desde ahora y sin fin (ignora las fechas, igual que eventoAbierto). */
export function ventana(e: EventoConfig, ahora = Date.now()): [number, number] | null {
  if (e.forzar_abierto === false) return null;
  if (e.forzar_abierto === true) return [ahora, Infinity];
  if (!e.inicio && !e.fin) return null;
  return [e.inicio ? new Date(e.inicio).getTime() : -Infinity, e.fin ? new Date(e.fin).getTime() : Infinity];
}

/** Solo un evento a la vez: devuelve el otro evento cuya ventana se cruza con la de `candidato`
 *  (abierto ahora o programado para las mismas fechas), o null si no choca con ninguno. */
export function chocaCon<T extends EventoConfig & { id: string }>(candidato: EventoConfig & { id?: string }, otros: T[]): T | null {
  const a = ventana(candidato);
  if (!a) return null;
  return otros.find((o) => {
    if (o.id === candidato.id) return false;
    const b = ventana(o);
    return !!b && a[0] < b[1] && b[0] < a[1];
  }) ?? null;
}
