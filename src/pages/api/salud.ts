export const prerender = false;

import type { APIRoute } from 'astro';
import { sb } from '../../lib/supabase';

/**
 * Chequeo de configuración en producción. NO expone valores, solo si cada variable llegó al
 * servidor — sirve para distinguir "la contraseña que escribí no es la configurada" de
 * "la variable no está configurada", sin entrar al panel de Vercel.
 */
export const GET: APIRoute = async () => {
  const v = (k: string) => (import.meta.env as Record<string, string | undefined>)[k] || process.env[k] || '';
  // Consulta real a la base (solo cuenta filas): distingue "variable puesta" de "conexión que funciona".
  let base_de_datos = 'sin probar';
  try {
    const { error } = await sb().from('noticias').select('id', { count: 'exact', head: true });
    base_de_datos = error ? `error: ${error.message}` : 'ok';
  } catch (e) { base_de_datos = `error: ${(e as Error).message}`; }
  const body = {
    supabase_url: Boolean(v('SUPABASE_URL')),
    supabase_service_key: Boolean(v('SUPABASE_SERVICE_KEY')),
    admin_password: Boolean(v('ADMIN_PASSWORD')),
    auth_secret_ok: v('AUTH_SECRET').length >= 16,
    base_de_datos,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
