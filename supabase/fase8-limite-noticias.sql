-- Fase 8: hace cumplir en el propio bucket el límite de 4 MB por imagen de noticia que hoy solo
-- revisa el servidor de la página. Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.

update storage.buckets set file_size_limit = 4194304 where id = 'noticias-imagenes';
