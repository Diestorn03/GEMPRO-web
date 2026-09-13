-- Fase 10: empresa y cargo de quien se registra por el QR del evento.
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.

alter table registro_evento add column if not exists empresa text;
alter table registro_evento add column if not exists cargo text;
