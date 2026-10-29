// Tus datos de identificación sacados de tus propios documentos: "¿cuál es mi RFC?", "mi CURP", "mi NSS", "número de pasaporte"
import { plano } from "./extraer";
import type { Documento, Pagina } from "./tipos";

type Dato = {
  nombre: string;
  pide: RegExp; // cómo lo preguntas
  docs: RegExp; // en qué documentos buscar primero
  sugerencia: string; // qué subir si no está
  extraer: (texto: string) => string | null;
};

const primero = (re: RegExp) => (t: string) => t.match(re)?.[1] ?? null;

const DATOS: Dato[] = [
  {
    nombre: "RFC",
    pide: /\brfc\b|registro federal de contribuyentes/,
    docs: /constancia de situacion fiscal|\brfc\b|fiscal/,
    sugerencia: "tu constancia de situación fiscal",
    extraer: primero(/\b([A-ZÑ&]{4}\d{6}[A-Z0-9]{3})\b/),
  },
  { nombre: "CURP", pide: /\bcurp\b/, docs: /\bcurp\b/, sugerencia: "tu CURP", extraer: primero(/\b([A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d)\b/) },
  {
    nombre: "Número de Seguridad Social (NSS)",
    pide: /\bnss\b|seguridad social|seguro social|numero del imss|numero de imss/,
    docs: /\bnss\b|seguridad social|imss/,
    sugerencia: "la hoja de tu Número de Seguridad Social (IMSS)",
    extraer: (t) => t.match(/(?:NSS|SEGURIDAD SOCIAL)[^0-9]{0,80}(\d{11})\b/)?.[1] ?? t.match(/\b(\d{11})\b/)?.[1] ?? null,
  },
  {
    nombre: "número de pasaporte",
    pide: /(numero|num|no) (de |del )?pasaporte|pasaporte (numero|no)\b/,
    docs: /pasaporte/,
    sugerencia: "tu pasaporte",
    // El escaneo a veces lee el cero como letra O ("NO7719224" → "N07719224")
    extraer: (t) => {
      const m = t.match(/(?:PASAPORTE NO|PASSPORT NO)[^A-Z0-9]{0,40}([A-Z][0-9O]{8})\b/) ?? t.match(/\b([A-Z]\d{8})\b/);
      return m ? m[1][0] + m[1].slice(1).replace(/O/g, "0") : null;
    },
  },
  {
    nombre: "número de cédula profesional",
    pide: /cedula( profesional)?/,
    docs: /cedula/,
    sugerencia: "tu cédula profesional",
    extraer: primero(/\b(\d{7,8})\b/),
  },
];

const PIDE_VALOR = /\b(cual|cuales|dame|dime|pasame|mi|mis|numero|necesito|copia)\b/;

// null si la pregunta no es por uno de tus datos (o si es sobre su vigencia: eso lo contesta la ficha)
export function datoPedido(pregunta: string): Dato | null {
  const p = plano(pregunta).replace(/[¿?¡!.,]/g, " ");
  if (/venc|caduc|expir|vigen|renov/.test(p) || !PIDE_VALOR.test(p)) return null;
  return DATOS.find((d) => d.pide.test(p)) ?? null;
}

export function responderDato(dato: Dato, docs: Documento[], paginas: Record<string, Pagina[]>): { texto: string; citas: { documento_id: string; nombre: string }[] } {
  const relevancia = (d: Documento) => (dato.docs.test(plano(`${d.tipo_documento ?? ""} ${d.nombre}`)) ? 0 : 1);
  for (const d of [...docs].sort((a, b) => relevancia(a) - relevancia(b))) {
    const texto = (paginas[d.id] ?? []).map((p) => p.contenido).join("\n").toUpperCase();
    const valor = texto && dato.extraer(texto);
    if (valor)
      return {
        texto: `Tu **${dato.nombre}** es **${valor}**.\n\nLo saqué de tu [${d.tipo_documento ?? d.nombre}](/documentos/${d.id}).`,
        citas: [{ documento_id: d.id, nombre: d.nombre }],
      };
  }
  return { texto: `No encontré tu ${dato.nombre} en tus documentos.\n\nTe sugiero subir ${dato.sugerencia} a tu carpeta de Drive.`, citas: [] };
}
