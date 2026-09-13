import { test, expect } from '@playwright/test';
import { PNG_1PX, PDF_MINIMO, archivo, crearNoticia, destino, entrarOk, entrarPagina, formulario, limpiarTodo, nombrePrueba, sb } from './util';

test.beforeEach(async ({ request }) => { await entrarOk(request); });
test.afterAll(async () => { await limpiarTodo(); });

test.describe('Noticias', () => {
  test('publicada: aparece en /noticias y su detalle muestra los párrafos', async ({ request }) => {
    const n = await crearNoticia(request, { contenido: 'Uno.\n\nDos.\n   \nTres.' });
    const lista = await (await request.get('/noticias')).text();
    expect(lista).toContain(n.titulo);
    expect(lista).toContain(`/noticias/${n.id}`);
    const detalle = await request.get(`/noticias/${n.id}`);
    expect(detalle.status()).toBe(200);
    const html = await detalle.text();
    expect(html).toContain(n.titulo);
    expect((html.match(/<p class="text-\[17px\] leading-relaxed text-fog">/g) ?? []).length).toBe(3);
  });
  test('oculta: no aparece en /noticias y el detalle devuelve a la lista', async ({ request }) => {
    const n = await crearNoticia(request, { publicado: false });
    expect(await (await request.get('/noticias')).text()).not.toContain(n.titulo);
    expect(destino(await request.get(`/noticias/${n.id}`, { maxRedirects: 0 }))).toBe('/noticias');
    expect(await (await request.get('/panel/noticias')).text()).toContain('oculta');
  });
  test('con foto PNG: queda en el bucket público y se ve en la lista y en el detalle', async ({ request }) => {
    const n = await crearNoticia(request, {}, archivo('foto.png', 'image/png', PNG_1PX));
    expect(n.imagen_url).toContain('/noticias-imagenes/');
    expect((await request.get(n.imagen_url!)).status()).toBe(200);
    expect(await (await request.get('/noticias')).text()).toContain(n.imagen_url!);
    expect(await (await request.get(`/noticias/${n.id}`)).text()).toContain(n.imagen_url!);
  });
  test('foto que no es imagen → error=imagen y no se crea', async ({ request }) => {
    const titulo = nombrePrueba('Noticia');
    const res = await formulario(request, '/api/panel/noticias', { titulo, contenido: 'x', publicado: 'on', imagen_actual: '' }, { imagen: archivo('doc.pdf', 'application/pdf', PDF_MINIMO) });
    expect(destino(res)).toBe('/panel/noticias?nueva=1&error=imagen');
    expect((await sb().from('noticias').select('id').eq('titulo', titulo).maybeSingle()).data).toBeNull();
  });
  test('foto de más de 4 MB → error=imagen', async ({ request }) => {
    const grande = Buffer.concat([PNG_1PX, Buffer.alloc(4 * 1024 * 1024 + 1)]);
    const res = await formulario(request, '/api/panel/noticias', { titulo: nombrePrueba('Noticia'), contenido: 'x', imagen_actual: '' }, { imagen: archivo('grande.png', 'image/png', grande) });
    expect(destino(res)).toBe('/panel/noticias?nueva=1&error=imagen');
  });
  const INVALIDAS: [string, Record<string, string>][] = [
    ['sin título', { titulo: '', contenido: 'algo', imagen_actual: '' }],
    ['título solo espacios', { titulo: '   ', contenido: 'algo', imagen_actual: '' }],
    ['sin contenido', { titulo: 'PRUEBA-x', contenido: '', imagen_actual: '' }],
    ['sin ningún campo', {}],
  ];
  for (const [nombre, campos] of INVALIDAS) {
    test(`rechaza ${nombre} con error=1`, async ({ request }) => {
      expect(destino(await formulario(request, '/api/panel/noticias', campos))).toBe('/panel/noticias?nueva=1&error=1');
    });
  }
  test('título de 500 caracteres se recorta a 160 y contenido de 9000 a 8000', async ({ request }) => {
    const titulo = nombrePrueba('Largo') + 'x'.repeat(500);
    await formulario(request, '/api/panel/noticias', { titulo, contenido: 'y'.repeat(9000), imagen_actual: '' });
    const { data } = await sb().from('noticias').select('titulo, contenido').eq('titulo', titulo.slice(0, 160)).maybeSingle();
    expect(data?.titulo.length).toBe(160);
    expect(data?.contenido.length).toBe(8000);
  });
  test('editar título y contenido conservando la foto', async ({ request }) => {
    const n = await crearNoticia(request, {}, archivo('foto.png', 'image/png', PNG_1PX));
    const nuevo = nombrePrueba('Editada');
    expect(destino(await formulario(request, '/api/panel/noticias', { id: n.id, titulo: nuevo, contenido: 'Contenido nuevo', publicado: 'on', imagen_actual: n.imagen_url! }))).toBe('/panel/noticias');
    const { data } = await sb().from('noticias').select('titulo, contenido, imagen_url, publicado').eq('id', n.id).maybeSingle();
    expect(data).toEqual({ titulo: nuevo, contenido: 'Contenido nuevo', imagen_url: n.imagen_url, publicado: true });
  });
  test('editar con foto nueva reemplaza la URL', async ({ request }) => {
    const n = await crearNoticia(request, {}, archivo('foto.png', 'image/png', PNG_1PX));
    await formulario(request, '/api/panel/noticias', { id: n.id, titulo: n.titulo, contenido: n.contenido, publicado: 'on', imagen_actual: n.imagen_url! }, { imagen: archivo('otra.png', 'image/png', PNG_1PX) });
    const { data } = await sb().from('noticias').select('imagen_url').eq('id', n.id).maybeSingle();
    expect(data?.imagen_url).not.toBe(n.imagen_url);
    expect((await request.get(data!.imagen_url!)).status()).toBe(200);
  });
  test('editar con error=1 vuelve al formulario de esa noticia', async ({ request }) => {
    const n = await crearNoticia(request);
    expect(destino(await formulario(request, '/api/panel/noticias', { id: n.id, titulo: '', contenido: 'x', imagen_actual: '' }))).toBe(`/panel/noticias?editar=${n.id}&error=1`);
  });
  test('ocultar y volver a publicar', async ({ request }) => {
    const n = await crearNoticia(request);
    await formulario(request, '/api/panel/noticias', { id: n.id, titulo: n.titulo, contenido: n.contenido, imagen_actual: '' });
    expect(await (await request.get('/noticias')).text()).not.toContain(n.titulo);
    await formulario(request, '/api/panel/noticias', { id: n.id, titulo: n.titulo, contenido: n.contenido, publicado: 'on', imagen_actual: '' });
    expect(await (await request.get('/noticias')).text()).toContain(n.titulo);
  });
  test('eliminar borra la fila y la foto del bucket', async ({ request }) => {
    const n = await crearNoticia(request, {}, archivo('foto.png', 'image/png', PNG_1PX));
    const ruta = n.imagen_url!.split('noticias-imagenes/')[1];
    expect(destino(await formulario(request, '/api/panel/noticias', { _accion: 'eliminar', id: n.id, imagen_url: n.imagen_url! }))).toBe('/panel/noticias');
    expect((await sb().from('noticias').select('id').eq('id', n.id).maybeSingle()).data).toBeNull();
    const { data: objetos } = await sb().storage.from('noticias-imagenes').list('', { search: ruta.split('-').slice(1).join('-') });
    expect(objetos?.some((o) => o.name === ruta)).toBe(false);
    expect(destino(await request.get(`/noticias/${n.id}`, { maxRedirects: 0 }))).toBe('/noticias');
  });
  test('eliminar con id inexistente o vacío no rompe', async ({ request }) => {
    expect(destino(await formulario(request, '/api/panel/noticias', { _accion: 'eliminar', id: '11111111-2222-4333-8444-555555555555', imagen_url: '' }))).toBe('/panel/noticias');
    expect(destino(await formulario(request, '/api/panel/noticias', { _accion: 'eliminar', id: '', imagen_url: '' }))).toBe('/panel/noticias');
  });
  test('título con HTML se muestra escapado en la lista, el detalle y el panel', async ({ request }) => {
    const n = await crearNoticia(request, { titulo: `${nombrePrueba('X')} <script>alert(1)</script>` });
    for (const ruta of ['/noticias', `/noticias/${n.id}`, '/panel/noticias']) {
      const html = await (await request.get(ruta)).text();
      expect(html, ruta).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html, ruta).not.toContain('<script>alert(1)</script>');
    }
  });
  test('la lista pública muestra la más reciente primero y recorta el extracto a 160 caracteres', async ({ request }) => {
    const vieja = await crearNoticia(request, { contenido: 'z'.repeat(400) });
    await new Promise((r) => setTimeout(r, 50));
    const nueva = await crearNoticia(request);
    const html = await (await request.get('/noticias')).text();
    expect(html.indexOf(nueva.titulo)).toBeLessThan(html.indexOf(vieja.titulo));
    expect(html).toContain('z'.repeat(160) + '…');
    expect(html).not.toContain('z'.repeat(161));
  });
  test('el detalle lleva título y descripción para buscadores y redes', async ({ request }) => {
    const n = await crearNoticia(request, { contenido: 'Descripción corta de prueba.' });
    const html = await (await request.get(`/noticias/${n.id}`)).text();
    expect(html).toContain(`<title>${n.titulo} · GEMPRO</title>`);
    expect(html).toContain('content="Descripción corta de prueba."');
  });
  test('detalle de un id que no es UUID vuelve a la lista sin error 500', async ({ request }) => {
    expect(destino(await request.get('/noticias/no-es-uuid', { maxRedirects: 0 }))).toBe('/noticias');
  });
});

test.describe('Panel de noticias (navegador)', () => {
  test('crear con foto desde el formulario, ver en el sitio y eliminar', async ({ page }) => {
    await entrarPagina(page);
    await page.goto('/panel/noticias?nueva=1');
    const titulo = nombrePrueba('Navegador');
    await page.fill('#titulo', titulo);
    await page.fill('#contenido', 'Párrafo uno.\n\nPárrafo dos.');
    await page.setInputFiles('#imagen', { name: 'foto.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/panel\/noticias$/);
    const tarjeta = page.locator('article', { hasText: titulo });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.locator('img')).toHaveAttribute('src', /noticias-imagenes/);
    await page.goto('/noticias');
    await expect(page.locator('main')).toContainText(titulo);
    await page.goto('/panel/noticias');
    page.once('dialog', (d) => d.accept());
    await page.locator('article', { hasText: titulo }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.locator('article', { hasText: titulo })).toHaveCount(0);
  });
  test('editar desde el panel: el formulario trae los datos y guarda', async ({ page, request }) => {
    const n = await crearNoticia(request);
    await entrarPagina(page);
    await page.goto(`/panel/noticias?editar=${n.id}`);
    await expect(page.locator('#titulo')).toHaveValue(n.titulo);
    await page.fill('#titulo', n.titulo + ' (editada)');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page).toHaveURL(/\/panel\/noticias$/);
    await expect(page.locator('article', { hasText: n.titulo + ' (editada)' })).toBeVisible();
  });
});
