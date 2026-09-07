export const prerender = false;

import type { APIRoute } from 'astro';
import { COOKIE } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(COOKIE, { path: '/' });
  return redirect('/entrar', 303);
};
