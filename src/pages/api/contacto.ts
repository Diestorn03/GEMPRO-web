/**
 * Endpoint del formulario de contacto. Antes escribía en data/mensajes.json — eso nunca
 * funcionó en producción: GitHub Pages no ejecuta esta ruta (ver commit de migración a
 * Vercel), y aunque hubiera corrido, el sistema de archivos de una función serverless no
 * persiste entre despliegues. Ahora inserta en la tabla `mensajes` de Supabase.
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { sb } from '../../lib/supabase';
import { bloqueado, ipDe, registrarIntento } from '../../lib/limite';
import { avisarConsultaPorCorreo } from '../../lib/correo';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);

export const POST: APIRoute = async (ctx) => {
  const { request } = ctx;
  const ip = ipDe(ctx);
  if (await bloqueado(ip, 'contacto', 10, 60)) return json({ ok: false, error: 'Demasiados mensajes desde esta conexión. Intente más tarde o escríbanos por WhatsApp.' }, 429);
  let data: Record<string, unknown> = {};
  const type = request.headers.get('content-type') || '';
  try {
    if (type.includes('application/json')) data = await request.json();
    else Object.assign(data, Object.fromEntries((await request.formData()).entries()));
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }

  // Honeypot: los bots suelen rellenar todos los campos.
  if (clean(data.empresa_web)) return json({ ok: true });

  const nombre = clean(data.nombre, 120);
  const empresa = clean(data.empresa, 120);
  const correo = clean(data.correo, 160);
  const telefono = clean(data.telefono, 40);
  const mensaje = clean(data.mensaje, 2000);

  const errores: Record<string, string> = {};
  if (nombre.length < 2) errores.nombre = 'Indique su nombre.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) errores.correo = 'Indique un correo válido.';
  if (mensaje.length < 10) errores.mensaje = 'Cuéntenos el equipo y el síntoma (mínimo 10 caracteres).';
  if (Object.keys(errores).length) return json({ ok: false, errores }, 422);

  try {
    const { error } = await sb().from('mensajes').insert({ nombre, empresa: empresa || null, correo, telefono: telefono || null, mensaje });
    if (error) throw error;
  } catch (err) {
    console.error('[contacto] no se pudo guardar el mensaje', err);
    return json({ ok: false, error: 'No pudimos registrar su mensaje. Escríbanos por WhatsApp.' }, 500);
  }

  // El mensaje ya quedó guardado arriba pase lo que pase de aquí en más: si el correo falla o no
  // está configurado, el cliente igual ve "Recibido" y la consulta no se pierde. Van en paralelo
  // (no uno detrás del otro) porque no dependen entre sí, pero la parte lenta de verdad es el
  // propio envío por Gmail (1-3 s de apretón de manos SMTP) — eso no se evita desde aquí, ver el
  // comentario al inicio de src/lib/correo.ts.
  // ponytail: mientras se prueba, los avisos van al correo de Diego, no al de GEMPRO (site.email).
  // Volver a `site.email` antes de darlo por listo para producción.
  await Promise.all([
    registrarIntento(ip, 'contacto'),
    avisarConsultaPorCorreo('cardozodiego512@gmail.com', { nombre, empresa, correo, telefono, mensaje }),
  ]);

  return json({ ok: true, mensaje: 'Recibido. Un ingeniero le responderá con una propuesta de medición.' });
};

export const GET: APIRoute = () => json({ ok: false, error: 'Use POST.' }, 405);
