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
