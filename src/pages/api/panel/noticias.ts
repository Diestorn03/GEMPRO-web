export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { sb } from '../../../lib/supabase';

const BUCKET = 'noticias-imagenes';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const accion = String(form.get('_accion') ?? 'guardar');
  const volver = redirect('/panel/noticias', 303);

  if (accion === 'eliminar') {
    const id = String(form.get('id') ?? '');
    const imagenUrl = String(form.get('imagen_url') ?? '');
    if (id) {
      if (imagenUrl) {
        const ruta = imagenUrl.split(`${BUCKET}/`)[1];
        if (ruta) await sb().storage.from(BUCKET).remove([ruta]);
      }
      await sb().from('noticias').delete().eq('id', id);
    }
    return volver;
  }

  const id = String(form.get('id') ?? '');
  const titulo = String(form.get('titulo') ?? '').trim().slice(0, 160);
  const contenido = String(form.get('contenido') ?? '').trim().slice(0, 8000);
  const publicado = form.get('publicado') === 'on';
  const volverError = (e: string) => redirect(id ? `/panel/noticias?editar=${id}&error=${e}` : `/panel/noticias?nueva=1&error=${e}`, 303);
  if (!titulo || !contenido) return volverError('1');

  let imagenUrl = String(form.get('imagen_actual') ?? '') || null;
  const imagen = form.get('imagen');
  // Vercel corta las peticiones en 4,5 MB; el navegador reduce las fotos a 1600 px antes de enviarlas.
  if (imagen instanceof File && imagen.size > 0 && (imagen.size > 4 * 1024 * 1024 || !imagen.type.startsWith('image/'))) return volverError('imagen');
  if (imagen instanceof File && imagen.size > 0) {
    const ruta = `${Date.now()}-${imagen.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: errSubida } = await sb().storage.from(BUCKET).upload(ruta, imagen, { contentType: imagen.type });
    if (!errSubida) imagenUrl = sb().storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  }

  const datos = { titulo, contenido, imagen_url: imagenUrl, publicado };
  const { error } = id
    ? await sb().from('noticias').update(datos).eq('id', id)
    : await sb().from('noticias').insert(datos);
  if (error) { console.error('[panel/noticias] no se pudo guardar', error); return volverError('1'); }
  return volver;
};
