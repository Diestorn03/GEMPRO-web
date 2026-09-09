-- Fase 6: contraseña visible del cliente + historial de eventos.
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run. El editor lo corre como una
-- sola transacción: si algo falla no queda nada a medias.

-- 1) Contraseña del portal cifrada (reversible con AUTH_SECRET) para poder mostrarla y compartirla de nuevo.
--    Queda NULL en los clientes creados antes: el panel ofrece "Asignar nueva contraseña" para esos.
alter table clientes add column if not exists password_cifrada text;

-- 2) Historial de eventos: cada registro pertenece a un evento. Sustituye al renglón único evento_config.
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  inicio timestamptz,
  fin timestamptz,
  forzar_abierto boolean, -- igual que evento_config: true abre, false cierra, null = según fechas
  creado_en timestamptz not null default now(),
  check (inicio is null or fin is null or fin > inicio)
);
alter table eventos enable row level security;

alter table registro_evento add column if not exists evento_id uuid references eventos(id) on delete cascade;
create index if not exists registro_evento_evento_id_idx on registro_evento (evento_id);

-- El evento en curso hereda la configuración actual (fechas e interruptor) y los registros ya
-- recibidos: el QR sigue registrando sin interrupción después de migrar.
insert into eventos (nombre, inicio, fin, forzar_abierto, creado_en)
select 'Evento 2026', c.inicio, c.fin, c.forzar_abierto, coalesce((select min(creado_en) from registro_evento), now())
from evento_config c
where not exists (select 1 from eventos);

update registro_evento set evento_id = (select id from eventos order by creado_en limit 1) where evento_id is null;
alter table registro_evento alter column evento_id set not null;

drop table if exists evento_config;
