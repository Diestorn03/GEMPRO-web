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
npm run build          # compila para Vercel (el adaptador no soporta vista previa local:
                        # astro preview no funciona con @astrojs/vercel; usar npm run dev)
npm test               # pruebas Playwright contra astro dev en local (o BASE_URL=... contra un despliegue)
npm run qa             # build + astro dev + pruebas + capturas + Lighthouse (capturas/)
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
   (ver `.env.example`). Opcional: `CRON_SECRET` (Vercel la genera al guardarla) para que
   `/api/latido` solo acepte la llamada firmada del cron y no cualquier visita anónima.
3. Deploy. Cada `git push` a `main` publica solo. Cuando GEMPRO tenga su dominio propio, se
   agrega como dominio personalizado de este mismo proyecto — un solo lugar que apuntar.

## Panel privado, portal de clientes, noticias y evento

Todo vive en este mismo proyecto como rutas renderizadas en el servidor (`export const prerender = false`) sobre el mismo Supabase.

| Ruta | Qué es |
|---|---|
| `/entrar` | Acceso del equipo de GEMPRO con `ADMIN_PASSWORD`. Sesión de 30 días en cookie firmada (`gp_sesion`). |
| `/panel` | Clientes: crear acceso (link + contraseña de mínimo 8 caracteres), buscador e historial de informes por cliente. |
| `/panel/noticias` | CMS mínimo: título, artículo, foto (bucket público `noticias-imagenes`, hasta 5 MB), visible u oculta. |
| `/panel/evento` | Fechas de apertura y cierre, interruptor manual, contador, CSV, ganador al azar y QR en dos estilos, estilizado (puntos redondeados, degradado azul, ojos circulares, isotipo suelto al centro) y clásico (máxima compatibilidad), en PNG 2400 px y SVG. |
| `/c/[token]` | Portal de un cliente: pide su contraseña y lista sus informes con enlaces firmados de 5 minutos. |
| `/evento` | Registro público por QR (nombre, correo, teléfono). Cerrado por defecto. |
| `/api/salud` | Diagnóstico: qué variables llegaron, si la base responde y si existe la tabla del límite de intentos. Pide sesión de `/panel` o `?clave=` con el `AUTH_SECRET` (para poder diagnosticar incluso cuando `ADMIN_PASSWORD` es lo que falla). |

Seguridad: contraseñas de clientes con hash y sal; cookies `HttpOnly`, `Secure` y `SameSite=Lax` con vencimiento firmado dentro del valor; comprobación de origen de Astro en todos los POST; límite de intentos por IP en `/api/entrar`, `/api/c/entrar`, `/api/evento` y `/api/contacto` (tabla `intentos_acceso`, ver `supabase/fase5-limite.sql`); cabeceras de seguridad y `Cache-Control: no-store` en las rutas privadas (`src/middleware.ts`); RLS activo y la `service_role` key solo en el servidor.

Migraciones: `supabase/schema.sql` es la forma final para un proyecto nuevo; un proyecto existente ejecuta en orden `fase5-limite.sql`, `fase6-clientes-eventos.sql` y `fase7-limite-informes.sql` (`/api/salud` dice cuáles faltan).

Scripts: `node scripts/generar-favicon.mjs` (favicon e iconos desde el isotipo), `node scripts/generar-isotipo.mjs` recorta el isotipo del logo maestro para el QR; `node scripts/probar-qr.mjs` verifica con dos decodificadores (ZXing y jsQR) que ambos estilos de QR se leen en PNG, PNG degradado y SVG. `vercel.json` programa una visita diaria a `/api/latido` para que el proyecto gratuito de Supabase no se pause por inactividad.

## Antes de publicar

1. **Datos entre corchetes** en `src/data/site.ts`, `Training.astro` y `Contact.astro`: fechas de cursos, horario de atención, RIF.
2. **Cifras** de la banda verde (+60 años, 4 países, 11 sectores, 24/7): salen del sitio actual y su versión de 2017; confirmarlas con GEMPRO.
3. **Panel HUD** de la portada: datos ilustrativos marcados como DEMO. Sustituir por una lectura real o dejarlo como ejemplo.
4. **Fotografías**: son las del sitio actual (stock) salvo `equipo-gempro.png`. Reemplazar por fotos propias del taller y los técnicos cuando existan; basta con sobrescribir los archivos en `src/assets/img/`.
5. **Noticias**: los tres artículos de `/noticias` son contenido educativo de arranque escrito por nosotros, con fecha `[FECHA]` sin confirmar — reemplazar o completar cuando GEMPRO tenga sus propios artículos.
6. **Redirecciones** de las URL antiguas (`/contacto.html`, `/nosotros.html`) a las nuevas, para no perder el posicionamiento.
