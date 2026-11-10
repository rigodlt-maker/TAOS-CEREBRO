import type { Marca } from "../mis-documentos";
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
  marcarParcial(id: string, aviso: string): Promise<void>; // leído pero incompleto (S18): sigue "listo", con su aviso
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
  // Mis documentos: tus marcas de la lista (los subidos se detectan solos)
  marcasDocumentos(): Promise<Record<string, Marca>>;
  marcarDocumento(clave: string, marca: Marca | null): Promise<void>;
  // Tarjetas de crédito que registraste en Administrador Tao (si está en el mismo Supabase); solo lectura
  tarjetasAdministrador(): Promise<TarjetaAdministrador[]>;
}

export type TarjetaAdministrador = { nombre: string; dia_corte: number | null; dia_limite_pago: number | null };
