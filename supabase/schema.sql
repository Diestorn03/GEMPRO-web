-- Esquema para el proyecto de Supabase de GEMPRO (aparte del de Kindra Project).
-- Ejecutar completo en el editor SQL de supabase.com al crear el proyecto.

-- Formulario de contacto público (Contact.astro).
create table mensajes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text,
  correo text not null,
  telefono text,
  mensaje text not null,
  creado_en timestamptz not null default now()
);
alter table mensajes enable row level security;
-- Nota: los inserts a esta tabla se hacen server-side con la service_role key
-- (ver src/pages/api/contacto.ts), así que no hace falta una política para
-- el rol anon. Sin políticas, RLS bloquea todo acceso público por defecto.

-- Registro del evento con QR (Fase 3): nombre/correo/teléfono para la rifa y la lista de contactos.
-- Eventos (Fase 6): cada registro por QR pertenece a un evento; el QR (/evento) es permanente.
create table eventos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  inicio timestamptz,
  fin timestamptz,
  forzar_abierto boolean, -- true abre, false cierra, null = según inicio/fin
  creado_en timestamptz not null default now(),
  check (inicio is null or fin is null or fin > inicio)
);
alter table eventos enable row level security;

create table registro_evento (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references eventos(id) on delete cascade,
  nombre text not null,
  correo text not null,
  telefono text,
  creado_en timestamptz not null default now()
);
create index registro_evento_evento_id_idx on registro_evento (evento_id);
alter table registro_evento enable row level security;

-- Portal de clientes (Fase 2): cada cliente tiene un link privado (token) y una contraseña propia.
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre_empresa text not null,
  token text not null unique,
  password_sal text not null,
  password_hash text not null,
  password_cifrada text, -- Fase 6: reversible con AUTH_SECRET, para poder mostrarla en el panel
  contacto text,
  creado_en timestamptz not null default now()
);
alter table clientes enable row level security;

create table informes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre_archivo text not null,
  ruta_storage text not null, -- ruta dentro del bucket, para generar la URL firmada al pedirla
  subido_en timestamptz not null default now()
);
alter table informes enable row level security;

-- Bucket privado para los informes técnicos (a diferencia del bucket público "archivos" de Kindra:
-- estos son documentos internos del cliente y no deben quedar accesibles por URL directa).
insert into storage.buckets (id, name, public) values ('informes-tecnicos', 'informes-tecnicos', false);
-- Sin políticas de storage para el rol anon: todo acceso (subir, listar, descargar) pasa por
-- rutas del servidor con la service_role key, que evita RLS por diseño.

-- Noticias (Fase 4): CMS simple, sin comentarios ni reacciones. GEMPRO publica desde /panel/noticias.
create table noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contenido text not null,
  imagen_url text,
  publicado boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table noticias enable row level security;
-- La página pública se sirve desde el servidor con la service_role key (evita RLS), pero se
-- deja esta política de lectura por si alguna vez se consulta directo con la clave anon.
create policy "noticias públicas visibles para todos" on noticias for select using (publicado = true);

-- Bucket público para las fotos de las noticias (a diferencia de informes-tecnicos: estas SÍ
-- deben verse en la web pública, igual que el bucket "archivos" de Kindra).
insert into storage.buckets (id, name, public) values ('noticias-imagenes', 'noticias-imagenes', true);

-- ---------------------------------------------------------------
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
