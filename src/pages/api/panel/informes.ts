export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { sb } from '../../../lib/supabase';

const BUCKET = 'informes-tecnicos';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!estaAutenticado(cookies)) return redirect('/entrar', 303);
  const form = await request.formData();
  const accion = String(form.get('_accion') ?? 'subir');
  const clienteId = String(form.get('cliente_id') ?? '');
  const volver = redirect(`/panel/${clienteId}`, 303);

  if (accion === 'eliminar') {
    const id = String(form.get('id') ?? '');
    const ruta = String(form.get('ruta_storage') ?? '');
    if (id) {
      if (ruta) await sb().storage.from(BUCKET).remove([ruta]);
      await sb().from('informes').delete().eq('id', id);
    }
    return volver;
  }

  const archivos = form.getAll('archivos').filter((a): a is File => a instanceof File && a.size > 0);
  for (const archivo of archivos) {
    if (archivo.size > 20 * 1024 * 1024) continue; // 20MB por archivo
    const ruta = `${clienteId}/${Date.now()}-${archivo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: errSubida } = await sb().storage.from(BUCKET).upload(ruta, archivo, { contentType: archivo.type || 'application/octet-stream' });
    if (errSubida) { console.error('[panel/informes] no se pudo subir', errSubida); continue; }
    await sb().from('informes').insert({ cliente_id: clienteId, nombre_archivo: archivo.name, ruta_storage: ruta });
  }
  return volver;
};
