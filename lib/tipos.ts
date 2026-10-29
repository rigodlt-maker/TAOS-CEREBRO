export const CATEGORIAS = [
  "Seguros",
  "Contratos",
  "Identidad y trámites",
  "Salud",
  "Vehículos",
  "Hogar",
  "Finanzas e impuestos",
  "Notas personales",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type Resultado = { ok: true; mensaje: string } | { ok: false; mensaje: string };

// Datos clave de un documento. null = "no especificado": nunca se rellena con suposiciones.
export type Ficha = {
  partes: string | null;
  numero_referencia: string | null; // solo los últimos 4 dígitos
  fecha_inicio: string | null; // AAAA-MM-DD
  fecha_vencimiento: string | null;
  montos: Record<string, number>;
  condiciones_clave: string[];
  contacto: string | null;
  campos_no_especificados: string[];
};

export type Documento = {
  id: string;
  nombre: string;
  ruta_storage: string | null;
  tipo_archivo: string | null;
  categoria: Categoria;
  tipo_documento: string | null;
  estado_procesamiento: "procesando" | "listo" | "error";
  error_procesamiento: string | null;
  created_at: string;
  ficha: Ficha | null;
  avisos_enviados?: string[];
  // Si viene de tu carpeta de Google Drive
  drive_id?: string | null;
  drive_actualizado?: string | null;
  url_externa?: string | null;
};

export type DocumentoDrive = {
  id: string;
  nombre: string;
  drive_id: string | null;
  drive_actualizado: string | null;
  ruta_storage: string | null;
  estado_procesamiento?: string;
  error_procesamiento?: string | null;
  categoria?: string;
  tipo_documento?: string | null;
};

export type Fragmento = {
  tipo: "fragmento" | "documento" | "nota";
  documento_id: string | null;
  nota_id: string | null;
  pagina: number | null;
  contenido: string;
  rango: number;
};

export type Pagina = { pagina: number; contenido: string };

export type Nota = { id: string; titulo: string; contenido: string; categoria: string; created_at: string };

export type Cita = { documento_id?: string; nota_id?: string; nombre: string; pagina?: number | null };

export type Pregunta = { id: string; pregunta: string; respuesta: string; documentos_citados: Cita[]; created_at: string };

export const NOMBRES_CAMPOS: Record<string, string> = {
  partes: "Partes",
  numero_referencia: "Número de referencia",
  fecha_inicio: "Fecha de inicio",
  fecha_vencimiento: "Fecha de vencimiento",
  montos: "Montos",
  condiciones_clave: "Condiciones clave",
  contacto: "Contacto",
};

// Un celular o navegador donde activaste las notificaciones push (tabla compartida con las otras apps TAOS)
export type SuscripcionPush = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  dispositivo: string | null;
  created_at?: string;
};
