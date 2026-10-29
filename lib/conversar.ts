// Preguntas sobre tu archivo en general (no sobre un dato dentro de un documento):
// saludos, ayuda, "¿qué documentos tengo?", "mis seguros", "¿qué ya venció?", "¿qué me falta?", "pásame mi INE"…
import { plano } from "./extraer";
import { enCuanto, fechaLarga } from "./fechas";
import { queMeFalta } from "./faltantes";
import type { Categoria, Documento, Fragmento, Nota } from "./tipos";
import { estadoVencimiento, vencenEn } from "./vencimientos";

export type Respuesta = { texto: string; citas: { documento_id?: string; nota_id?: string; nombre: string }[] };

export const limpio = (t: string) => plano(t).replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

const enlace = (d: Documento) => `[${d.nombre}](/documentos/${d.id})`;
const citas = (docs: Documento[]) => docs.map((d) => ({ documento_id: d.id, nombre: d.nombre }));

// Palabras con que te refieres a cada categoría
const PALABRAS_CATEGORIA: [Categoria, RegExp][] = [
  ["Seguros", /\b(seguros?|polizas?|aseguradoras?)\b/],
  ["Contratos", /\b(contratos?|arrendamiento|renta)\b/],
  ["Identidad y trámites", /\b(identidad|identificaci\w*|tramites?|ine|pasaporte|curp|acta|actas|credencial\w*|licencias?|cedula)\b/],
  ["Salud", /\b(salud|medic\w*|doctor|recetas?|estudios|analisis|hospital)\b/],
  ["Vehículos", /\b(vehicul\w*|auto|autos|carro|coche|camioneta|moto|versa|tenencia|verificacion|circulacion)\b/],
  ["Hogar", /\b(hogar|casa|depa|departamento|predial|escrituras?|garantias?|luz|agua|recibos?)\b/],
  ["Finanzas e impuestos", /\b(finanzas|impuestos?|sat|rfc|fiscal|bancos?|estados? de cuenta|facturas?|declaracion\w*|nomina)\b/],
  ["Notas personales", /\b(notas? personales?)\b/],
];

// Documentos de otra categoría que también responden a una categoría
const RELACIONADOS: Partial<Record<Categoria, RegExp>> = {
  Vehículos: /auto|vehicul|automovil/,
  Salud: /gastos medicos|medic|hospital/,
  Hogar: /hogar|casa|vivienda|renta/,
};

// Solo palabras genéricas ("mi seguro" → cualquier documento de Seguros); "pasaporte" no debe encontrar tu INE
const GENERICAS_CATEGORIA: [Categoria, RegExp][] = [
  ["Seguros", /^(seguros?|polizas?)$/],
  ["Contratos", /^contratos?$/],
  ["Identidad y trámites", /^(identificaci\w*|identidad)$/],
  ["Salud", /^(salud|medic\w*)$/],
  ["Vehículos", /^(vehicul\w*|auto|autos|carro|coche|camioneta)$/],
  ["Hogar", /^(hogar|casa)$/],
  ["Finanzas e impuestos", /^(impuestos?|fiscal|sat)$/],
];

const AYUDA = [
  "Puedo encontrar cualquier dato de tus documentos. Por ejemplo:",
  "",
  "- ¿Cuándo vence mi seguro del auto?",
  "- ¿A qué teléfono llamo si choco?",
  "- Pásame mi INE",
  "- ¿Qué documentos tengo de salud?",
  "- ¿Qué vence pronto? / ¿Qué ya venció?",
  "- ¿Qué documentos me faltan?",
  "- ¿Qué subí últimamente?",
].join("\n");

function listar(titulo: string, docs: Documento[], hoy: string, max = 15): Respuesta {
  const filas = docs.slice(0, max).map((d) => {
    const f = d.ficha?.fecha_vencimiento;
    return `- ${enlace(d)}${d.tipo_documento ? ` · ${d.tipo_documento}` : ""}${f ? ` · ${enCuanto(f, hoy)}` : ""}`;
  });
  if (docs.length > max) filas.push(`- …y ${docs.length - max} más en la [Biblioteca](/documentos)`);
  return { texto: `${titulo}\n\n${filas.join("\n")}`, citas: citas(docs.slice(0, max)) };
}

// Documentos cuyo nombre, tipo, categoría o ficha coinciden con las palabras de la pregunta (por si la búsqueda de texto no encuentra nada)
export function buscarPorNombre(p: string, docs: Documento[]): Documento[] {
  const vacias = new Set(
    "que cual cuales cuando cuanto donde como mi mis el la los las un una de del en a al y o por para con tengo esta estan es son pasame dame muestrame ensename abre abrir busca buscar encuentra necesito ver documento documentos archivo archivos favor quiero".split(" "),
  );
  const palabras = p.split(" ").filter((w) => w.length >= 3 && !vacias.has(w));
  if (!palabras.length) return [];
  const puntos = docs
    .map((d) => {
      const titulo = limpio([d.nombre, d.tipo_documento ?? "", d.categoria].join(" "));
      const dentro = limpio([d.ficha?.partes ?? "", d.ficha?.condiciones_clave.join(" ") ?? ""].join(" "));
      const enCategoria = GENERICAS_CATEGORIA.find(([c]) => c === d.categoria)?.[1];
      const esta = (texto: string, w: string) => new RegExp(`\\b${w.slice(0, Math.max(3, w.length - 1))}`).test(texto);
      // El nombre y el tipo pesan el doble que lo que dice por dentro ("licencia" no debe traer la póliza que menciona licencias)
      const n = palabras.reduce((t, w) => t + (esta(titulo, w) || (enCategoria?.test(w) ?? false) ? 2 : esta(dentro, w) ? 1 : 0), 0);
      return { d, n };
    })
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const max = puntos[0]?.n ?? 0;
  return puntos.filter((x) => x.n === max).map((x) => x.d);
}

// Convierte los documentos encontrados por nombre en "fragmentos" para que el respondedor use su ficha
export function comoFragmentos(docs: Documento[]): Fragmento[] {
  return docs.map((d, i) => ({ tipo: "documento", documento_id: d.id, nota_id: null, pagina: null, contenido: d.nombre, rango: 1 - i * 0.01 }));
}

export function conversar(pregunta: string, todos: Documento[], notas: Nota[], hoy: string): Respuesta | null {
  const p = limpio(pregunta);
  const docs = todos.filter((d) => d.estado_procesamiento === "listo" || d.ficha);
  const corta = p.split(" ").length <= 4;

  if (!p || /\b(que (puedes|sabes) hacer|ayuda|que te puedo preguntar|como funcionas|que haces)\b/.test(p)) return { texto: AYUDA, citas: [] };

  if (corta && /^(hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|hey|que onda)\b/.test(p)) {
    const pronto = vencenEn(docs, hoy, 60)[0];
    return {
      texto: `¡Hola! Tienes **${docs.length} documentos** guardados.${
        pronto ? ` Lo próximo que vence es ${enlace(pronto)} (${enCuanto(pronto.ficha!.fecha_vencimiento!, hoy)}).` : ""
      }\n\nPregúntame lo que quieras: "¿cuándo vence mi seguro?", "pásame mi INE", "¿qué me falta?".`,
      citas: pronto ? citas([pronto]) : [],
    };
  }
  if (corta && /^((muchas )?gracias|ok|okay|va|vale|perfecto|genial|excelente|listo|sale)\b/.test(p)) return { texto: "¡Con gusto! Aquí estoy. 💛", citas: [] };

  // "¿Qué me falta?"
  if (/\b(que (documentos )?me falta\w*|me faltan|que (documentos )?(debo|deberia|tengo que|me conviene) (subir|tener|guardar)|que falta)\b/.test(p)) {
    const s = queMeFalta(docs, notas);
    if (!s.length) return { texto: "Tienes todos los documentos básicos. 🎉", citas: [] };
    return { texto: `Te sugiero subir:\n\n${s.slice(0, 8).map((x) => `- **${x.documento}**: ${x.porque.toLowerCase()}`).join("\n")}\n\n[Subir ahora](/subir)`, citas: [] };
  }

  // "¿Qué ya venció?"
  if (/\b(vencid\w*|caducad\w*|expirad\w*|ya (se )?vencio|ya (se )?vencieron|ya no (es|son) vigentes?)\b/.test(p)) {
    const vencidos = docs.filter((d) => estadoVencimiento(d.ficha?.fecha_vencimiento, hoy) === "vencido");
    if (!vencidos.length) return { texto: "Ninguno de tus documentos está vencido. 🎉", citas: [] };
    return listar(`Estos documentos ya vencieron (${vencidos.length}):`, vencidos, hoy);
  }

  // "¿Qué subí últimamente?"
  if (/\b(ultim\w* (documentos?|que subi|archivos?)|que subi|recientes?|lo mas nuevo|lo ultimo)\b/.test(p)) {
    const recientes = [...docs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
    if (!recientes.length) return { texto: "Todavía no subes documentos. [Subir ahora](/subir)", citas: [] };
    return listar("Lo último que subiste:", recientes, hoy, 8);
  }

  // "Mis notas"
  if (/\b(mis notas|que notas|notas que)\b/.test(p)) {
    if (!notas.length) return { texto: "No tienes notas todavía. [Escribir una](/notas)", citas: [] };
    return {
      texto: `Tus notas (${notas.length}):\n\n${notas.slice(0, 15).map((n) => `- [${n.titulo}](/notas#${n.id})`).join("\n")}`,
      citas: notas.slice(0, 15).map((n) => ({ nota_id: n.id, nombre: n.titulo })),
    };
  }

  // Listados: "¿qué documentos tengo?", "mis seguros", "¿qué tengo del auto?", "documentos de salud"
  const categoria = PALABRAS_CATEGORIA.find(([, r]) => r.test(p))?.[0];
  const pideLista = /\b((que|cuales) \w+ tengo|que (documentos|archivos|papeles|tengo)|cuales (documentos|tengo|son)|cuantos (documentos|archivos|papeles)|mis (documentos|archivos|papeles|seguros|polizas|contratos|identificaciones)|lista\w*|todos (mis|los)|documentos (de|del|que)|tengo (de|del|algo de))\b/.test(p);
  if (pideLista && !/\b(vence|vencen|cuando|cuanto|cuantos? \w+ (gaste|pague|debo)|telefono|numero|quien|cubre)\b/.test(p)) {
    if (categoria) {
      // También los de otra categoría que tratan de lo mismo (la póliza del auto cuenta como "del carro")
      const deEsa = docs.filter((d) => d.categoria === categoria || RELACIONADOS[categoria]?.test(plano(d.tipo_documento ?? "")));
      if (!deEsa.length) return { texto: `No tienes documentos de **${categoria}** todavía. [Subir uno](/subir)`, citas: [] };
      return listar(`Tus documentos de **${categoria}** (${deEsa.length}):`, deEsa, hoy);
    }
    if (!docs.length) return { texto: "Todavía no subes documentos. [Subir ahora](/subir)", citas: [] };
    const porCat = new Map<string, number>();
    for (const d of docs) porCat.set(d.categoria, (porCat.get(d.categoria) ?? 0) + 1);
    return {
      texto: `Tienes **${docs.length} documentos**:\n\n${[...porCat]
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `- **${c}:** ${n}`)
        .join("\n")}\n\nPregúntame por una categoría ("mis seguros") o ábrelos en la [Biblioteca](/documentos).`,
      citas: [],
    };
  }

  // "Pásame mi INE", "¿dónde está mi póliza?", "abre el contrato de renta"
  if (/\b(pasame|dame|muestrame|ensename|mandame|abre|abrir|donde (esta|estan|tengo|guarde)|encuentra|busca|necesito|quiero ver|ver)\b/.test(p) && !/\b(cuando|cuanto|telefono|numero|quien|cubre|vence)\b/.test(p)) {
    const encontrados = buscarPorNombre(p, docs);
    if (encontrados.length === 1) {
      const d = encontrados[0];
      const f = d.ficha?.fecha_vencimiento;
      return {
        texto: `Aquí está: ${enlace(d)}${d.tipo_documento ? ` (${d.tipo_documento})` : ""}.${f ? `\n\nVigencia: hasta el **${fechaLarga(f)}** (${enCuanto(f, hoy)}).` : ""}\n\nÁbrelo para verlo o descargarlo.`,
        citas: citas([d]),
      };
    }
    if (encontrados.length > 1) return listar(`Encontré ${encontrados.length} documentos:`, encontrados, hoy, 8);
  }

  return null;
}
