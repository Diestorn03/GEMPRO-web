export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE, contrasenaCorrecta, valorCookie } from '../../lib/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const intento = String(form.get('password') ?? '');
  if (!contrasenaCorrecta(intento)) return redirect('/entrar?error=1', 303);
  cookies.set(COOKIE, valorCookie(), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return redirect('/panel', 303);
};
