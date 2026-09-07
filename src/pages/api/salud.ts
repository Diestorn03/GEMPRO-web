export const prerender = false;

import type { APIRoute } from 'astro';

/**
 * Chequeo de configuración en producción. NO expone valores, solo si cada variable llegó al
 * servidor — sirve para distinguir "la contraseña que escribí no es la configurada" de
 * "la variable no está configurada", sin entrar al panel de Vercel.
 */
export const GET: APIRoute = () => {
  const v = (k: string) => (import.meta.env as Record<string, string | undefined>)[k] || process.env[k] || '';
  const body = {
    supabase_url: Boolean(v('SUPABASE_URL')),
    supabase_service_key: Boolean(v('SUPABASE_SERVICE_KEY')),
    admin_password: Boolean(v('ADMIN_PASSWORD')),
    auth_secret_ok: v('AUTH_SECRET').length >= 16,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
