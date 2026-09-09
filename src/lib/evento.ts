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

/** Venezuela es UTC-4 fijo (sin horario de verano desde 2016). Las funciones de Vercel corren en
 *  UTC: sin esto, "18:00" escrito en el panel se guardaba como las 18:00 UTC = 14:00 en Maracaibo. */
const VET = '-04:00';
/** De <input type=datetime-local> ("2026-09-10T18:00", hora Venezuela) a ISO UTC. null si vacío o inválido. */
export function aIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local + VET);
  return isNaN(+d) ? null : d.toISOString();
}
/** De ISO UTC al valor de <input type=datetime-local> en hora Venezuela. */
export function aLocal(iso: string | null | undefined): string {
  return iso ? new Date(new Date(iso).getTime() - 4 * 3600e3).toISOString().slice(0, 16) : '';
}
