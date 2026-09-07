# GEMPRO · sitio web

Rediseño de [gempro.com.ve](https://gempro.com.ve) en dirección "sala de control": portada cinematográfica, tipografía Archivo extendida, verde de marca como acento, animaciones de entrada en cada sección y formulario funcional.

## Tecnología

| Capa | Herramienta | Por qué |
| --- | --- | --- |
| Generador | **Astro 7** (HTML pregenerado) | Cero JavaScript salvo el que animamos; Google recibe la página completa |
| Estilos | **Tailwind CSS 4** + tokens en `src/styles/global.css` | Paleta de marca centralizada, utilidades `display`, `eyebrow`, `btn-primary` |
| Animación | **GSAP 3** (ScrollTrigger, SplitText) + **Lenis** | Entradas por sección, titulares línea a línea, contadores, parallax, barra de progreso, botones magnéticos, desplazamiento suave |
| Tipografía | `@fontsource-variable/archivo` (eje de anchura) y `@fontsource-variable/jetbrains-mono` | Autoalojadas, sin llamadas a Google |
| Imágenes | `astro:assets` (Sharp) | Las fotos originales de 2 MB salen en AVIF/WebP de 25 a 100 KB, en varios tamaños |
| Hosting | **Vercel** (`@astrojs/vercel`) | Páginas de mercadeo estáticas + rutas de servidor (formulario, portal) en el mismo proyecto |
| Datos | **Supabase** (proyecto propio, aparte del de Kindra Project) | Formulario de contacto, registro del evento, portal de clientes |
| Pruebas | **Playwright** (escritorio y móvil) + **axe-core** + **Lighthouse** | 24 pruebas de extremo a extremo; auditoría 100/100/100/100 en escritorio |

## Comandos

```bash
npm install            # una sola vez (y: npx playwright install chromium; copiar .env.example a .env)
npm run dev            # desarrollo con recarga en http://localhost:4321
npm run build          # compila para Vercel
npm run preview        # vista previa local con astro preview
npm test               # pruebas Playwright (compila antes con npm run build)
npm run qa             # build + servidor + pruebas + capturas + Lighthouse (capturas/)
npm run check          # comprobación de tipos de Astro
```

## Estructura

```
src/
  data/site.ts          ← TODO el contenido (textos, teléfonos, sedes, cursos). Edite aquí.
  layouts/Base.astro    ← <head>, SEO, JSON-LD, cabecera, pie, barra móvil, carga del sistema de animación
  components/           ← una sección por archivo: Hero, Marquee, Services, Process, Stats, Equipment,
                           Training, Presence, Contact, Nav, Footer, MobileBar
  pages/index.astro     ← inicio
  pages/servicios.astro, nosotros.astro, productos.astro, noticias.astro
  pages/api/contacto.ts ← recibe el formulario y lo guarda en Supabase (tabla `mensajes`)
  lib/supabase.ts       ← cliente de Supabase para el servidor (service_role, nunca al navegador)
  lib/auth.ts           ← sesión del panel privado y verificación de contraseña de cliente
  scripts/motion.ts     ← animaciones por atributos data-*
  scripts/generar-logo-blanco.mjs ← regenera el logo para fondo oscuro desde el logo maestro
  styles/global.css     ← tokens de color, tipografía y utilidades
  assets/img, logos     ← fotos y logos originales (Astro genera los formatos optimizados)
supabase/schema.sql     ← tablas y bucket a ejecutar en un proyecto nuevo de Supabase
tests/sitio.spec.ts     ← pruebas de extremo a extremo
scripts/qa.mjs          ← control de calidad completo; scripts/capturas.mjs genera capturas
```

## Sistema de animación (atributos)

| Atributo | Efecto |
| --- | --- |
| `data-reveal="up\|left\|right\|zoom\|fade"` (+ `data-delay`) | aparece al entrar en pantalla |
| `data-reveal-group` (+ `data-stagger`) | los hijos aparecen en cascada |
| `data-split` | titular que entra línea por línea con máscara |
| `data-count="60" data-prefix="+"` | contador numérico |
| `data-parallax="12"` dentro de `[data-parallax-scope]` | desplazamiento sutil ligado al scroll |
| `data-draw` en un `<path>` | trazo que se dibuja solo |
| `data-magnetic` | el botón se inclina hacia el cursor |
| `data-nav` / `data-progress` | cabecera que se oculta al bajar y barra de progreso de lectura |

Todo respeta `prefers-reduced-motion`. Sin JavaScript el contenido se muestra completo (no depende de las animaciones).

## Supabase

Proyecto propio para GEMPRO (no el de Kindra Project — son negocios distintos). Al crearlo en
supabase.com, ejecutar `supabase/schema.sql` completo en el editor SQL, y copiar `SUPABASE_URL`
y `SUPABASE_SERVICE_KEY` (Project Settings → API) a `.env` en local y a las variables de entorno
de Vercel. La `service_role` key solo se usa en rutas de servidor (`src/pages/api/*`, y en el
panel/portal cuando existan) — nunca se expone al navegador.

## Publicar en Vercel

1. vercel.com → Add New Project → importar `Diestorn03/GEMPRO-web`. Astro se detecta solo.
2. Variables de entorno: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD`, `AUTH_SECRET`
   (ver `.env.example`).
3. Deploy. Cada `git push` a `main` publica solo. Cuando GEMPRO tenga su dominio propio, se
   agrega como dominio personalizado de este mismo proyecto — un solo lugar que apuntar.

## Antes de publicar

1. **Datos entre corchetes** en `src/data/site.ts`, `Training.astro` y `Contact.astro`: fechas de cursos, horario de atención, RIF.
2. **Cifras** de la banda verde (+60 años, 4 países, 11 sectores, 24/7): salen del sitio actual y su versión de 2017; confirmarlas con GEMPRO.
3. **Panel HUD** de la portada: datos ilustrativos marcados como DEMO. Sustituir por una lectura real o dejarlo como ejemplo.
4. **Fotografías**: son las del sitio actual (stock) salvo `equipo-gempro.png`. Reemplazar por fotos propias del taller y los técnicos cuando existan; basta con sobrescribir los archivos en `src/assets/img/`.
5. **Noticias**: los tres artículos de `/noticias` son contenido educativo de arranque escrito por nosotros, con fecha `[FECHA]` sin confirmar — reemplazar o completar cuando GEMPRO tenga sus propios artículos.
6. **Redirecciones** de las URL antiguas (`/contacto.html`, `/nosotros.html`) a las nuevas, para no perder el posicionamiento.
