// Capturas de pantalla del sitio compilado para revisión visual.
import { chromium, devices } from '@playwright/test';
const base = process.env.BASE_URL || 'http://127.0.0.1:4321';
const browser = await chromium.launch();
async function shoot(name, ctxOpts, path = '/') {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `capturas/${name}-01-portada.png` });
  // desplazamiento progresivo para disparar todas las entradas
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const vh = ctxOpts.viewport?.height || 900;
  let i = 2;
  for (let y = vh * 0.9; y < h; y += vh * 0.9) {
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: 'auto' }), y);
    await page.waitForTimeout(900);
    if (i <= 9) await page.screenshot({ path: `capturas/${name}-0${i}.png` });
    i++;
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `capturas/${name}-00-completa.png`, fullPage: true });
  await ctx.close();
}
await shoot('escritorio', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await shoot('movil', { ...devices['Pixel 7'] });
await shoot('servicios', { viewport: { width: 1440, height: 900 } }, '/servicios');
await browser.close();
console.log('ok');
