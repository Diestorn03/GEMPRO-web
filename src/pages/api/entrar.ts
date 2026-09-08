export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE, contrasenaCorrecta, opcionesCookie, valorCookie } from '../../lib/auth';
import { bloqueado, ipDe, registrarIntento } from '../../lib/limite';

export const POST: APIRoute = async (ctx) => {
  const { request, cookies, redirect, url } = ctx;
  const ip = ipDe(ctx);
  if (await bloqueado(ip, 'entrar')) return redirect('/entrar?error=2', 303);
  const form = await request.formData();
  const intento = String(form.get('password') ?? '');
  if (!contrasenaCorrecta(intento)) { await registrarIntento(ip, 'entrar'); return redirect('/entrar?error=1', 303); }
  cookies.set(COOKIE, valorCookie(), opcionesCookie(url));
  return redirect('/panel', 303);
};
