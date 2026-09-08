-- Fase 5 (auditoría de seguridad): límite de intentos por IP y ruta.
-- Frena la fuerza bruta contra /entrar y el portal de clientes, y el spam a los formularios.
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.
create table if not exists intentos_acceso (
  id bigint generated always as identity primary key,
  ip text not null,
  ruta text not null,
  creado_en timestamptz not null default now()
);
create index if not exists intentos_acceso_ip_ruta_idx on intentos_acceso (ip, ruta, creado_en);
alter table intentos_acceso enable row level security;
