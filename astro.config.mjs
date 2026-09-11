// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Sitio en Vercel: las páginas de mercadeo se generan estáticas (cada una marca
// `export const prerender = true`), y las rutas que necesitan servidor (el
// formulario de contacto, el portal de clientes, la página del evento) quedan
// dinámicas por defecto. Antes vivía en GitHub Pages, que no ejecuta servidores;
// por eso el formulario nunca funcionó ahí. Cuando GEMPRO tenga su propio dominio,
// se agrega como dominio personalizado de este mismo proyecto de Vercel.
export default defineConfig({
  site: 'https://gempro.com.ve',
  output: 'static',
  adapter: vercel(),
  // URLs del sitio anterior (indexadas por Google): sin esto cada una devuelve 404 y se
  // pierde el posicionamiento acumulado. Incluye las variantes /phone/ del sitio viejo.
  redirects: {
    '/index.html': '/',
    '/contacto.html': '/#contacto',
    '/nosotros.html': '/nosotros',
    '/servicios.html': '/servicios',
    '/productos.html': '/productos',
    '/adiestramiento.html': '/#adiestramiento',
    '/eventos.html': '/evento',
    '/phone/index.html': '/',
    '/phone/contacto.html': '/#contacto',
    '/phone/nosotros.html': '/nosotros',
    '/phone/servicios.html': '/servicios',
    '/phone/adiestramiento.html': '/#adiestramiento',
    '/phone/eventos.html': '/evento',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
