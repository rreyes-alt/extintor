-- =====================================================================
-- Actualización v1.2
--   • Nuevo tipo de ubicación: CAMPO
--   • Baja de extintores con fecha y motivo
-- Pegar en: Supabase > SQL Editor > New query (pestaña vacía) > Run
-- Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Ubicaciones: Base, Taller o Campo
alter table public.ubicaciones drop constraint if exists ubicaciones_tipo_check;
alter table public.ubicaciones add constraint ubicaciones_tipo_check
  check (tipo in ('Base','Taller','Campo'));

-- 2. Extintores: también pueden estar en un Campo
alter table public.extintores drop constraint if exists extintores_tipo_ubicacion_check;
alter table public.extintores add constraint extintores_tipo_ubicacion_check
  check (tipo_ubicacion in ('Base','Taller','Campo','Pickup','Trailer'));

-- 3. Datos de la baja
alter table public.extintores add column if not exists fecha_baja  date;
alter table public.extintores add column if not exists motivo_baja text;
