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
