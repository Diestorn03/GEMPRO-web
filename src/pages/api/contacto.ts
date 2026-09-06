/**
 * Endpoint del formulario de contacto.
 * En local guarda cada consulta en data/mensajes.json y responde con éxito.
 * Para producción, sustituir el bloque "guardar" por el envío de correo (Resend, Formspree, SMTP).
 */
export const prerender = false;

import type { APIRoute } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'data', 'mensajes.json');

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

const clean = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);

export const POST: APIRoute = async ({ request }) => {
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

  const registro = { fecha: new Date().toISOString(), nombre, empresa, correo, telefono, mensaje };

  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    let lista: unknown[] = [];
    try { lista = JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { lista = []; }
    if (!Array.isArray(lista)) lista = [];
    lista.push(registro);
    await fs.writeFile(FILE, JSON.stringify(lista, null, 2), 'utf8');
  } catch (err) {
    console.error('[contacto] no se pudo guardar el mensaje', err);
    return json({ ok: false, error: 'No pudimos registrar su mensaje. Escríbanos por WhatsApp.' }, 500);
  }

  return json({ ok: true, mensaje: 'Recibido. Un ingeniero le responderá con una propuesta de medición.' });
};

export const GET: APIRoute = () => json({ ok: false, error: 'Use POST.' }, 405);
