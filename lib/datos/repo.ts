import type { Categoria, Cita, Documento, Ficha, Fragmento, Nota, Pagina, Pregunta, DocumentoDrive, SuscripcionPush } from "../tipos";

export type NuevoDocumento = { nombre: string; ruta_storage: string | null; tipo_archivo: string | null };

export type Procesado = {
  categoria: Categoria;
  tipo_documento: string;
  texto: string;
  paginas: Pagina[];
  ficha: Ficha;
};

// Acceso a los datos. Dos versiones: Supabase (real) y memoria (modo demostración, sin Supabase).
export interface Repo {
  modo: "supabase" | "demo";
  documentos(filtro?: { categoria?: string; q?: string }): Promise<Documento[]>;
  documento(id: string): Promise<Documento | null>;
  paginasDe(ids: string[]): Promise<Record<string, Pagina[]>>;
  crearDocumento(d: NuevoDocumento): Promise<string>;
  // Sincronización con Google Drive
  documentosDrive(): Promise<DocumentoDrive[]>;
  editarDocumento(id: string, datos: Partial<{ nombre: string; categoria: Categoria; tipo_documento: string; tipo_archivo: string | null; drive_id: string | null; drive_actualizado: string | null; url_externa: string | null }>): Promise<void>;
  enlaceExterno(id: string): Promise<string | null>;
  guardarProcesado(id: string, p: Procesado): Promise<void>;
  marcarError(id: string, error: string): Promise<void>;
  actualizarFicha(id: string, datos: { categoria: Categoria; tipo_documento: string; nombre: string }, ficha: Ficha): Promise<void>;
  borrarDocumento(id: string): Promise<void>;
  marcarAvisos(id: string, avisos: string[]): Promise<void>;
  buscar(consulta: string, limite?: number): Promise<Fragmento[]>;
  urlFirmada(ruta: string, segundos?: number): Promise<string | null>;
  notas(): Promise<Nota[]>;
  guardarNota(n: { id?: string; titulo: string; contenido: string; categoria: string }): Promise<void>;
  borrarNota(id: string): Promise<void>;
  guardarPregunta(pregunta: string, respuesta: string, citas: Cita[]): Promise<void>;
  preguntas(limite?: number): Promise<Pregunta[]>;
  // Notificaciones push de esta app (la tabla es compartida con las otras apps TAOS)
  suscripcionesPush(): Promise<SuscripcionPush[]>;
  guardarSuscripcionPush(s: Omit<SuscripcionPush, "id" | "created_at">): Promise<void>;
  borrarSuscripcionPush(endpoint: string): Promise<void>;
}
