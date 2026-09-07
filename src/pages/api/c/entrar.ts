export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE_CLIENTE, contrasenaClienteCorrecta, valorCookieCliente } from '../../../lib/auth';
import { sb } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const password = String(form.get('password') ?? '');
  const volverError = redirect(`/c/${token}?error=1`, 303);
  if (!token || !password) return volverError;

  const { data: cliente } = await sb().from('clientes').select('id, password_sal, password_hash').eq('token', token).maybeSingle();
  if (!cliente || !contrasenaClienteCorrecta(password, cliente.password_sal, cliente.password_hash)) return volverError;

  cookies.set(COOKIE_CLIENTE, valorCookieCliente(cliente.id), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return redirect(`/c/${token}`, 303);
};
