// Tus datos de identificación sacados de tus propios documentos: "¿cuál es mi RFC?", "mi CURP", "mi NSS", "número de pasaporte"
import { plano } from "./extraer";
import { fechaLarga, hoyEnMexico } from "./fechas";
import type { Documento, Pagina } from "./tipos";

type Dato = {
  nombre: string;
  pide: RegExp; // cómo lo preguntas
  docs: RegExp; // en qué documentos buscar primero
  sugerencia: string; // qué subir si no está
  extraer: (texto: string) => string | null;
};

const primero = (re: RegExp) => (t: string) => t.match(re)?.[1] ?? null;

const LETRAS = "A-ZÁÉÍÓÚÜÑ";
const ETIQUETAS = /\b(RFC|CURP|DOMICILIO|NO|FECHA|TARIFA|SEXO|CLAVE|EDAD|NACIONALIDAD|NUM|NUMERO|LUGAR|CODIGO|C\.P)\b.*$/;
const PARTICULAS = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "VAN", "VON", "DA", "DI", "SAN"]);

// "PÉREZ" → "Pérez", "DE LA TORRE" → "De La Torre"
const bonito = (t: string) => t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, e, l) => e + l.toUpperCase());

// Une "DE LA TORRE" en un solo apellido para no confundirlo con un nombre
function unidades(palabras: string[]): string[] {
  const out: string[] = [];
  let pendiente: string[] = [];
  for (const w of palabras) {
    pendiente.push(w);
    if (!PARTICULAS.has(w)) {
      out.push(pendiente.join(" "));
      pendiente = [];
    }
  }
  if (pendiente.length) out.push(pendiente.join(" "));
  return out;
}

// Nombre completo: acta/CURP ("NOMBRE(S): … PRIMER APELLIDO: …"), "NOMBRE: JUAN PÉREZ" o la INE ("NOMBRE PÉREZ EJEMPLO JUAN DOMICILIO")
export function nombreCompleto(t: string): string | null {
  const palabra = `[${LETRAS}]+`;
  const varias = `${palabra}(?:[ \\t]${palabra}){0,4}`;
  const corta = `${palabra}(?:[ \\t]${palabra}){0,4}?`;
  const acta = t.match(new RegExp(`NOMBRE(?:\\(S\\)|S)?\\s*:?\\s*(${corta})\\s+PRIMER APELLIDO\\s*:?\\s*(${corta})(?:\\s+SEGUNDO APELLIDO\\s*:?\\s*(${varias}))?(?![ \\t]?[${LETRAS}])`));
  if (acta) return bonito([acta[1], acta[2], acta[3]].filter(Boolean).join(" "));
  const ine = t.match(new RegExp(`NOMBRE\\s+((?:${palabra}\\s+){2,8}?)DOMICILIO`));
  if (ine) {
    const u = unidades(ine[1].trim().split(/\s+/));
    if (u.length >= 3) return bonito([...u.slice(2), u[0], u[1]].join(" "));
  }
  const etiqueta = t.match(new RegExp(`NOMBRE(?:\\(S\\))?\\s*:\\s*(${palabra}(?:[ \\t]${palabra}){1,5})`));
  if (etiqueta) {
    const limpio = etiqueta[1].replace(ETIQUETAS, "").trim();
    if (limpio.split(" ").length >= 2) return bonito(limpio);
  }
  return null;
}

// Fecha de nacimiento escrita en el documento o, si no, la que viene dentro de la CURP
export function fechaNacimiento(t: string): string | null {
  const escrita = t.match(/FECHA DE NACIMIENTO\s*:?\s*(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (escrita) return `${escrita[3]}-${escrita[2]}-${escrita[1]}`;
  const curp = t.match(/\b[A-Z]{4}(\d{2})(\d{2})(\d{2})[HM][A-Z]{5}([A-Z0-9])\d\b/);
  if (!curp) return null;
  const siglo = /\d/.test(curp[4]) ? "19" : "20";
  return `${siglo}${curp[1]}-${curp[2]}-${curp[3]}`;
}

export function edad(nacimiento: string, hoy: string): number {
  const [a, m, d] = nacimiento.split("-").map(Number);
  const [ha, hm, hd] = hoy.split("-").map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

function domicilio(t: string): string | null {
  const m = t.match(/DOMICILIO\s*:?\s*([\s\S]{8,160}?)\s+(?:CLAVE DE ELECTOR|CURP|AÑO DE REGISTRO|FECHA|RFC|$)/);
  return m ? bonito(m[1].replace(/\s+/g, " ").trim()) : null;
}

const DATOS: Dato[] = [
  {
    nombre: "nombre completo",
    pide: /\bcomo me llamo\b|\bmi nombre\b|\bnombre completo\b|\bcomo me llaman\b/,
    docs: /\bine\b|credencial|acta de nacimiento|\bcurp\b|pasaporte|licencia/,
    sugerencia: "tu INE o tu acta de nacimiento",
    extraer: nombreCompleto,
  },
  {
    nombre: "fecha de nacimiento",
    pide: /fecha de nacimiento|cuando naci|(mi )?cumple(anos)?\b|que edad tengo|cuantos anos tengo|mi edad/,
    docs: /\bine\b|credencial|acta de nacimiento|\bcurp\b|pasaporte/,
    sugerencia: "tu INE, tu CURP o tu acta de nacimiento",
    extraer: (t) => {
      const f = fechaNacimiento(t);
      return f ? `${fechaLarga(f)} (${edad(f, hoyEnMexico())} años)` : null;
    },
  },
  {
    nombre: "domicilio",
    pide: /\bmi (domicilio|direccion)\b|donde vivo/,
    docs: /\bine\b|credencial|comprobante|domicilio|cfe|agua|predial/,
    sugerencia: "tu INE o un comprobante de domicilio",
    extraer: domicilio,
  },
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
    nombre: "clave de elector",
    pide: /clave de elector/,
    docs: /\bine\b|credencial|elector/,
    sugerencia: "tu INE",
    extraer: (t) => t.match(/CLAVE DE ELECTOR[^A-Z0-9]{0,10}([A-Z]{6}\d{8}[HM]\d{3})\b/)?.[1] ?? null,
  },
  {
    nombre: "tipo de sangre",
    pide: /tipo de sangre|grupo sanguineo|que sangre/,
    docs: /licencia|medic|salud|sangre/,
    sugerencia: "tu licencia de conducir o un estudio de laboratorio",
    extraer: (t) => t.match(/(?:TIPO DE SANGRE|GRUPO SANGU[IÍ]NEO|SANGRE)[^A-Z0-9]{0,15}((?:AB|A|B|O)\s?[+-]|(?:AB|A|B|O)\s?(?:POSITIVO|NEGATIVO))/)?.[1]?.replace(/\s/g, "") ?? null,
  },
  {
    nombre: "placa",
    pide: /\bplacas?\b/,
    docs: /circulacion|poliza|auto|vehicul|factura/,
    sugerencia: "la tarjeta de circulación",
    extraer: (t) => t.match(/PLACAS?\s*:?\s*([A-Z0-9]{2,4}-?[A-Z0-9]{2,4}-?[A-Z0-9]{0,3})\b/)?.[1] ?? null,
  },
  {
    nombre: "número de serie (NIV) del auto",
    pide: /(numero de )?serie (del|de mi) (auto|carro|coche|vehiculo|camioneta|[a-z]+)|\bniv\b|\bvin\b/,
    docs: /circulacion|factura|poliza|auto|vehicul/,
    sugerencia: "la tarjeta de circulación o la factura del auto",
    extraer: (t) => t.match(/(?:SERIE|NIV|VIN)[^A-Z0-9]{0,20}([A-HJ-NPR-Z0-9]{17})\b/)?.[1] ?? null,
  },
  {
    nombre: "número de licencia",
    pide: /(numero|num|no) (de |del )?(mi )?licencia/,
    docs: /licencia/,
    sugerencia: "tu licencia de conducir",
    extraer: (t) => t.match(/(?:NO\.?|N[UÚ]MERO|N[°º])\s*(?:DE\s+)?LICENCIA\s*:?\s*([A-Z0-9]{6,12})\b/)?.[1] ?? null,
  },
  {
    nombre: "número de cédula profesional",
    pide: /cedula( profesional)?/,
    docs: /cedula/,
    sugerencia: "tu cédula profesional",
    extraer: primero(/\b(\d{7,8})\b/),
  },
];

const PIDE_VALOR = /\b(cual|cuales|dame|dime|pasame|mi|mis|numero|necesito|copia|que|como|cuando|donde|cuantos)\b/;

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
