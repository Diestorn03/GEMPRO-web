export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE, SESION_SEGUNDOS, contrasenaCorrecta, opcionesCookie, valorCookie } from '../../lib/auth';
import { bloqueado, ipDe, registrarIntento } from '../../lib/limite';

export const POST: APIRoute = async (ctx) => {
  const { request, cookies, redirect, url } = ctx;
  const ip = ipDe(ctx);
  if (await bloqueado(ip, 'entrar')) return redirect('/entrar?error=2', 303);
  const form = await request.formData();
  const intento = String(form.get('password') ?? '');
  if (!contrasenaCorrecta(intento)) { await registrarIntento(ip, 'entrar'); return redirect('/entrar?error=1', 303); }
  const recordar = form.get('recordar') === 'on';
  cookies.set(COOKIE, valorCookie(recordar), opcionesCookie(url, recordar ? SESION_SEGUNDOS : undefined));
  return redirect('/panel', 303);
};
