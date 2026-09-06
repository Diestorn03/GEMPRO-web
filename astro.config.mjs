// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Sitio estático (HTML pregenerado) + un único endpoint bajo demanda (/api/contacto).
// El adaptador de Node en modo "middleware" se monta en server.mjs (Express + compresión).
// Para producción en Cloudflare Pages/Netlify basta cambiar el adaptador y el destino del formulario.
// GITHUB_PAGES=true lo activa el workflow de despliegue (.github/workflows/pages.yml).
// En local (npm run dev/build/preview) la base sigue siendo "/", sin afectar nada de lo actual.
const isGithubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  site: isGithubPages ? 'https://REEMPLAZAR-usuario.github.io' : 'https://gempro.com.ve',
  base: isGithubPages ? '/GEMPRO-web' : '/',
  output: 'static',
  adapter: node({ mode: 'middleware' }),
  build: { format: 'file' },
  vite: {
    plugins: [tailwindcss()],
  },
});
