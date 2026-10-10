-- =====================================================================
-- App de Trazabilidad de Extintores — Esquema de base de datos Supabase
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- Se puede ejecutar más de una vez sin romper nada.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. PERFILES (un registro por usuario de la app)
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nombre      text,
  rol         text not null default 'operador' check (rol in ('seguridad','operador')),
  activo      boolean not null default false,
  recibe_alarmas boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Todo usuario nuevo queda como Operador INACTIVO hasta que Seguridad lo active.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users
for each row execute function public.crear_perfil();

-- Funciones de permiso (se usan en las reglas de seguridad)
create or replace function public.es_activo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select activo from public.perfiles where id = auth.uid()), false);
$$;

create or replace function public.es_seguridad()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select activo and rol = 'seguridad' from public.perfiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 2. UBICACIONES FIJAS (bases y talleres)
-- ---------------------------------------------------------------------
create table if not exists public.ubicaciones (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  tipo       text not null check (tipo in ('Base','Taller','Campo')),
  direccion  text,
  lat        double precision,
  lng        double precision,
  activo     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. VEHÍCULOS (pickups y trailers)
-- ---------------------------------------------------------------------
create table if not exists public.vehiculos (
  id          uuid primary key default gen_random_uuid(),
  patente     text not null unique,
  tipo        text not null check (tipo in ('Pickup','Trailer')),
  descripcion text,
  base_id     uuid references public.ubicaciones(id),
  activo      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. EXTINTORES (ficha técnica)
-- ---------------------------------------------------------------------
create table if not exists public.extintores (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  serie              text,
  nfc_uid            text unique,
  agente             text,
  capacidad_kg       numeric,
  marca              text,
  fecha_fabricacion  date,
  ultima_recarga     date,
  meses_recarga      int not null default 12,
  ultima_ph          date,
  meses_ph           int not null default 60,
  tipo_ubicacion     text check (tipo_ubicacion in ('Base','Taller','Campo','Pickup','Trailer')),
  ubicacion_id       uuid references public.ubicaciones(id),
  vehiculo_id        uuid references public.vehiculos(id),
  sector             text,
  frecuencia_dias    int not null default 30 check (frecuencia_dias in (15,30)),
  estado             text not null default 'Activo'
                     check (estado in ('Activo','En recarga','Fuera de servicio','Baja')),
  observaciones      text,
  fecha_baja         date,
  motivo_baja        text,
  observado          boolean not null default false,
  ultima_inspeccion  timestamptz,
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. ÍTEMS DEL CHECKLIST (editables por Seguridad)
--    aplica: null = todos | 'excepto:CO2' | 'solo:CO2'
-- ---------------------------------------------------------------------
create table if not exists public.checklist_items (
  id         uuid primary key default gen_random_uuid(),
  orden      int not null default 0,
  texto      text not null,
  aplica     text,
  activo     boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. INSPECCIONES
-- ---------------------------------------------------------------------
create table if not exists public.inspecciones (
  id               uuid primary key,                       -- lo genera el celular (sirve offline)
  extintor_id      uuid not null references public.extintores(id),
  fecha            timestamptz not null default now(),
  inspector_id     uuid not null default auth.uid() references public.perfiles(id),
  inspector_nombre text,
  nfc_leido        boolean not null default false,
  resultados       jsonb not null default '[]'::jsonb,     -- [{item_id, texto, ok}]
  todo_ok          boolean not null default true,
  observaciones    text,
  fotos            text[] not null default '{}',           -- rutas en el bucket "fotos"
  lat              double precision,
  lng              double precision,
  created_at       timestamptz not null default now()
);
create index if not exists inspecciones_extintor_fecha on public.inspecciones (extintor_id, fecha desc);

-- Al guardar una inspección, se actualiza la ficha del extintor
create or replace function public.despues_de_inspeccion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.extintores e
     set ultima_inspeccion = greatest(coalesce(e.ultima_inspeccion, new.fecha), new.fecha),
         observado = case when new.fecha >= coalesce(e.ultima_inspeccion, new.fecha) then not new.todo_ok else e.observado end,
         updated_at = now()
   where e.id = new.extintor_id;
  return new;
end $$;

drop trigger if exists al_inspeccionar on public.inspecciones;
create trigger al_inspeccionar after insert or update on public.inspecciones
for each row execute function public.despues_de_inspeccion();

-- updated_at automático
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['perfiles','ubicaciones','vehiculos','extintores','checklist_items'] loop
    execute format('drop trigger if exists tocar_%1$s on public.%1$s', t);
    execute format('create trigger tocar_%1$s before update on public.%1$s for each row execute function public.tocar_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. REGLAS DE SEGURIDAD (RLS)
--    Usuario inactivo: no ve nada.
--    Operador activo: ve todo y carga inspecciones propias.
--    Seguridad activo: acceso total.
-- ---------------------------------------------------------------------
alter table public.perfiles        enable row level security;
alter table public.ubicaciones     enable row level security;
alter table public.vehiculos       enable row level security;
alter table public.extintores      enable row level security;
alter table public.checklist_items enable row level security;
alter table public.inspecciones    enable row level security;

drop policy if exists perfiles_ver on public.perfiles;
create policy perfiles_ver on public.perfiles for select using (id = auth.uid() or public.es_activo());
drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles for update using (public.es_seguridad()) with check (public.es_seguridad());

do $$
declare t text;
begin
  foreach t in array array['ubicaciones','vehiculos','extintores','checklist_items'] loop
    execute format('drop policy if exists %1$s_ver on public.%1$s', t);
    execute format('create policy %1$s_ver on public.%1$s for select using (public.es_activo())', t);
    execute format('drop policy if exists %1$s_alta on public.%1$s', t);
    execute format('create policy %1$s_alta on public.%1$s for insert with check (public.es_seguridad())', t);
    execute format('drop policy if exists %1$s_editar on public.%1$s', t);
    execute format('create policy %1$s_editar on public.%1$s for update using (public.es_seguridad()) with check (public.es_seguridad())', t);
    execute format('drop policy if exists %1$s_borrar on public.%1$s', t);
    execute format('create policy %1$s_borrar on public.%1$s for delete using (public.es_seguridad())', t);
  end loop;
end $$;

drop policy if exists inspecciones_ver on public.inspecciones;
create policy inspecciones_ver on public.inspecciones for select using (public.es_activo());
drop policy if exists inspecciones_alta on public.inspecciones;
create policy inspecciones_alta on public.inspecciones for insert
  with check (public.es_activo() and inspector_id = auth.uid());
drop policy if exists inspecciones_editar on public.inspecciones;
create policy inspecciones_editar on public.inspecciones for update
  using (public.es_seguridad() or inspector_id = auth.uid())
  with check (public.es_seguridad() or inspector_id = auth.uid());
drop policy if exists inspecciones_borrar on public.inspecciones;
create policy inspecciones_borrar on public.inspecciones for delete using (public.es_seguridad());

-- ---------------------------------------------------------------------
-- 8. FOTOS (bucket privado "fotos")
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists fotos_ver on storage.objects;
create policy fotos_ver on storage.objects for select
  using (bucket_id = 'fotos' and public.es_activo());
drop policy if exists fotos_subir on storage.objects;
create policy fotos_subir on storage.objects for insert
  with check (bucket_id = 'fotos' and public.es_activo());
drop policy if exists fotos_reemplazar on storage.objects;
create policy fotos_reemplazar on storage.objects for update
  using (bucket_id = 'fotos' and public.es_activo());
drop policy if exists fotos_borrar on storage.objects;
create policy fotos_borrar on storage.objects for delete
  using (bucket_id = 'fotos' and public.es_seguridad());

-- ---------------------------------------------------------------------
-- 9. CHECKLIST INICIAL (solo si la tabla está vacía)
-- ---------------------------------------------------------------------
insert into public.checklist_items (orden, texto, aplica)
select * from (values
  (1, 'Ubicado en su lugar asignado y con acceso libre', null),
  (2, 'Señalización visible y en buen estado', null),
  (3, 'Manómetro en zona verde', 'excepto:CO2'),
  (4, 'Precinto y pasador de seguridad colocados', null),
  (5, 'Manguera y boquilla sin cortes, fisuras ni obstrucciones', null),
  (6, 'Cilindro sin golpes, corrosión ni pintura deteriorada', null),
  (7, 'Tarjeta de recarga legible y vigente', null),
  (8, 'Soporte o sujeción firme (en vehículos: anclado y sin juego)', null),
  (9, 'Peso correcto', 'solo:CO2')
) as v(orden, texto, aplica)
where not exists (select 1 from public.checklist_items);

-- =====================================================================
-- PRIMER USUARIO DE SEGURIDAD
-- 1) Supabase > Authentication > Users > Add user (email + contraseña,
--    marcar "Auto Confirm User").
-- 2) Ejecutar (cambiando el email):
--
--    update public.perfiles set rol = 'seguridad', activo = true
--    where email = 'tu.mail@empresa.com';
-- =====================================================================

-- ---------------------------------------------------------------------
-- 10. DOCUMENTOS ADJUNTOS (también disponible por separado en agregar_documentos.sql)
-- ---------------------------------------------------------------------
create table if not exists public.documentos (
  id                uuid primary key,                 -- lo genera el celular
  extintor_id       uuid not null references public.extintores(id) on delete cascade,
  tipo              text,
  nombre            text,
  descripcion       text,
  fecha             date,
  ruta              text not null,                    -- ruta en el bucket "fotos"
  mime              text,
  tamano            bigint,
  subido_por        uuid default auth.uid() references public.perfiles(id),
  subido_por_nombre text,
  created_at        timestamptz not null default now()
);
create index if not exists documentos_extintor on public.documentos (extintor_id);

alter table public.documentos enable row level security;

-- Todos los usuarios activos ven y adjuntan documentos; solo Seguridad edita o borra.
drop policy if exists documentos_ver on public.documentos;
create policy documentos_ver on public.documentos for select using (public.es_activo());
drop policy if exists documentos_alta on public.documentos;
create policy documentos_alta on public.documentos for insert with check (public.es_activo());
drop policy if exists documentos_editar on public.documentos;
create policy documentos_editar on public.documentos for update
  using (public.es_seguridad() or subido_por = auth.uid())
  with check (public.es_seguridad() or subido_por = auth.uid());
drop policy if exists documentos_borrar on public.documentos;
create policy documentos_borrar on public.documentos for delete using (public.es_seguridad());

-- Límite de 10 MB por archivo en el bucket de fotos y documentos
update storage.buckets set file_size_limit = 10485760 where id = 'fotos';
