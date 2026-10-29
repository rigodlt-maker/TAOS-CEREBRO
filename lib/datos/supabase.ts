import type { SupabaseClient } from "@supabase/supabase-js";
import type { Documento, DocumentoDrive, Ficha, Fragmento, Nota, Pagina, Pregunta, SuscripcionPush } from "../tipos";
import type { Repo } from "./repo";

export const BUCKET = "documentos";

// Nombre de esta app en la tabla compartida de notificaciones push
const APP_PUSH = "cerebro";

type FilaDoc = Omit<Documento, "ficha" | "avisos_enviados"> & {
  document_facts: (Ficha & { avisos_enviados: string[] }) | (Ficha & { avisos_enviados: string[] })[] | null;
};

function aDocumento(fila: FilaDoc): Documento {
  const hechos = Array.isArray(fila.document_facts) ? fila.document_facts[0] : fila.document_facts;
  const { document_facts: _, ...doc } = fila;
  if (!hechos) return { ...doc, ficha: null, avisos_enviados: [] };
  const { avisos_enviados, ...resto } = hechos as Ficha & { avisos_enviados: string[] } & Record<string, unknown>;
  const ficha: Ficha = {
    partes: resto.partes,
    numero_referencia: resto.numero_referencia,
    fecha_inicio: resto.fecha_inicio,
    fecha_vencimiento: resto.fecha_vencimiento,
    montos: resto.montos ?? {},
    condiciones_clave: resto.condiciones_clave ?? [],
    contacto: resto.contacto,
    campos_no_especificados: resto.campos_no_especificados ?? [],
  };
  return { ...doc, ficha, avisos_enviados: avisos_enviados ?? [] };
}

function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const COLUMNAS_DOC = "id, nombre, ruta_storage, tipo_archivo, categoria, tipo_documento, estado_procesamiento, error_procesamiento, created_at, document_facts(*)";

// Todas las consultas filtran por user_id además de RLS (los crons usan la llave secreta, que se salta RLS)
export function repoSupabase(db: SupabaseClient, usuario: string): Repo {
  const fichaAFila = (id: string, f: Ficha) => ({
    user_id: usuario,
    document_id: id,
    partes: f.partes,
    numero_referencia: f.numero_referencia,
    fecha_inicio: f.fecha_inicio,
    fecha_vencimiento: f.fecha_vencimiento,
    montos: f.montos,
    condiciones_clave: f.condiciones_clave,
    contacto: f.contacto,
    campos_no_especificados: f.campos_no_especificados,
  });

  return {
    modo: "supabase",

    async documentos(filtro = {}) {
      let q = db.from("documents").select(COLUMNAS_DOC).eq("user_id", usuario).order("created_at", { ascending: false });
      if (filtro.categoria) q = q.eq("categoria", filtro.categoria);
      if (filtro.q) q = q.textSearch("busqueda", filtro.q, { type: "websearch", config: "spanish" });
      return (revisar(await q) as unknown as FilaDoc[]).map(aDocumento);
    },

    async documentosDrive() {
      return revisar(await db.from("documents").select("id, nombre, drive_id, drive_actualizado, ruta_storage, estado_procesamiento, error_procesamiento, categoria, tipo_documento").eq("user_id", usuario)) as DocumentoDrive[];
    },

    async editarDocumento(id, datos) {
      revisar(await db.from("documents").update(datos).eq("user_id", usuario).eq("id", id));
    },

    async enlaceExterno(id) {
      // Si todavía no se corre el SQL de Drive, simplemente no hay enlace
      const r = await db.from("documents").select("url_externa").eq("user_id", usuario).eq("id", id).maybeSingle();
      return r.error ? null : ((r.data as { url_externa: string | null } | null)?.url_externa ?? null);
    },

    async documento(id) {
      const fila = revisar(await db.from("documents").select(COLUMNAS_DOC).eq("user_id", usuario).eq("id", id).maybeSingle());
      return fila ? aDocumento(fila as unknown as FilaDoc) : null;
    },

    async paginasDe(ids) {
      if (!ids.length) return {};
      const filas = revisar(
        await db.from("document_chunks").select("document_id, pagina, contenido").eq("user_id", usuario).in("document_id", ids).order("pagina"),
      ) as { document_id: string; pagina: number; contenido: string }[];
      const salida: Record<string, Pagina[]> = {};
      for (const f of filas) (salida[f.document_id] ??= []).push({ pagina: f.pagina, contenido: f.contenido });
      return salida;
    },

    async crearDocumento(d) {
      const fila = revisar(await db.from("documents").insert({ ...d, user_id: usuario }).select("id").single());
      return (fila as { id: string }).id;
    },

    async guardarProcesado(id, p) {
      revisar(
        await db
          .from("documents")
          .update({ categoria: p.categoria, tipo_documento: p.tipo_documento, texto_extraido: p.texto, estado_procesamiento: "listo", error_procesamiento: null })
          .eq("user_id", usuario)
          .eq("id", id),
      );
      revisar(await db.from("document_chunks").delete().eq("user_id", usuario).eq("document_id", id));
      if (p.paginas.length) {
        revisar(await db.from("document_chunks").insert(p.paginas.map((x) => ({ user_id: usuario, document_id: id, pagina: x.pagina, contenido: x.contenido }))));
      }
      revisar(await db.from("document_facts").upsert(fichaAFila(id, p.ficha), { onConflict: "document_id" }));
    },

    async marcarError(id, error) {
      revisar(await db.from("documents").update({ estado_procesamiento: "error", error_procesamiento: error.slice(0, 500) }).eq("user_id", usuario).eq("id", id));
    },

    async actualizarFicha(id, datos, ficha) {
      revisar(await db.from("documents").update(datos).eq("user_id", usuario).eq("id", id));
      revisar(await db.from("document_facts").upsert(fichaAFila(id, ficha), { onConflict: "document_id" }));
    },

    async borrarDocumento(id) {
      const doc = revisar(await db.from("documents").select("ruta_storage").eq("user_id", usuario).eq("id", id).maybeSingle());
      if (doc?.ruta_storage) await db.storage.from(BUCKET).remove([doc.ruta_storage]);
      revisar(await db.from("documents").delete().eq("user_id", usuario).eq("id", id));
    },

    async marcarAvisos(id, avisos) {
      revisar(await db.from("document_facts").update({ avisos_enviados: avisos }).eq("user_id", usuario).eq("document_id", id));
    },

    async buscar(consulta, limite = 8) {
      return revisar(await db.rpc("buscar", { consulta, limite, usuario })) as Fragmento[];
    },

    async urlFirmada(ruta, segundos = 600) {
      const { data } = await db.storage.from(BUCKET).createSignedUrl(ruta, segundos);
      return data?.signedUrl ?? null;
    },

    async notas() {
      return revisar(
        await db.from("notes").select("id, titulo, contenido, categoria, created_at").eq("user_id", usuario).order("created_at", { ascending: false }),
      ) as Nota[];
    },

    async guardarNota({ id, ...n }) {
      if (id) revisar(await db.from("notes").update(n).eq("user_id", usuario).eq("id", id));
      else revisar(await db.from("notes").insert({ ...n, user_id: usuario }));
    },

    async borrarNota(id) {
      revisar(await db.from("notes").delete().eq("user_id", usuario).eq("id", id));
    },

    async guardarPregunta(pregunta, respuesta, citas) {
      revisar(await db.from("questions").insert({ user_id: usuario, pregunta, respuesta, documentos_citados: citas }));
    },

    async preguntas(limite = 20) {
      return revisar(
        await db.from("questions").select("*").eq("user_id", usuario).order("created_at", { ascending: false }).limit(limite),
      ) as Pregunta[];
    },
    async suscripcionesPush() {
      return revisar(await db.from("push_subscriptions").select("*").eq("user_id", usuario).eq("app", APP_PUSH).order("created_at")) as SuscripcionPush[];
    },
    async guardarSuscripcionPush(s) {
      // Si el mismo celular se vuelve a suscribir, se actualizan sus llaves
      revisar(await db.from("push_subscriptions").upsert({ ...s, user_id: usuario, app: APP_PUSH }, { onConflict: "endpoint" }));
    },
    async borrarSuscripcionPush(endpoint) {
      revisar(await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", usuario));
    },
  };
}
