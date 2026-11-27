-- Instalación completa de la base de datos. Pega todo en Supabase › SQL Editor y toca Run.

-- ===== 0001_esquema.sql =====
-- Segundo Cerebro: documentos, fichas, notas y preguntas.
-- Cada tabla tiene user_id y Row Level Security: solo el dueño ve y cambia sus filas.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  ruta_storage text,
  tipo_archivo text,
  categoria text not null default 'Notas personales' check (categoria in (
    'Seguros', 'Contratos', 'Identidad y trámites', 'Salud', 'Vehículos', 'Hogar', 'Finanzas e impuestos', 'Notas personales'
  )),
  tipo_documento text,
  texto_extraido text,
  busqueda tsvector generated always as (
    to_tsvector('spanish', coalesce(nombre, '') || ' ' || coalesce(tipo_documento, '') || ' ' || categoria || ' ' || coalesce(texto_extraido, ''))
  ) stored,
  estado_procesamiento text not null default 'procesando' check (estado_procesamiento in ('procesando', 'listo', 'error')),
  error_procesamiento text,
  created_at timestamptz not null default now()
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  pagina int not null,
  contenido text not null,
  busqueda tsvector generated always as (to_tsvector('spanish', contenido)) stored
);

create table public.document_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null unique references public.documents (id) on delete cascade,
  partes text,
  numero_referencia text, -- solo los últimos 4 dígitos
  fecha_inicio date,
  fecha_vencimiento date,
  montos jsonb not null default '{}',
  condiciones_clave jsonb not null default '[]',
  contacto text,
  campos_no_especificados jsonb not null default '[]',
  avisos_enviados jsonb not null default '[]' -- p. ej. ["30:2027-03-15"] para no repetir correos
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo text not null,
  contenido text not null default '',
  categoria text not null default 'Notas personales',
  busqueda tsvector generated always as (to_tsvector('spanish', titulo || ' ' || contenido)) stored,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pregunta text not null,
  respuesta text not null,
  documentos_citados jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index on public.documents using gin (busqueda);
create index on public.documents (user_id, created_at desc);
create index on public.document_chunks using gin (busqueda);
create index on public.document_chunks (document_id, pagina);
create index on public.document_facts (user_id, fecha_vencimiento);
create index on public.notes using gin (busqueda);
create index on public.questions (user_id, created_at desc);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.document_facts enable row level security;
alter table public.notes enable row level security;
alter table public.questions enable row level security;

create policy "Solo el dueño" on public.documents for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.document_chunks for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.document_facts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Solo el dueño" on public.questions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.documents, public.document_chunks, public.document_facts, public.notes, public.questions to authenticated, service_role;

-- Búsqueda de texto completo en español sobre fragmentos, documentos y notas.
-- Usa "o" entre palabras (no "y"), para que "¿cuándo vence mi seguro?" encuentre documentos que digan solo "seguro".
-- security invoker: respeta RLS, así que cada quien solo busca en lo suyo.
create or replace function public.buscar(consulta text, limite int default 8, usuario uuid default null)
returns table (tipo text, documento_id uuid, nota_id uuid, pagina int, contenido text, rango real)
language sql stable security invoker set search_path = public as $$
  with q as (
    select nullif(replace(plainto_tsquery('spanish', consulta)::text, ' & ', ' | '), '')::tsquery as t
  )
  select * from (
    select 'fragmento'::text, c.document_id, null::uuid, c.pagina, c.contenido, ts_rank(c.busqueda, q.t)
    from document_chunks c, q
    where q.t is not null and c.busqueda @@ q.t and (usuario is null or c.user_id = usuario)
    union all
    select 'documento', d.id, null, null, d.nombre, ts_rank(d.busqueda, q.t) * 1.5
    from documents d, q
    where q.t is not null and d.busqueda @@ q.t and (usuario is null or d.user_id = usuario)
    union all
    select 'nota', null, n.id, null, n.titulo || E'\n' || n.contenido, ts_rank(n.busqueda, q.t)
    from notes n, q
    where q.t is not null and n.busqueda @@ q.t and (usuario is null or n.user_id = usuario)
  ) r
  order by 6 desc
  limit limite;
$$;

grant execute on function public.buscar(text, int, uuid) to authenticated, service_role;

-- Archivos: bucket privado; cada usuario solo puede leer y escribir en su carpeta (<user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

create policy "Leer mis documentos" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Subir mis documentos" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Borrar mis documentos" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== 0002_drive.sql =====
-- Documentos que vienen de tu carpeta de Google Drive: se actualizan solos cuando cambias el archivo en Drive
alter table public.documents add column drive_id text;
alter table public.documents add column drive_actualizado timestamptz;
alter table public.documents add column url_externa text;
create unique index documents_drive_id on public.documents (user_id, drive_id) where drive_id is not null;

-- ===== 0003_push.sql =====
-- Igual que la 0007 de Finanzas: en el proyecto compartido ya está corrida (28 oct 2026). Se puede volver a correr sin problema.
-- Notificaciones push (Web Push). Una fila por celular o navegador donde activaste los avisos.
-- La tabla la comparten las apps TAOS del mismo proyecto de Supabase; "app" dice de cuál es cada suscripción.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_app on public.push_subscriptions (user_id, app);

alter table public.push_subscriptions enable row level security;
drop policy if exists "Solo el dueño" on public.push_subscriptions;
create policy "Solo el dueño" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated, service_role;

-- ===== 0004_mis_documentos.sql =====
-- Mis documentos: lo que marcas en tu lista ("lo tengo en papel", "no aplica", "no cuento con él").
-- Los documentos que ya subiste se detectan solos; esta tabla solo guarda tus marcas. Se puede volver a correr.
create table if not exists public.document_checklist (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  clave text not null,
  estado text not null check (estado in ('tengo', 'no_aplica', 'no_tengo')),
  updated_at timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.document_checklist enable row level security;
drop policy if exists "Solo el dueño" on public.document_checklist;
create policy "Solo el dueño" on public.document_checklist for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.document_checklist to authenticated, service_role;

-- ===== 0020_nube_duenos.sql =====
-- Nube F1 · Una fila solo puede apuntar a filas del MISMO dueño.
-- Antes, una llave foránea como transactions.account_id → accounts.id solo pedía que la cuenta existiera: con la llave
-- secreta (o con un error de código) un usuario podía quedar ligado a la cuenta de otro. Ahora, junto a cada llave foránea
-- entre tablas con user_id, se agrega otra de dos columnas (columna, user_id) → (id, user_id) del padre.
-- Solo agrega (no borra ni cambia nada) y se puede correr dos veces. Las llaves de antes se quedan igual.
-- Al borrar se porta igual que la llave original (en cascada, o deja la columna vacía).
create table if not exists public.taos_migraciones (nombre text primary key, aplicada timestamptz not null default now());
alter table public.taos_migraciones enable row level security;
do $$ begin
  -- Solo la usa el servidor: los roles públicos de Supabase no la ven (en una base sin esos roles no hace falta)
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on public.taos_migraciones from anon; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then revoke all on public.taos_migraciones from authenticated; end if;
end $$;

do $$
declare
  f record;
  indice text;
  nombre text;
  al_borrar text;
begin
  for f in
    select c.relname hijo, a.attname columna, r.relname padre, k.confdeltype borrar
      from pg_constraint k
      join pg_class c on c.oid = k.conrelid
      join pg_class r on r.oid = k.confrelid
      join pg_attribute a on a.attrelid = c.oid and a.attnum = k.conkey[1]
      join pg_attribute ra on ra.attrelid = r.oid and ra.attnum = k.confkey[1]
     where k.contype = 'f'
       and c.relnamespace = 'public'::regnamespace
       and r.relnamespace = 'public'::regnamespace
       and array_length(k.conkey, 1) = 1
       and ra.attname = 'id'
       and a.attname <> 'user_id'
       and exists (select 1 from pg_attribute x where x.attrelid = c.oid and x.attname = 'user_id' and not x.attisdropped)
       and exists (select 1 from pg_attribute x where x.attrelid = r.oid and x.attname = 'user_id' and not x.attisdropped)
  loop
    indice := left(f.padre || '_id_dueno', 63);
    execute format('create unique index if not exists %I on public.%I (id, user_id)', indice, f.padre);
    nombre := left(f.hijo || '_' || f.columna || '_dueno', 63);
    if not exists (select 1 from pg_constraint where conname = nombre and conrelid = ('public.' || quote_ident(f.hijo))::regclass) then
      al_borrar := case f.borrar when 'c' then 'on delete cascade' when 'n' then format('on delete set null (%I)', f.columna) else '' end;
      execute format('alter table public.%I add constraint %I foreign key (%I, user_id) references public.%I (id, user_id) %s not valid',
        f.hijo, nombre, f.columna, f.padre, al_borrar);
      begin
        execute format('alter table public.%I validate constraint %I', f.hijo, nombre);
      exception when foreign_key_violation then
        -- Hay filas viejas ligadas a otro dueño: la regla ya vale para todo lo nuevo; las viejas se revisan aparte
        raise notice 'TAOS: % tiene filas ligadas a otro dueño; revisar con soporte', nombre;
      end;
    end if;
  end loop;
end $$;

insert into public.taos_migraciones (nombre) values ('0020_nube_duenos') on conflict do nothing;
