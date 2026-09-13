-- Fase 9: logo de la empresa y datos del contacto (cargo y correo) de cada cliente del portal.
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.

alter table clientes add column if not exists contacto_cargo text;
alter table clientes add column if not exists contacto_correo text;
alter table clientes add column if not exists logo_url text;

-- Bucket público para los logos: el portal del cliente los muestra por URL directa. Límite 2 MB
-- por archivo (el panel ya los reduce a 800 px antes de subirlos).
insert into storage.buckets (id, name, public, file_size_limit)
values ('clientes-logos', 'clientes-logos', true, 2097152)
on conflict (id) do nothing;
