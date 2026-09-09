/**
 * Cifrado reversible (AES-256-GCM) para la contraseña del portal de cada cliente: GEMPRO la
 * necesita VER para volver a compartirla por WhatsApp, así que además del hash (que sirve para
 * verificar) se guarda cifrada con una clave derivada de AUTH_SECRET. Si AUTH_SECRET cambia,
 * las cifradas dejan de poder leerse: descifrar() devuelve null y el panel ofrece fijar una nueva.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function clave(): Buffer {
  const s = (import.meta.env.AUTH_SECRET || process.env.AUTH_SECRET) || '';
  if (s.length < 16) throw new Error('Falta AUTH_SECRET');
  return createHash('sha256').update('gempro-cifrado:' + s).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', clave(), iv);
  const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('hex')).join('.');
}

export function descifrar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    const [iv, tag, enc] = valor.split('.').map((h) => Buffer.from(h, 'hex'));
    const d = createDecipheriv('aes-256-gcm', clave(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
