export const prerender = false;

import type { APIRoute } from 'astro';
import { estaAutenticado } from '../../../lib/auth';
import { sb } from '../../../lib/supabase';

const BUCKET = 'informes-tecnicos';
const MAX = 20 * 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
const limpio = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

/**
 * Subida en dos pasos SIN que el archivo pase por Vercel (tope de 4,5 MB por petición; los
 * informes reales lo superan): `firmar` devuelve una URL de subida firmada de Supabase Storage y el
 * navegador hace el PUT directo; `registrar` comprueba que el objeto existe y guarda la fila.
 * `eliminar` sigue siendo un formulario normal.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const esJson = request.headers.get('content-type')?.includes('application/json');
  if (!estaAutenticado(cookies)) return esJson ? json({ error: 'Sin sesión' }, 401) : redirect('/entrar', 303);

  if (esJson) {
    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const clienteId = String(b.cliente_id ?? '');
    if (!UUID.test(clienteId)) return json({ error: 'Cliente inválido' }, 400);
    const { data: cliente } = await sb().from('clientes').select('id').eq('id', clienteId).maybeSingle();
    if (!cliente) return json({ error: 'El cliente no existe' }, 404);
    const nombre = String(b.nombre_archivo ?? '').trim().slice(0, 200);
    if (!nombre) return json({ error: 'Falta el nombre del archivo' }, 400);

    if (b._accion === 'firmar') {
      const tamano = Number(b.tamano ?? 0);
      if (tamano > MAX) return json({ error: `supera los 20 MB (${(tamano / 1048576).toFixed(1)} MB)` }, 413);
      const ruta = `${clienteId}/${Date.now()}-${limpio(nombre)}`;
      const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(ruta);
      if (error || !data) { console.error('[panel/informes] no se pudo firmar', error); return json({ error: 'no se pudo preparar la subida' }, 500); }
      return json({ url: data.signedUrl, ruta });
    }

    if (b._accion === 'registrar') {
      const ruta = String(b.ruta_storage ?? '');
      if (!ruta.startsWith(`${clienteId}/`)) return json({ error: 'ruta inválida' }, 400);
      const archivo = ruta.slice(clienteId.length + 1);
      const { data: lista } = await sb().storage.from(BUCKET).list(clienteId, { search: archivo, limit: 10 });
      if (!lista?.some((o) => o.name === archivo)) return json({ error: 'el archivo no llegó a Storage' }, 409);
      const { error } = await sb().from('informes').insert({ cliente_id: clienteId, nombre_archivo: nombre, ruta_storage: ruta });
      if (error) { console.error('[panel/informes] no se pudo registrar', error); return json({ error: 'no se pudo guardar el informe' }, 500); }
      return json({ ok: true });
    }
    return json({ error: 'acción desconocida' }, 400);
  }

  const form = await request.formData();
  const clienteId = String(form.get('cliente_id') ?? '');
  if (String(form.get('_accion') ?? '') === 'eliminar') {
    const id = String(form.get('id') ?? '');
    const ruta = String(form.get('ruta_storage') ?? '');
    if (id) {
      if (ruta) await sb().storage.from(BUCKET).remove([ruta]);
      await sb().from('informes').delete().eq('id', id);
    }
  }
  return redirect(`/panel/${clienteId}`, 303);
};
