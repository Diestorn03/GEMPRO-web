import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo. BASE_URL permite apuntar a un servidor ya levantado (por
 * ejemplo, un despliegue de Vercel); si no, Playwright arranca `astro dev` en local. No
 * `astro preview`: el adaptador de Vercel no lo soporta (no hay servidor único que levantar
 * fuera de Vercel), así que se prueba contra las mismas rutas de servidor vía dev.
 */
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-VE',
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx astro dev --port 4321 --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
});
