// Valida las migraciones en un Postgres embebido (PGlite) con un esquema "auth" y "storage" simulado,
// comprueba que Row Level Security aísla los datos de cada usuario y que la búsqueda en español funciona.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const SIMULACION_SUPABASE = `
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  alter table storage.objects enable row level security;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

test("las migraciones se aplican, RLS separa a los usuarios y la búsqueda encuentra el seguro", async () => {
  const db = new PGlite();
  await db.exec(SIMULACION_SUPABASE);
  for (const archivo of readdirSync("supabase/migrations").sort()) {
    await db.exec(readFileSync(`supabase/migrations/${archivo}`, "utf8"));
  }
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}');
    grant usage on schema public, auth, storage to authenticated;
    grant execute on all functions in schema auth to authenticated;
  `);

  const como = async (usuario: string, sql: string) => {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${usuario}', false);`);
    try {
      return await db.query<Record<string, unknown>>(sql);
    } finally {
      await db.exec("reset role;");
    }
  };

  const doc = (await como(A, `insert into documents (nombre, categoria, tipo_documento, texto_extraido, estado_procesamiento)
    values ('Póliza Qualitas', 'Seguros', 'Póliza de seguro de auto', 'Vigencia hasta el 15 de marzo de 2027', 'listo') returning id`)).rows[0].id;
  await como(A, `insert into document_chunks (document_id, pagina, contenido) values ('${doc}', 2, 'El seguro vence el 15 de marzo de 2027')`);
  await como(B, `insert into notes (titulo, contenido) values ('Seguro de B', 'mi seguro')`);

  // A encuentra su póliza con una pregunta natural, y no ve la nota de B
  const r = await como(A, `select tipo, pagina from buscar('¿Cuándo vence mi seguro?')`);
  assert.ok(r.rows.some((f) => f.tipo === "fragmento" && f.pagina === 2));
  assert.ok(!r.rows.some((f) => f.tipo === "nota"));

  // B no ve nada de A ni puede insertar a nombre de A
  assert.equal((await como(B, `select * from documents`)).rows.length, 0);
  await assert.rejects(como(B, `insert into notes (user_id, titulo) values ('${A}', 'Intruso')`));

  // Una sola ficha por documento, y se borra junto con el documento
  await como(A, `insert into document_facts (document_id, fecha_vencimiento) values ('${doc}', '2027-03-15')`);
  await assert.rejects(como(A, `insert into document_facts (document_id) values ('${doc}')`));
  await como(A, `delete from documents where id = '${doc}'`);
  assert.equal((await como(A, `select * from document_facts`)).rows.length, 0);

  // Notificaciones push: cada quien ve solo sus celulares y la migración se puede correr dos veces
  await como(A, `insert into push_subscriptions (app, endpoint, p256dh, auth) values ('cerebro', 'https://push/a', 'k', 'x')`);
  assert.equal((await como(B, `select * from push_subscriptions`)).rows.length, 0);
  await db.exec(readFileSync("supabase/migrations/0003_push.sql", "utf8"));

  await db.close();
});
