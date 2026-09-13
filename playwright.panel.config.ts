import { defineConfig, devices } from '@playwright/test';

/**
 * Suite del panel privado, el portal de clientes, el evento y las API (tests/panel): casos reales
 * que crean, modifican y borran datos. Corre SIEMPRE contra el servidor de pruebas
 * (scripts/servidor-pruebas.mjs, puerto 4322, base de Supabase de pruebas), en serie (workers: 1)
 * porque hay reglas globales (un solo evento activo, límite de intentos por IP) que las pruebas
 * comparten. `npm run test:panel`.
 */
export default defineConfig({
  testDir: './tests/panel',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-panel' }]],
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'es-VE',
  },
  webServer: {
    command: 'node scripts/servidor-pruebas.mjs',
    url: 'http://127.0.0.1:4322/entrar',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } }],
});
