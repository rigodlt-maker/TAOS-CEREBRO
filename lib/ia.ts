import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { enmascarar } from "./enmascarar";
import { CATEGORIAS, type Categoria, type Ficha, type Pagina } from "./tipos";

// IA opcional: sin ANTHROPIC_API_KEY la app usa reglas (lib/extraer.ts y lib/responder.ts).

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

const REGLAS_BASE = `Eres el asistente de un "segundo cerebro" personal: el archivo de papeles de un usuario en México.
Reglas que siempre aplican:
- Usa solo la información que recibes. Si un dato no aparece, es "no especificado": nunca completes campos con suposiciones.
- Nunca muestres números completos de identificación, cuentas, tarjetas, CURP o RFC; solo los últimos 4 dígitos.
- Puedes explicar lo que dice una cláusula, pero no das interpretaciones legales ni consejos legales; si te lo piden, sugiere consultar a un abogado.
- Escribe en español de México, claro y breve.`;

export function iaDisponible(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const EsquemaFicha = z.object({
  categoria: z.enum(CATEGORIAS),
  tipo_documento: z.string().describe('Ej. "Póliza de seguro de auto", "Contrato de renta", "Garantía", "INE"'),
  partes: z.string().nullable().describe("Personas o empresas involucradas, con su papel. null si no aparece"),
  numero_referencia: z.string().nullable().describe("Número de póliza, contrato o folio: SOLO los últimos 4 dígitos. null si no aparece"),
  fecha_inicio: z.string().nullable().describe("AAAA-MM-DD o null"),
  fecha_vencimiento: z.string().nullable().describe("AAAA-MM-DD o null"),
  montos: z.array(z.object({ concepto: z.string(), monto: z.number() })).describe("Prima, renta, deducible, suma asegurada, etc."),
  condiciones_clave: z.array(z.string()).describe("Hasta 3: plazo de aviso, exclusiones, renovación automática, penalizaciones"),
  contacto: z.string().nullable().describe("Teléfono o correo para hacer trámites. null si no aparece"),
});

export async function extraerConIA(paginas: Pagina[], nombre: string): Promise<{ categoria: Categoria; tipo_documento: string; ficha: Ficha }> {
  if (!iaDisponible()) throw new Error("La IA no está activada.");
  const texto = paginas.map((p) => `--- Página ${p.pagina} ---\n${p.contenido}`).join("\n\n");
  const respuesta = await new Anthropic().beta.messages.parse({
    model: MODELO,
    max_tokens: 16000,
    // Si el modelo declina por sus filtros de seguridad, la API reintenta con otro modelo
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(EsquemaFicha) },
    system: `${REGLAS_BASE}\n\nExtrae la ficha de datos clave del documento. Si un campo no aparece en el texto, usa null (o una lista vacía).`,
    messages: [{ role: "user", content: `Documento: ${nombre}\n\n${texto}` }],
  });
  if (respuesta.stop_reason === "refusal") throw new Error("La IA no pudo procesar este documento.");
  const r = respuesta.parsed_output;
  if (!r) throw new Error("La IA respondió en un formato inesperado.");
  const ficha: Ficha = {
    partes: r.partes ? enmascarar(r.partes) : null,
    numero_referencia: r.numero_referencia,
    fecha_inicio: /^\d{4}-\d{2}-\d{2}$/.test(r.fecha_inicio ?? "") ? r.fecha_inicio : null,
    fecha_vencimiento: /^\d{4}-\d{2}-\d{2}$/.test(r.fecha_vencimiento ?? "") ? r.fecha_vencimiento : null,
    montos: Object.fromEntries(r.montos.filter((m) => m.monto > 0).map((m) => [m.concepto, m.monto])),
    condiciones_clave: r.condiciones_clave.slice(0, 3).map(enmascarar),
    contacto: r.contacto,
    campos_no_especificados: [],
  };
  return { categoria: r.categoria, tipo_documento: r.tipo_documento, ficha };
}

// Respuesta en streaming usando solo los fragmentos encontrados
export async function* responderConIA(pregunta: string, contexto: string, hoy: string): AsyncGenerator<string> {
  const stream = new Anthropic().beta.messages.stream({
    model: MODELO,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: `${REGLAS_BASE}

Hoy es ${hoy}. Responde la pregunta usando SOLO los fragmentos y fichas de abajo.
Formato:
- Primera línea: el dato exacto en **negritas**.
- Después: el documento y la página de origen como enlace Markdown, usando exactamente el enlace que viene en cada fragmento.
- Si dos documentos podrían responder (por ejemplo, dos pólizas de auto), muestra ambos y pregunta cuál.
- Si la fecha ya pasó o falta menos de 30 días, agrega una línea "⚠️ Ojo: ...".
- Si la información no está, di "No encontré eso en tus documentos" y sugiere qué documento subir.`,
    messages: [{ role: "user", content: `Fragmentos:\n${contexto}\n\nPregunta: ${pregunta}` }],
  });
  for await (const evento of stream) {
    if (evento.type === "content_block_delta" && evento.delta.type === "text_delta") yield evento.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield "\n\nNo pude responder esa pregunta.";
}
