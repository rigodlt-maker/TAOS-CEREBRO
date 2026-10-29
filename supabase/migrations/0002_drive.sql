-- Documentos que vienen de tu carpeta de Google Drive: se actualizan solos cuando cambias el archivo en Drive
alter table public.documents add column drive_id text;
alter table public.documents add column drive_actualizado timestamptz;
alter table public.documents add column url_externa text;
create unique index documents_drive_id on public.documents (user_id, drive_id) where drive_id is not null;
