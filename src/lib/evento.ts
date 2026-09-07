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
