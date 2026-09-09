export const prerender = false;

import type { APIRoute } from 'astro';
import { sb } from '../../lib/supabase';
import { descifrar } from '../../lib/cifrado';

/**
 * Chequeo de configuración en producción. NO expone valores, solo si cada variable llegó al
 * servidor — sirve para distinguir "la contraseña que escribí no es la configurada" de
 * "la variable no está configurada", sin entrar al panel de Vercel.
 */
export const GET: APIRoute = async () => {
  const v = (k: string) => (import.meta.env as Record<string, string | undefined>)[k] || process.env[k] || '';
  // Consulta real a la base (solo cuenta filas): distingue "variable puesta" de "conexión que funciona".
  let base_de_datos = 'sin probar';
  let latencia_bd_ms = -1;
  const clave = v('SUPABASE_SERVICE_KEY');
  const claveEnmascarada = /[•*]/.test(clave) || (clave.length > 0 && clave.length < 100);
  try {
    if (claveEnmascarada) throw new Error('SUPABASE_SERVICE_KEY parece pegada enmascarada o incompleta (contiene "•" o es muy corta). Copiar la clave completa desde Supabase → Project Settings → API → service_role → "Reveal".');
    const t0 = Date.now();
    const { error } = await sb().from('noticias').select('id', { count: 'exact', head: true });
    latencia_bd_ms = Date.now() - t0;
    base_de_datos = error ? `error: ${error.message}` : 'ok';
  } catch (e) { base_de_datos = `error: ${(e as Error).message}`; }
  let limite_intentos = 'sin probar hasta que base_de_datos sea ok';
  let ultimo_latido: string | null = null;
  let fase6 = 'sin probar hasta que base_de_datos sea ok';
  let contrasenas_visibles = 'sin probar';
  if (base_de_datos === 'ok') {
    const { data: latido, error: errLimite } = await sb().from('intentos_acceso').select('creado_en').eq('ruta', 'latido').order('creado_en', { ascending: false }).limit(1).maybeSingle();
    limite_intentos = errLimite ? 'falta la tabla intentos_acceso: ejecutar supabase/fase5-limite.sql en el SQL Editor de Supabase' : 'ok';
    ultimo_latido = latido?.creado_en ?? null;
    const [{ data: cifrado, error: errCol }, { error: errEventos }] = await Promise.all([
      sb().from('clientes').select('password_cifrada').not('password_cifrada', 'is', null).limit(1).maybeSingle(),
      sb().from('eventos').select('id', { count: 'exact', head: true }),
    ]);
    fase6 = errCol || errEventos ? 'falta ejecutar supabase/fase6-clientes-eventos.sql en el SQL Editor de Supabase' : 'ok';
    contrasenas_visibles = errCol ? 'sin probar' : !cifrado ? 'ningún cliente tiene contraseña guardada todavía' : descifrar(cifrado.password_cifrada) ? 'ok' : 'AUTH_SECRET cambió: asignar contraseñas nuevas desde el panel';
  }
  const body = {
    region: process.env.VERCEL_REGION || 'local',
    latencia_bd_ms,
    limite_intentos,
    ultimo_latido,
    fase6,
    contrasenas_visibles,
    supabase_url: Boolean(v('SUPABASE_URL')),
    supabase_service_key: Boolean(v('SUPABASE_SERVICE_KEY')),
    admin_password: Boolean(v('ADMIN_PASSWORD')),
    admin_password_con_espacios: v('ADMIN_PASSWORD') !== v('ADMIN_PASSWORD').trim(),
    auth_secret_ok: v('AUTH_SECRET').length >= 16,
    base_de_datos,
  };
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
