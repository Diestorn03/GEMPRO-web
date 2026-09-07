import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

/** Cliente de Supabase para usar SOLO en el servidor (rutas /api/*, páginas con prerender=false):
 *  usa la service_role key, que puede saltarse RLS, y nunca debe llegar al navegador. */
export function sb(): SupabaseClient {
  if (!cliente) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY');
    cliente = createClient(url, key, { auth: { persistSession: false } });
  }
  return cliente;
}

export function nuevoToken(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}
export function nuevaSal(): string {
  return crypto.randomUUID();
}
