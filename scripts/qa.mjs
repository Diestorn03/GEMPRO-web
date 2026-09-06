// Control de calidad completo: compila, levanta el servidor, corre Playwright, capturas y Lighthouse.
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';

const PORT = process.env.PORT || '4321';
const base = `http://127.0.0.1:${PORT}`;
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, ...env } });

if (!process.argv.includes('--no-build')) {
  const b = run(npx, ['astro', 'build']);
  if (b.status !== 0) process.exit(b.status);
}

const server = spawn('node', ['server.mjs'], { env: { ...process.env, HOST: '127.0.0.1', PORT }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(base); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}

let status = 0;
try {
  const t = run(npx, ['playwright', 'test'], { BASE_URL: base });
  status = t.status ?? 1;
  run('node', ['scripts/capturas.mjs'], { BASE_URL: base });

  if (!process.argv.includes('--no-lighthouse')) {
    const { default: lighthouse } = await import('lighthouse');
    mkdirSync('capturas', { recursive: true });
    for (const [name, preset] of [['movil', undefined], ['escritorio', 'desktop']]) {
      // Chromium de Playwright con puerto de depuración; Lighthouse se conecta a él.
      const port = 9222 + (name === 'movil' ? 0 : 1);
      const browser = await chromium.launch({ args: [`--remote-debugging-port=${port}`] });
      const flags = { port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
      const config = preset ? { extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1 } } } : undefined;
      let result;
      try { result = await lighthouse(`${base}/`, flags, config); } finally { await browser.close(); }
      const lhr = result.lhr;
      writeFileSync(`capturas/lighthouse-${name}.json`, result.report);
      const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]));
      const a = lhr.audits;
      console.log(`
LIGHTHOUSE ${name.toUpperCase()}:`, JSON.stringify(scores));
      for (const k of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'total-byte-weight']) console.log(`  ${k}: ${a[k]?.displayValue}`);
      const fails = Object.values(lhr.categories).flatMap((c) => c.auditRefs.map((r) => a[r.id]).filter((au) => au && au.score !== null && au.score < 0.9 && au.scoreDisplayMode !== 'informative')).map((au) => `  - ${au.id}: ${au.title} (${au.displayValue || ''})`);
      console.log(`  auditorías por debajo de 0,9:\n${[...new Set(fails)].join('\n') || '  (ninguna)'}`);
    }
  }
} finally {
  server.kill();
}
process.exit(status);
