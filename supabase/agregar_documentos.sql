-- =====================================================================
-- Agrega DOCUMENTOS ADJUNTOS por extintor (JPG, PNG, PDF):
-- ficha técnica, certificados de recarga y PH, remitos, fotos.
-- Pegar en: Supabase > SQL Editor > New query (pestaña vacía) > Run
-- Se puede ejecutar más de una vez.
-- =====================================================================

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
