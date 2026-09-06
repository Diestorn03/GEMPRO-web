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
| Servidor local | **Express** + `compression` + adaptador Node de Astro (middleware) | gzip/brotli, caché de un año para `/_astro`, endpoint `/api/contacto` |
| Pruebas | **Playwright** (escritorio y móvil) + **axe-core** + **Lighthouse** | 24 pruebas de extremo a extremo; auditoría 100/100/100/100 en escritorio |

## Comandos

```bash
npm install            # una sola vez (y: npx playwright install chromium)
npm run dev            # desarrollo con recarga en http://localhost:4321
npm run build          # compila a dist/
npm run preview        # sirve dist/ con Express en http://127.0.0.1:4321
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
  pages/servicios.astro ← detalle de los cuatro ejes
  pages/api/contacto.ts ← recibe el formulario y lo guarda en data/mensajes.json
  scripts/motion.ts     ← animaciones por atributos data-*
  styles/global.css     ← tokens de color, tipografía y utilidades
  assets/img, logos     ← fotos y logos originales (Astro genera los formatos optimizados)
tests/sitio.spec.ts     ← pruebas de extremo a extremo
scripts/qa.mjs          ← control de calidad completo; scripts/capturas.mjs genera capturas
server.mjs              ← servidor Express para vista previa/producción en Node
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

## Antes de publicar

1. **Datos entre corchetes** en `src/data/site.ts`, `Training.astro` y `Contact.astro`: fechas de cursos, horario de atención, RIF.
2. **Formulario**: `src/pages/api/contacto.ts` hoy guarda en `data/mensajes.json`. Para producción, enviar por correo (Resend, Formspree, SMTP) en el bloque marcado.
3. **Cifras** de la banda verde (+60 años, 4 países, 11 sectores, 24/7): salen del sitio actual y su versión de 2017; confirmarlas con GEMPRO.
4. **Panel HUD** de la portada: datos ilustrativos marcados como DEMO. Sustituir por una lectura real o dejarlo como ejemplo.
5. **Fotografías**: son las del sitio actual (stock). Reemplazar por fotos propias del taller y los técnicos cuando existan; basta con sobrescribir los archivos en `src/assets/img/`.
6. **Hosting**: en Cloudflare Pages o Netlify cambiar el adaptador en `astro.config.mjs` (o eliminarlo y usar un servicio de formularios). Dominio y correo siguen en el proveedor actual; solo hay que apuntar el DNS.
7. **Redirecciones** de las URL antiguas (`/contacto.html`, `/nosotros.html`) a las nuevas, para no perder el posicionamiento.
