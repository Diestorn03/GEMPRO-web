import { test, expect } from '@playwright/test';
import { ENV, BASE, ORIGEN, entrar, entrarOk, entrarPagina, limpiarTodo, sb } from './util';

test.afterAll(async () => { await limpiarTodo(); });

const PRIVADAS = ['/panel', '/panel/noticias', '/panel/evento', '/panel/00000000-0000-0000-0000-000000000000'];
for (const ruta of PRIVADAS) {
  test(`sin sesión, ${ruta} redirige a /entrar`, async ({ request }) => {
    const res = await request.get(ruta, { maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toBe('/entrar');
  });
}

test('sin sesión, las API del panel no hacen nada', async ({ request }) => {
  expect((await request.get('/api/panel/evento?evento=00000000-0000-0000-0000-000000000000')).status()).toBe(401);
  expect((await request.get('/api/panel/qr?formato=png', { maxRedirects: 0 })).headers()['location']).toBe('/entrar');
  expect((await request.post('/api/panel/informes', { data: { _accion: 'firmar' }, headers: ORIGEN })).status()).toBe(401);
  for (const ruta of ['/api/panel/clientes', '/api/panel/noticias', '/api/panel/evento']) {
    const res = await request.post(ruta, { form: { _accion: 'eliminar', id: 'x' }, headers: ORIGEN, maxRedirects: 0 });
    expect(res.status(), ruta).toBe(303);
    expect(res.headers()['location'], ruta).toBe('/entrar');
  }
});

test.describe('Inicio de sesión del panel', () => {
  test('contraseña incorrecta: vuelve a /entrar con error=1 y sin cookie', async ({ request }) => {
    const res = await entrar(request, 'no-es-la-clave');
    expect(res.status()).toBe(303);
    expect(res.headers()['location']).toBe('/entrar?error=1');
    expect(res.headers()['set-cookie'] ?? '').not.toContain('gp_sesion=');
    expect((await request.get('/panel', { maxRedirects: 0 })).status()).toBe(303);
  });
  test('contraseña vacía → error=1', async ({ request }) => {
    expect((await entrar(request, '')).headers()['location']).toBe('/entrar?error=1');
  });
  test('contraseña correcta con espacios alrededor → entra igual', async ({ request }) => {
    expect((await entrar(request, `  ${ENV.ADMIN_PASSWORD}  `)).headers()['location']).toBe('/panel');
  });
  test('contraseña correcta: entra y la cookie es HttpOnly, SameSite=Lax y sin Max-Age', async ({ request }) => {
    const res = await entrar(request);
    expect(res.headers()['location']).toBe('/panel');
    const cookie = res.headers()['set-cookie'] ?? '';
    expect(cookie).toContain('gp_sesion=');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Max-Age/i);
    const panel = await request.get('/panel');
    expect(panel.status()).toBe(200);
    expect(await panel.text()).toContain('Cada cliente, su carpeta');
  });
  test('con "recordar este dispositivo" la cookie dura 30 días', async ({ request }) => {
    const res = await entrar(request, ENV.ADMIN_PASSWORD, true);
    expect(res.headers()['set-cookie'] ?? '').toMatch(/Max-Age=2592000/);
  });
  test('sin cabecera Origin el formulario se rechaza (CSRF)', async ({ request }) => {
    const res = await request.post('/api/entrar', { form: { password: ENV.ADMIN_PASSWORD }, maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });
  test('con Origin de otro sitio el formulario se rechaza (CSRF)', async ({ request }) => {
    const res = await request.post('/api/entrar', { form: { password: ENV.ADMIN_PASSWORD }, headers: { origin: 'https://atacante.example' }, maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });
  test('salir borra la cookie y el panel vuelve a pedir acceso', async ({ request }) => {
    await entrarOk(request);
    const res = await request.post('/api/salir', { form: {}, headers: ORIGEN, maxRedirects: 0 });
    expect(res.headers()['location']).toBe('/entrar');
    expect((await request.get('/panel', { maxRedirects: 0 })).status()).toBe(303);
  });
  test('salir con la cabecera ajax devuelve 204 y la ruta en X-Redirigir', async ({ request }) => {
    await entrarOk(request);
    const res = await request.post('/api/salir', { form: {}, headers: { ...ORIGEN, 'x-peticion-ajax': '1' }, maxRedirects: 0 });
    expect(res.status()).toBe(204);
    expect(res.headers()['x-redirigir']).toBe('/entrar');
  });
});

test.describe('Cookies manipuladas', () => {
  test('firma alterada → no entra', async ({ page }) => {
    await page.context().addCookies([{ name: 'gp_sesion', value: `${Date.now() + 3600e3}.0000deadbeef`, url: BASE }]);
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/entrar$/);
  });
  test('vencimiento pasado con formato válido → no entra', async ({ page }) => {
    await page.context().addCookies([{ name: 'gp_sesion', value: `${Date.now() - 1000}.abc`, url: BASE }]);
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/entrar$/);
  });
  test('valor vacío o basura → no entra ni rompe', async ({ page }) => {
    for (const valor of ['', 'basura', '...', '1.2.3.4']) {
      await page.context().clearCookies();
      if (valor) await page.context().addCookies([{ name: 'gp_sesion', value: valor, url: BASE }]);
      await page.goto('/panel');
      await expect(page).toHaveURL(/\/entrar$/);
    }
  });
});

test.describe('Límite de intentos', () => {
  test.afterEach(async () => { await sb().from('intentos_acceso').delete().eq('ruta', 'entrar'); });
  test('tras 10 fallos, el 11º intento da error=2 aunque la contraseña sea correcta', async ({ request }) => {
    for (let i = 1; i <= 10; i++) expect((await entrar(request, `mala-${i}`)).headers()['location'], `intento ${i}`).toBe('/entrar?error=1');
    expect((await entrar(request)).headers()['location']).toBe('/entrar?error=2');
    const { count } = await sb().from('intentos_acceso').select('*', { count: 'exact', head: true }).eq('ruta', 'entrar');
    expect(count).toBe(10);
  });
  test('al limpiar los intentos vuelve a entrar', async ({ request }) => {
    for (let i = 1; i <= 10; i++) await entrar(request, 'mala');
    await sb().from('intentos_acceso').delete().eq('ruta', 'entrar');
    expect((await entrar(request)).headers()['location']).toBe('/panel');
  });
  test('la página /entrar explica el bloqueo', async ({ page }) => {
    await page.goto('/entrar?error=2');
    await expect(page.getByRole('alert')).toContainText('Demasiados intentos');
  });
});

test.describe('Diagnóstico y cron', () => {
  test('/api/salud: sin clave 401, clave incorrecta 401, clave correcta 200 con todo ok', async ({ request }) => {
    expect((await request.get('/api/salud')).status()).toBe(401);
    expect((await request.get('/api/salud?clave=incorrecta')).status()).toBe(401);
    const res = await request.get(`/api/salud?clave=${encodeURIComponent(ENV.AUTH_SECRET)}`);
    expect(res.status()).toBe(200);
    const salud = await res.json();
    expect(salud.base_de_datos).toBe('ok');
    expect(salud.limite_intentos).toBe('ok');
    expect(salud.fase6).toBe('ok');
    expect(salud.fase9).toBe('ok');
    expect(salud.fase10).toBe('ok');
    expect(salud.auth_secret_ok).toBe(true);
    expect(salud.admin_password_con_espacios).toBe(false);
  });
  test('/api/salud acepta la clave por cabecera Authorization', async ({ request }) => {
    expect((await request.get('/api/salud', { headers: { authorization: `Bearer ${ENV.AUTH_SECRET}` } })).status()).toBe(200);
  });
  test('/api/salud con sesión del panel y sin clave → 200', async ({ request }) => {
    await entrarOk(request);
    expect((await request.get('/api/salud')).status()).toBe(200);
  });
  test('/api/latido en local (sin VERCEL) responde y deja un solo latido', async ({ request }) => {
    expect((await request.get('/api/latido')).status()).toBe(200);
    expect((await request.get('/api/latido')).status()).toBe(200);
    const { count } = await sb().from('intentos_acceso').select('*', { count: 'exact', head: true }).eq('ruta', 'latido');
    expect(count).toBe(1);
  });
});

test.describe('Cabeceras', () => {
  for (const ruta of ['/entrar', '/panel', '/c/token-inexistente', '/api/panel/evento?evento=x']) {
    test(`${ruta} lleva cabeceras de seguridad y no se cachea`, async ({ request }) => {
      const res = await request.get(ruta, { maxRedirects: 0 });
      const h = res.headers();
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      if (!ruta.startsWith('/api')) expect(h['cache-control']).toContain('no-store');
    });
  }
  test('/entrar pide noindex a los buscadores', async ({ request }) => {
    expect(await (await request.get('/entrar')).text()).toContain('name="robots" content="noindex, nofollow"');
  });
});

test.describe('Pantalla de acceso (navegador)', () => {
  test('contraseña incorrecta muestra el aviso y correcta lleva al panel', async ({ page }) => {
    await entrarPagina(page, 'incorrecta');
    await expect(page.getByRole('alert')).toContainText('Contraseña incorrecta');
    await entrarPagina(page);
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.locator('main h1')).toContainText('Cada cliente');
  });
  test('el botón del ojo muestra y oculta la contraseña', async ({ page }) => {
    await page.goto('/entrar');
    await page.fill('#password', 'abc');
    await page.click('#ver-contrasena');
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
    await page.click('#ver-contrasena');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
  });
  test('el menú del panel navega entre las tres secciones y "Salir" cierra la sesión', async ({ page }) => {
    await entrarPagina(page);
    await page.getByRole('link', { name: 'Noticias' }).click();
    await expect(page).toHaveURL(/\/panel\/noticias$/);
    await page.getByRole('link', { name: 'Evento' }).click();
    await expect(page).toHaveURL(/\/panel\/evento$/);
    await page.getByRole('link', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/entrar$/);
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/entrar$/);
  });
});
