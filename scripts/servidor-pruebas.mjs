/**
 * Servidor de desarrollo para la suite de pruebas del panel (tests/panel): mismo código, pero
 * apuntando al proyecto de Supabase de PRUEBAS definido en .env.pruebas (nunca al de producción).
 * Astro carga .env.pruebas por `--mode pruebas`; además se pasan las variables por entorno.
 * Corre en el puerto 4322 para no chocar con `npm run dev` (4321).
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const REF_PRODUCCION = 'bcasqdjkilnefnqgfbnh';
if (!existsSync('.env.pruebas')) {
  console.error('Falta .env.pruebas: copiar la URL y la service_role key del proyecto de Supabase de PRUEBAS (ver README).');
  process.exit(1);
}
const env = {};
for (const linea of readFileSync('.env.pruebas', 'utf8').split(/\r?\n/)) {
  const l = linea.trim();
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.ADMIN_PASSWORD || !env.AUTH_SECRET) {
  console.error('.env.pruebas incompleto: hacen falta SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD y AUTH_SECRET.');
  process.exit(1);
}
if (env.SUPABASE_URL.includes(REF_PRODUCCION)) {
  console.error('.env.pruebas apunta a la base de PRODUCCIÓN. Las pruebas crean y borran datos: no se corre.');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// ASTRO_DEV_BACKGROUND: Astro 7 manda el servidor a segundo plano cuando detecta un agente de IA;
// con esta variable puesta cree que ya es el proceso de fondo y se queda en primer plano, que es
// lo que Playwright necesita. --ignore-lock: convive con el `astro dev` normal del puerto 4321.
const hijo = spawn(npx, ['astro', 'dev', '--mode', 'pruebas', '--port', '4322', '--host', '127.0.0.1', '--ignore-lock'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, ...env, ASTRO_DEV_BACKGROUND: '1' },
});
hijo.on('exit', (codigo) => process.exit(codigo ?? 0));
