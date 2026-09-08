/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_SERVICE_KEY: string;
  readonly ADMIN_PASSWORD: string;
  readonly AUTH_SECRET: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Vite: importar una imagen con ?inline la incrusta como data URI (usado por lib/qr.ts en el servidor). */
declare module '*.png?inline' { const src: string; export default src; }
