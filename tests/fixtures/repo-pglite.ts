// Repo de prueba con Postgres real (PGlite): misma búsqueda en español que Supabase, para probar a Tao como en producción
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import type { Repo } from "../../lib/datos/repo";
import { procesarTexto } from "../../lib/procesar";
import type { Cita, Documento, Fragmento, Nota, Pagina } from "../../lib/tipos";
import { DOCUMENTOS_EJEMPLO, NOTA_EJEMPLO } from "./documentos";

const SIMULACION = `
  create role authenticated nologin; create role service_role nologin;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-00000000000a'::uuid $$;
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
  insert into auth.users values ('00000000-0000-0000-0000-00000000000a');
`;

export async function repoDePrueba(): Promise<Repo & { historial: { pregunta: string; respuesta: string; citas: Cita[] }[] }> {
  const db = new PGlite();
  await db.exec(SIMULACION);
  for (const f of readdirSync("supabase/migrations").sort()) await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  const docs: Documento[] = [];
  const paginas: Record<string, Pagina[]> = {};
  const notas: Nota[] = [];
  const historial: { pregunta: string; respuesta: string; citas: Cita[] }[] = [];

  const repo = {
    modo: "supabase",
    historial,
    async documentos() {
      return docs;
    },
    async documento(id: string) {
      return docs.find((d) => d.id === id) ?? null;
    },
    async paginasDe(ids: string[]) {
      return Object.fromEntries(ids.map((id) => [id, paginas[id] ?? []]));
    },
    async crearDocumento(d: { nombre: string }) {
      const r = await db.query<{ id: string }>("insert into documents (nombre) values ($1) returning id", [d.nombre]);
      const id = r.rows[0].id;
      docs.push({ id, nombre: d.nombre, ruta_storage: null, tipo_archivo: null, categoria: "Notas personales", tipo_documento: null, estado_procesamiento: "procesando", error_procesamiento: null, created_at: new Date().toISOString(), ficha: null });
      return id;
    },
    async guardarProcesado(id: string, p: { categoria: Documento["categoria"]; tipo_documento: string; texto: string; paginas: Pagina[]; ficha: Documento["ficha"] }) {
      await db.query("update documents set categoria = $2, tipo_documento = $3, texto_extraido = $4, estado_procesamiento = 'listo' where id = $1", [id, p.categoria, p.tipo_documento, p.texto]);
      for (const pg of p.paginas) await db.query("insert into document_chunks (document_id, pagina, contenido) values ($1, $2, $3)", [id, pg.pagina, pg.contenido]);
      paginas[id] = p.paginas;
      Object.assign(docs.find((d) => d.id === id)!, { categoria: p.categoria, tipo_documento: p.tipo_documento, ficha: p.ficha, estado_procesamiento: "listo" });
    },
    async marcarError() {},
    async buscar(consulta: string, limite = 8) {
      const r = await db.query<Fragmento>("select * from buscar($1, $2)", [consulta, limite]);
      return r.rows.map((x) => ({ ...x, rango: Number(x.rango) }));
    },
    async notas() {
      return notas;
    },
    async guardarNota(n: { titulo: string; contenido: string; categoria: string }) {
      const r = await db.query<{ id: string }>("insert into notes (titulo, contenido) values ($1, $2) returning id", [n.titulo, n.contenido]);
      notas.push({ id: r.rows[0].id, titulo: n.titulo, contenido: n.contenido, categoria: n.categoria, created_at: new Date().toISOString() });
    },
    async guardarPregunta(pregunta: string, respuesta: string, citas: Cita[]) {
      historial.push({ pregunta, respuesta, citas });
    },
  } as unknown as Repo & { historial: typeof historial };

  for (const d of DOCUMENTOS_EJEMPLO) {
    const id = await repo.crearDocumento({ nombre: d.nombre, ruta_storage: null, tipo_archivo: null });
    await procesarTexto(repo, id, d.nombre, d.paginas.map((contenido, i) => ({ pagina: i + 1, contenido })));
  }
  await repo.guardarNota({ ...NOTA_EJEMPLO, categoria: "Notas personales" });
  return repo;
}
