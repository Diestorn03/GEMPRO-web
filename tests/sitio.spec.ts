import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Recoge errores de consola y de red durante una prueba. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => { if (res.status() >= 400) errors.push(`http ${res.status()}: ${res.url()}`); });
  return errors;
}

const SECCIONES = ['inicio', 'sectores', 'servicios', 'proceso', 'cifras', 'equipos', 'adiestramiento', 'presencia', 'contacto'];

test.describe('Inicio', () => {
  test('carga sin errores y con todas las secciones', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/GEMPRO/);
    for (const id of SECCIONES) await expect(page.locator(`#${id}`), `sección #${id}`).toHaveCount(1);
    await expect(page.locator('h1')).toContainText(/Escuchamos/i);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('el sistema de movimiento arranca y revela el contenido al hacer scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/motion-ready/, { timeout: 8000 });
    // Al inicio, elementos fuera de pantalla siguen ocultos (opacidad 0)
    const proceso = page.locator('#proceso li').first();
    // Desplazar hasta cada sección y comprobar que su contenido queda visible
    for (const id of SECCIONES.slice(2)) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1200);
    const ocultos = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-group] > *, [data-split]'))
        .filter((el) => {
          const cs = getComputedStyle(el);
          return parseFloat(cs.opacity) < 0.95 || cs.visibility === 'hidden';
        })
        .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 40)}`)
    );
    expect(ocultos, `elementos que nunca aparecieron: ${ocultos.join(', ')}`).toEqual([]);
  });

  test('los contadores llegan a su valor final', async ({ page }) => {
    await page.goto('/');
    await page.locator('#cifras').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-count]').first()).toHaveText('+60', { timeout: 6000 });
  });

  test('todas las imágenes cargan y tienen alt definido', async ({ page }) => {
    await page.goto('/');
    for (const id of SECCIONES) await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
    const rotas = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !(img.complete && img.naturalWidth > 0))
        .map((img) => img.currentSrc || img.src)
    );
    expect(rotas, `imágenes rotas: ${rotas.join(', ')}`).toEqual([]);
    const sinAlt = await page.evaluate(() => Array.from(document.images).filter((i) => !i.hasAttribute('alt')).length);
    expect(sinAlt).toBe(0);
  });

  test('sin desplazamiento horizontal', async ({ page }) => {
    await page.goto('/');
    for (const id of SECCIONES) await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'el documento es más ancho que la ventana').toBeLessThanOrEqual(1);
  });

  test('la cabecera se oculta al bajar y reaparece al subir', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/motion-ready/);
    const nav = page.locator('[data-nav]');
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(900);
    await expect(nav).toHaveClass(/is-scrolled/);
    await expect(nav).toHaveClass(/is-hidden/);
    await page.mouse.wheel(0, -600);
    await page.waitForTimeout(900);
    await expect(nav).not.toHaveClass(/is-hidden/);
    test.skip(isMobile, 'el menú móvil se prueba aparte');
  });

  test('menú móvil abre, navega y cierra', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'solo móvil');
    await page.goto('/');
    const btn = page.locator('.menu-toggle');
    await expect(btn).toHaveAccessibleName(/abrir menú/i);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#menu-movil')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  test('los enlaces internos llevan a su sección', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/motion-ready/);
    await page.locator('a[href="#proceso"]').first().click();
    await page.waitForTimeout(1600);
    const top = await page.locator('#proceso').evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(160);
  });

  test('accesibilidad automática (axe) sin violaciones críticas', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000); // deja que el movimiento inicial termine
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const graves = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`), JSON.stringify(graves, null, 1)).toEqual([]);
  });

  test('respeta prefers-reduced-motion', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(800);
    const ocultos = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-reveal], [data-split]')).filter((el) => {
        const cs = getComputedStyle(el); return parseFloat(cs.opacity) < 0.95 || cs.visibility === 'hidden';
      }).length
    );
    expect(ocultos).toBe(0);
    await expect(page.locator('[data-count]').first()).toHaveText('+60');
    await ctx.close();
  });
});

test.describe('Formulario de contacto', () => {
  test('valida en el navegador y envía al servidor', async ({ page }) => {
    await page.goto('/#contacto');
    await page.locator('#contacto').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /enviar consulta/i }).click();
    await expect(page.locator('.form-error')).toBeVisible();

    await page.fill('#nombre', 'Prueba Automática');
    await page.fill('#empresa', 'Planta de pruebas');
    await page.fill('#correo', 'prueba@ejemplo.com');
    await page.fill('#telefono', '+58 414 0000000');
    await page.fill('#mensaje', 'Motor de 150 HP con vibración alta desde el cambio de rodamientos.');
    const respuesta = page.waitForResponse((r) => r.url().includes('/api/contacto'));
    await page.getByRole('button', { name: /enviar consulta/i }).click();
    const res = await respuesta;
    expect(res.status()).toBe(200);
    await expect(page.locator('.form-success')).toBeVisible();
    await expect(page.locator('.form-success')).toContainText('Recibido');
  });

  test('el endpoint rechaza datos inválidos', async ({ request }) => {
    const res = await request.post('/api/contacto', { data: { nombre: 'A', correo: 'no-es-correo', mensaje: 'corto' } });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(Object.keys(body.errores)).toEqual(expect.arrayContaining(['nombre', 'correo', 'mensaje']));
  });
});

test.describe('Servicios', () => {
  test('carga, tiene los cuatro ejes y navega desde el inicio con transición', async ({ page, isMobile }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    if (isMobile) {
      await page.locator('.menu-toggle').click();
      await page.locator('#menu-movil a[href="/servicios"]').click();
    } else {
      await page.locator('nav[aria-label="Principal"] a[href="/servicios"]').click();
    }
    await expect(page).toHaveURL(/\/servicios/);
    await expect(page.locator('h1')).toContainText(/síntoma/i);
    for (const id of ['predictivo', 'proactivo', 'preventivo', 'correctivo']) await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await expect(page.locator('html')).toHaveClass(/motion-ready/);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
