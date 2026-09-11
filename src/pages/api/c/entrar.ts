export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE_CLIENTE, SESION_SEGUNDOS, contrasenaClienteCorrecta, opcionesCookie, valorCookieCliente } from '../../../lib/auth';
import { bloqueado, ipDe, registrarIntento } from '../../../lib/limite';
import { sb } from '../../../lib/supabase';

export const POST: APIRoute = async (ctx) => {
  const { request, cookies, redirect, url } = ctx;
  const form = await request.formData();
  const token = String(form.get('token') ?? '').replace(/[^a-z0-9]/g, '');
  const password = String(form.get('password') ?? '');
  if (!token || !password) return redirect(`/c/${token}?error=1`, 303);

  const ip = ipDe(ctx);
  if (await bloqueado(ip, 'cliente')) return redirect(`/c/${token}?error=2`, 303);

  const { data: cliente } = await sb().from('clientes').select('id, password_sal, password_hash').eq('token', token).maybeSingle();
  if (!cliente || !contrasenaClienteCorrecta(password, cliente.password_sal, cliente.password_hash)) {
    await registrarIntento(ip, 'cliente');
    return redirect(`/c/${token}?error=1`, 303);
  }

  // Sin marcar "recordar este dispositivo": sesión corta y la cookie se borra al cerrar el navegador.
  const recordar = form.get('recordar') === 'on';
  cookies.set(COOKIE_CLIENTE, valorCookieCliente(cliente.id, cliente.password_sal, recordar), opcionesCookie(url, recordar ? SESION_SEGUNDOS : undefined));
  return redirect(`/c/${token}`, 303);
};
