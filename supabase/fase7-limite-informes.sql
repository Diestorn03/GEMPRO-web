-- Fase 7: hace cumplir en el propio bucket el límite de 20 MB por informe que hoy solo revisa
-- el navegador antes de subir. Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.

update storage.buckets set file_size_limit = 20971520 where id = 'informes-tecnicos';
