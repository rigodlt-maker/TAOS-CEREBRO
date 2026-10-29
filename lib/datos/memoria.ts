// Modo demostración: datos en memoria con los 3 documentos de ejemplo. Se usa cuando no hay Supabase.
import { ejemplos } from "../ejemplos";
import { clasificar, extraerFicha, plano, trocear } from "../extraer";
import { hoyEnMexico } from "../fechas";
import type { Documento, Fragmento, Nota, Pagina, Pregunta, SuscripcionPush } from "../tipos";
import type { Repo } from "./repo";

type Estado = { docs: Documento[]; paginas: Record<string, Pagina[]>; notas: Nota[]; preguntas: Pregunta[]; suscripciones?: SuscripcionPush[] };

const g = globalThis as unknown as { __cerebroDemo?: Estado };

function estado(): Estado {
  if (g.__cerebroDemo) return g.__cerebroDemo;
  const e: Estado = { docs: [], paginas: {}, notas: [], preguntas: [] };
  ejemplos(hoyEnMexico()).forEach((ej, i) => {
    const id = `demo-${i + 1}`;
    const texto = ej.paginas.map((p) => p.contenido).join("\n");
    e.docs.push({
      id,
      nombre: ej.nombre,
      ruta_storage: null,
      tipo_archivo: "application/pdf",
      ...clasificar(texto, ej.nombre),
      estado_procesamiento: "listo",
      error_procesamiento: null,
      created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
      ficha: extraerFicha(ej.paginas),
      avisos_enviados: [],
    });
    e.paginas[id] = trocear(ej.paginas);
  });
  e.notas.push({
    id: "nota-1",
    titulo: "Clave del wifi de la casa",
    contenido: "La red se llama CasaEjemplo y la contraseña está pegada atrás del módem.",
    categoria: "Notas personales",
    created_at: new Date().toISOString(),
  });
  return (g.__cerebroDemo = e);
}

// Puntaje sencillo: cuántas palabras de la búsqueda (por su raíz) aparecen en el texto
function puntaje(texto: string, consulta: string): number {
  const t = plano(texto);
  const raices = [...new Set(plano(consulta).split(/\W+/).filter((w) => w.length >= 3).map((w) => w.slice(0, 5)))];
  return raices.reduce((s, r) => s + (t.includes(r) ? 1 : 0), 0) / Math.max(1, raices.length);
}

export function repoMemoria(): Repo {
  const e = estado();
  const id = () => crypto.randomUUID();
  return {
    modo: "demo",
    async documentos(filtro = {}) {
      return e.docs.filter(
        (d) =>
          (!filtro.categoria || d.categoria === filtro.categoria) &&
          (!filtro.q || puntaje(`${d.nombre} ${d.tipo_documento} ${(e.paginas[d.id] ?? []).map((p) => p.contenido).join(" ")}`, filtro.q) > 0),
      );
    },
    async documento(docId) {
      return e.docs.find((d) => d.id === docId) ?? null;
    },
    async paginasDe(ids) {
      return Object.fromEntries(ids.map((i) => [i, e.paginas[i] ?? []]));
    },
    async crearDocumento(d) {
      const nuevo = id();
      e.docs.unshift({ ...d, id: nuevo, categoria: "Notas personales", tipo_documento: null, estado_procesamiento: "procesando", error_procesamiento: null, created_at: new Date().toISOString(), ficha: null, avisos_enviados: [] });
      return nuevo;
    },
    async guardarProcesado(docId, p) {
      const d = e.docs.find((x) => x.id === docId);
      if (!d) return;
      Object.assign(d, { categoria: p.categoria, tipo_documento: p.tipo_documento, estado_procesamiento: "listo", ficha: p.ficha });
      e.paginas[docId] = p.paginas;
    },
    async marcarError(docId, error) {
      const d = e.docs.find((x) => x.id === docId);
      if (d) Object.assign(d, { estado_procesamiento: "error", error_procesamiento: error });
    },
    async actualizarFicha(docId, datos, ficha) {
      const d = e.docs.find((x) => x.id === docId);
      if (d) Object.assign(d, datos, { ficha });
    },
    async documentosDrive() {
      return e.docs.map((d) => ({ id: d.id, nombre: d.nombre, drive_id: d.drive_id ?? null, drive_actualizado: d.drive_actualizado ?? null, ruta_storage: d.ruta_storage, estado_procesamiento: d.estado_procesamiento, error_procesamiento: d.error_procesamiento, categoria: d.categoria, tipo_documento: d.tipo_documento }));
    },
    async editarDocumento(docId, datos) {
      const d = e.docs.find((x) => x.id === docId);
      if (d) Object.assign(d, datos);
    },
    async enlaceExterno(docId) {
      return e.docs.find((x) => x.id === docId)?.url_externa ?? null;
    },
    async borrarDocumento(docId) {
      e.docs = e.docs.filter((d) => d.id !== docId);
    },
    async marcarAvisos(docId, avisos) {
      const d = e.docs.find((x) => x.id === docId);
      if (d) d.avisos_enviados = avisos;
    },
    async buscar(consulta, limite = 8) {
      const r: Fragmento[] = [];
      for (const d of e.docs) {
        const s = puntaje(`${d.nombre} ${d.tipo_documento} ${d.categoria}`, consulta);
        if (s > 0) r.push({ tipo: "documento", documento_id: d.id, nota_id: null, pagina: null, contenido: d.nombre, rango: s * 1.5 });
        for (const p of e.paginas[d.id] ?? []) {
          const sp = puntaje(p.contenido, consulta);
          if (sp > 0) r.push({ tipo: "fragmento", documento_id: d.id, nota_id: null, pagina: p.pagina, contenido: p.contenido, rango: sp });
        }
      }
      for (const n of e.notas) {
        const s = puntaje(`${n.titulo} ${n.contenido}`, consulta);
        if (s > 0) r.push({ tipo: "nota", documento_id: null, nota_id: n.id, pagina: null, contenido: `${n.titulo}\n${n.contenido}`, rango: s });
      }
      return r.sort((a, b) => b.rango - a.rango).slice(0, limite);
    },
    async urlFirmada() {
      return null;
    },
    async notas() {
      return e.notas;
    },
    async guardarNota({ id: notaId, ...n }) {
      const existente = notaId && e.notas.find((x) => x.id === notaId);
      if (existente) Object.assign(existente, n);
      else e.notas.unshift({ ...n, id: id(), created_at: new Date().toISOString() });
    },
    async borrarNota(notaId) {
      e.notas = e.notas.filter((n) => n.id !== notaId);
    },
    async guardarPregunta(pregunta, respuesta, citas) {
      e.preguntas.unshift({ id: id(), pregunta, respuesta, documentos_citados: citas, created_at: new Date().toISOString() });
    },
    async preguntas(limite = 20) {
      return e.preguntas.slice(0, limite);
    },
    async suscripcionesPush() {
      return [...(e.suscripciones ??= [])];
    },
    async guardarSuscripcionPush(s) {
      e.suscripciones = (e.suscripciones ?? []).filter((x) => x.endpoint !== s.endpoint);
      e.suscripciones.push({ ...s, id: id(), created_at: new Date().toISOString() });
    },
    async borrarSuscripcionPush(endpoint) {
      e.suscripciones = (e.suscripciones ?? []).filter((x) => x.endpoint !== endpoint);
    },
  };
}
