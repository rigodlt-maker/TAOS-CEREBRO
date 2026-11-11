// S11-M contra Postgres REAL (no PGlite, no memoria): las migraciones de verdad, con el índice único
// documents_drive_id (user_id, drive_id). Se activa con TAOS_PG_URL; si no está, se salta.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { Client } from "pg";
import type { Repo } from "../lib/datos/repo";
import { sincronizarLista, unirDocumentos } from "../lib/drive";

const PG = process.env.TAOS_PG_URL;
const U = "00000000-0000-0000-0000-00000000000a";
const BASE = `
  do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
  do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select '${U}'::uuid $$;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  insert into auth.users values ('${U}');`;

let n = 0;
async function base() {
  const admin = new Client({ connectionString: PG });
  await admin.connect();
  const nombre = `cerebro_s11m_${process.pid}_${n++}`;
  await admin.query(`create database ${nombre}`);
  await admin.end();
  const c = new Client({ connectionString: PG!.replace(/\/[^/]*$/, `/${nombre}`) });
  await c.connect();
  await c.query(BASE);
  for (const f of readdirSync("supabase/migrations").sort()) await c.query(readFileSync(`supabase/migrations/${f}`, "utf8"));
  const cerrar = async () => {
    await c.end();
    const a = new Client({ connectionString: PG });
    await a.connect();
    await a.query(`drop database ${nombre} with (force)`);
    await a.end();
  };
  return { c, cerrar };
}

// Lo mínimo del repo que usa la unión, con SQL de verdad. fallar.* hace que ese paso truene como una caída de la base.
function repoPg(c: Client, fallar: { editar?: (id: string) => boolean; borrar?: boolean } = {}) {
  return {
    async documentosDrive() {
      return (
        await c.query(
          `select id, nombre, drive_id, drive_actualizado, ruta_storage, estado_procesamiento, error_procesamiento, categoria, tipo_documento from documents where user_id = $1`,
          [U],
        )
      ).rows;
    },
    async editarDocumento(id: string, datos: Record<string, unknown>) {
      if (fallar.editar?.(id)) throw new Error("se cayó la base");
      const k = Object.keys(datos);
      await c.query(`update documents set ${k.map((x, i) => `${x} = $${i + 3}`).join(", ")} where user_id = $1 and id = $2`, [U, id, ...k.map((x) => datos[x])]);
    },
    async enlaceExterno(id: string) {
      return (await c.query(`select url_externa from documents where id = $1`, [id])).rows[0]?.url_externa ?? null;
    },
    async borrarDocumento(id: string) {
      if (fallar.borrar) throw new Error("se cayó la base");
      await c.query(`delete from documents where user_id = $1 and id = $2`, [U, id]);
    },
  } as unknown as Repo;
}

async function dos(c: Client) {
  const manual = (await c.query(`insert into documents (user_id, nombre, ruta_storage, estado_procesamiento) values ($1, 'CURP.pdf', 'u/curp.pdf', 'listo') returning id`, [U])).rows[0].id as string;
  const copia = (
    await c.query(
      `insert into documents (user_id, nombre, drive_id, url_externa, drive_actualizado, estado_procesamiento) values ($1, 'CURP.pdf', 'd9', 'https://drive.google.com/file/d/d9/view', '2026-11-01T00:00:00Z', 'listo') returning id`,
      [U],
    )
  ).rows[0].id as string;
  return { manual, copia };
}
const archivo = { id: "d9", nombre: "CURP.pdf", mime: "application/pdf", actualizado: "2026-11-01T00:00:00Z", url: "https://drive.google.com/file/d/d9/view" };

test("S11-M (Postgres real): el índice único no deja dos documentos con el mismo drive_id; la unión sí funciona", { skip: !PG }, async () => {
  const { c, cerrar } = await base();
  try {
    const { manual, copia } = await dos(c);
    await assert.rejects(c.query(`update documents set drive_id = 'd9' where id = $1`, [manual]), /documents_drive_id/);
    await unirDocumentos(repoPg(c), manual, copia);
    const filas = (await c.query(`select id, drive_id, url_externa from documents`)).rows;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].id, manual);
    assert.equal(filas[0].drive_id, "d9");
    assert.equal(filas[0].url_externa, "https://drive.google.com/file/d/d9/view");
  } finally {
    await cerrar();
  }
});

test("S11-M (Postgres real): si la base falla al editar tu documento, no se borra la copia y todo queda como estaba", { skip: !PG }, async () => {
  const { c, cerrar } = await base();
  try {
    const { manual, copia } = await dos(c);
    await assert.rejects(unirDocumentos(repoPg(c, { editar: (id) => id === manual }), manual, copia), /No se borró nada/);
    const filas = (await c.query(`select id, drive_id from documents`)).rows;
    assert.equal(filas.length, 2);
    assert.equal(filas.find((f) => f.id === copia).drive_id, "d9");
    assert.equal(filas.find((f) => f.id === manual).drive_id, null);
  } finally {
    await cerrar();
  }
});

test("S11-M (Postgres real): caída a la mitad (ni se une ni se deshace): la sincronización siguiente lo deshace sin crear otro", { skip: !PG }, async () => {
  const { c, cerrar } = await base();
  try {
    const { manual, copia } = await dos(c);
    let veces = 0;
    await assert.rejects(unirDocumentos(repoPg(c, { editar: (id) => id === manual || (id === copia && ++veces > 1) }), manual, copia));
    assert.match((await c.query(`select drive_id from documents where id = $1`, [copia])).rows[0].drive_id, /^d9#uniendo:/);
    const r = await sincronizarLista(repoPg(c), [archivo]);
    assert.deepEqual(r.pedir, []);
    const filas = (await c.query(`select id, drive_id from documents`)).rows;
    assert.equal(filas.length, 2);
    assert.equal(filas.find((f) => f.id === copia).drive_id, "d9");
  } finally {
    await cerrar();
  }
});

test("S11-M (Postgres real): unido pero falla quitar la copia: tu documento ya tiene Drive y la copia se quita al sincronizar", { skip: !PG }, async () => {
  const { c, cerrar } = await base();
  try {
    const { manual, copia } = await dos(c);
    await unirDocumentos(repoPg(c, { borrar: true }), manual, copia);
    assert.equal((await c.query(`select drive_id from documents where id = $1`, [manual])).rows[0].drive_id, "d9");
    await sincronizarLista(repoPg(c), [archivo]);
    const filas = (await c.query(`select id from documents`)).rows;
    assert.deepEqual(
      filas.map((f) => f.id),
      [manual],
    );
  } finally {
    await cerrar();
  }
});
