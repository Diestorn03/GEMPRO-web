import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo contra el sitio compilado (npm run build) servido por Node.
 * BASE_URL permite apuntar a un servidor ya levantado; si no, Playwright arranca uno.
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
        command: 'node server.mjs',
        url: baseURL,
        reuseExistingServer: true,
        env: { HOST: '127.0.0.1', PORT: '4321' },
        timeout: 60_000,
      },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
});
