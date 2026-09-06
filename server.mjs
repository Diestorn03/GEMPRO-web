/**
 * Servidor local de producción: Express + compresión (gzip/brotli) + caché de estáticos.
 * Sirve el sitio compilado (dist/client) y delega /api/* al manejador de Astro.
 *
 *   npm run build && npm run preview  ->  http://127.0.0.1:4321
 */
import express from 'express';
import compression from 'compression';
import { handler as ssrHandler } from './dist/server/entry.mjs';

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4321);

app.disable('x-powered-by');
app.use(compression({ threshold: 512 }));

// Recursos con hash: caché de un año.
app.use('/_astro', express.static('dist/client/_astro', { maxAge: '1y', immutable: true, fallthrough: false }));
// Páginas pregeneradas (formato archivo: /servicios -> servicios.html) y demás estáticos.
app.use(express.static('dist/client', { extensions: ['html'], maxAge: '5m', etag: true }));
// Rutas bajo demanda (formulario).
app.use(ssrHandler);

app.listen(PORT, HOST, () => {
  console.log(`GEMPRO listo en http://${HOST}:${PORT}`);
});
