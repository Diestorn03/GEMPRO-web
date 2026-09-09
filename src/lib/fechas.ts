/** Fechas en hora de Venezuela. Las funciones de Vercel corren en UTC: sin timeZone, lo hecho
 *  después de las 20:00 en Maracaibo salía con la fecha del día siguiente. */
const ZONA = 'America/Caracas';
export const fechaVE = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA });
export const fechaHoraVE = (iso: string) => new Date(iso).toLocaleString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA });
