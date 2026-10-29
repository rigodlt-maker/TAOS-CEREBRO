// Responder preguntas sin IA: busca en tus documentos y contesta con el dato exacto y su origen.
// Solo usa lo que dicen los documentos; si no está, lo dice y sugiere qué subir.
import { enmascarar } from "./enmascarar";
import { plano } from "./extraer";
import { buscarFechas, enCuanto, fechaLarga } from "./fechas";
import type { Cita, Documento, Fragmento, Nota, Pagina } from "./tipos";
import { estadoVencimiento, vencenEn } from "./vencimientos";

export type Intencion = "vencimiento" | "inicio" | "monto" | "contacto" | "numero" | "partes" | "condiciones" | "general";

// El orden importa: gana la primera que coincide
const INTENCIONES: [Intencion, RegExp][] = [
  ["inicio", /(cuando|desde cuando) (empieza|inicia|comienza|empezo|inicio)|fecha de inicio|desde cuando/],
  [
    "vencimiento",
    /venc|caduc|expir|hasta cuando|cuando (se )?(termina|acaba|vence)|se termina|vigencia|vigente|renovar|renovacion|fecha limite|limite de pago|cuando (tengo que|debo|hay que) pagar|cuando (pago|se paga)/,
  ],
  [
    "contacto",
    /telefono|contacto|llamar|llamo|marcar|whats|correo|email|siniestro|cabina|numero (de|del|para) (la |el )?(aseguradora|seguro|cabina|banco|casero|arrendador|doctor|medico|consultorio|grua|ajustador|soporte|atencion|emergencia)/,
  ],
  ["numero", /numero de (poliza|contrato|serie|folio|cuenta|cliente)|folio|numero/],
  ["monto", /cuanto|prima|renta|deducible|suma asegurada|costo|cuesta|precio|pago|monto|deposito|limite de credito|saldo|consumo|kwh/],
  ["partes", /quien|a nombre de|titular|asegurado|arrendador|arrendatario/],
  ["condiciones", /condicion|aviso|exclu|cubre|ampara|cancelar|penaliza|clausula/],
];

// Palabras de la pregunta que no ayudan a encontrar el documento
const PALABRAS_DE_INTENCION =
  /\b(cuando|vence|vencen|vencimiento|caduca|expira|hasta|termina|vigencia|vigente|renovar|empieza|inicia|cuanto|cuantos|cuantas|cuesta|costo|precio|pago|monto|telefono|numero|contacto|llamar|quien|que|cual|cuales|mi|mis|el|la|los|las|de|del|tengo|es|son|pronto|proximo|proximos|este|mes|gaste|gastado|consumi)\b/g;

const SINONIMOS: [RegExp, string][] = [
  [/\bseguros?\b/, "poliza aseguradora seguro"],
  [/\bpolizas?\b/, "seguro poliza"],
  [/\b(carro|coche|auto|camioneta|vehiculo|moto)\b/, "auto automovil vehiculo"],
  [/\b(renta|depa|departamento|casero|casera)\b/, "renta arrendamiento arrendador"],
  [/\b(luz|electricidad)\b/, "cfe luz"],
  [/\b(medico|gastos medicos|hospital)\b/, "medicos salud"],
  [/\b(ine|credencial)\b/, "credencial votar ine"],
  [/\b(refri|refrigerador|lavadora|tele|television|pantalla)\b/, "garantia"],
  [/\b(salgo|salirme|irme antes|dejar el depa|me voy antes|cancelar el contrato)\b/, "terminar anticipadamente penalizacion aviso"],
  [/\b(medicina|medicamento|recetaron|pastilla|tomar)\b/, "mg capsula tableta receta"],
  [/\b(doctor|medico)\b/, "dr consultorio paciente"],
  [/\b(sangre)\b/, "sangre tipo"],
  [/\b(mascota|perro|gato)s?\b/, "mascotas"],
];

export function analizarPregunta(pregunta: string): { intencion: Intencion; consulta: string; tema: string } {
  const p = plano(pregunta).replace(/[¿?¡!.,]/g, " ");
  const intencion = INTENCIONES.find(([, r]) => r.test(p))?.[0] ?? "general";
  const tema = p.replace(PALABRAS_DE_INTENCION, " ").replace(/\s+/g, " ").trim();
  const extra = SINONIMOS.filter(([r]) => r.test(p)).map(([, s]) => s);
  const consulta = [tema || p, ...extra].join(" ");
  return { intencion, consulta, tema };
}

const enlaceDoc = (doc: Documento, pagina?: number | null) =>
  `[${doc.nombre}${pagina ? `, pág. ${pagina}` : ""}](/documentos/${doc.id}${pagina ? `?pagina=${pagina}` : ""})`;

// Página donde aparece un dato (la fecha o el monto), para citarla
function paginaCon(paginas: Pagina[], prueba: (texto: string) => boolean): number | null {
  return paginas.find((p) => prueba(p.contenido))?.pagina ?? null;
}

function avisoDeFecha(fecha: string, hoy: string): string {
  const estado = estadoVencimiento(fecha, hoy);
  return estado === "vencido" || estado === "pronto" ? `\n\n⚠️ Ojo: ${enCuanto(fecha, hoy)}.` : "";
}

type Datos = {
  pregunta: string;
  fragmentos: Fragmento[];
  documentos: Documento[]; // los que aparecen en los fragmentos
  paginas: Record<string, Pagina[]>; // páginas de esos documentos
  notas: Nota[];
  todos: Documento[]; // todos los documentos con ficha (para "¿qué vence pronto?")
  hoy: string;
};

export type Respuesta = { texto: string; citas: Cita[] };

function sugerirQueSubir(p: string): string {
  const mapa: [RegExp, string][] = [
    [/seguro|poliza/, "tu póliza de seguro"],
    [/auto|carro|coche|vehiculo/, "la póliza o la tarjeta de circulación del auto"],
    [/renta|arrend|casero|depa/, "tu contrato de renta"],
    [/ine|credencial|pasaporte|curp|acta/, "una foto o PDF de ese documento de identidad"],
    [/garantia|refri|lavadora|tele/, "la garantía o el ticket de compra"],
    [/luz|cfe|agua|internet|telefono/, "tu último recibo de ese servicio"],
    [/predial|escritura/, "tus papeles de la casa"],
    [/medic|salud|doctor|receta/, "la póliza de gastos médicos o el documento médico"],
    [/sat|rfc|impuesto|factura/, "tu constancia de situación fiscal o la factura"],
  ];
  const cual = mapa.find(([r]) => r.test(p))?.[1] ?? "el documento que tenga ese dato";
  return `No encontré eso en tus documentos.\n\nTe sugiero subir ${cual} para poder contestarte.`;
}

export function responder(d: Datos): Respuesta {
  const { intencion, tema } = analizarPregunta(d.pregunta);
  const p = plano(d.pregunta);

  // "¿Qué vence pronto?" sin un tema concreto: lista de lo que vence en 60 días
  if (intencion === "vencimiento" && !tema) {
    const proximos = vencenEn(d.todos, d.hoy, 60);
    if (!proximos.length) return { texto: "Nada de tus documentos vence en los próximos 60 días. 🎉", citas: [] };
    return {
      texto: `En los próximos 60 días vencen ${proximos.length === 1 ? "1 documento" : `${proximos.length} documentos`}:\n\n${proximos
        .map((doc) => `- **${fechaLarga(doc.ficha!.fecha_vencimiento!)}** (${enCuanto(doc.ficha!.fecha_vencimiento!, d.hoy)}): ${enlaceDoc(doc)}`)
        .join("\n")}`,
      citas: proximos.map((doc) => ({ documento_id: doc.id, nombre: doc.nombre })),
    };
  }

  // Documentos ordenados por relevancia (suma de puntajes de sus fragmentos)
  const puntaje = new Map<string, number>();
  for (const f of d.fragmentos) if (f.documento_id) puntaje.set(f.documento_id, (puntaje.get(f.documento_id) ?? 0) + f.rango);
  const docs = d.documentos
    .filter((x) => puntaje.has(x.id))
    .sort((a, b) => relevancia(b, tema, d.paginas[b.id]) - relevancia(a, tema, d.paginas[a.id]) || puntaje.get(b.id)! - puntaje.get(a.id)!);

  const notaTop = d.fragmentos.find((f) => f.tipo === "nota");
  if (!docs.length && !notaTop) return { texto: sugerirQueSubir(p), citas: [] };

  // Datos de la ficha según lo que se pregunta
  const datoDe = (doc: Documento): { valor: string; pagina: number | null } | null => {
    const f = doc.ficha;
    const paginas = d.paginas[doc.id] ?? [];
    if (!f) return null;
    switch (intencion) {
      case "vencimiento":
      case "inicio": {
        const fecha = intencion === "vencimiento" ? f.fecha_vencimiento : f.fecha_inicio;
        if (!fecha) return null;
        return { valor: fechaLarga(fecha), pagina: paginaCon(paginas, (t) => buscarFechas(t).some((x) => x.fecha === fecha)) };
      }
      case "monto": {
        const entradas = Object.entries(f.montos);
        if (!entradas.length) return null;
        // Si la pregunta menciona un monto concreto (renta, deducible…), solo ese; si no, todos
        const pedido = montoPedido(entradas, p);
        if (!pedido && CONCEPTO_MONTO.test(p)) return null;
        const texto = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
        const valor = pedido ? `${pedido[0]}: ${texto(pedido[1])}` : entradas.map(([k, v]) => `${k}: ${texto(v)}`).join(" · ");
        const elegido = pedido ?? entradas[0];
        const miles = elegido[1].toLocaleString("en-US", { minimumFractionDigits: 2 });
        return { valor, pagina: paginaCon(paginas, (t) => t.includes(miles) || t.includes(String(elegido[1]))) };
      }
      case "contacto":
        return f.contacto ? { valor: f.contacto, pagina: paginaCon(paginas, (t) => t.includes(f.contacto!.split(" · ")[0])) } : null;
      case "numero":
        return f.numero_referencia ? { valor: f.numero_referencia, pagina: null } : null;
      case "partes":
        return f.partes ? { valor: f.partes, pagina: null } : null;
      case "condiciones": {
        const cobertura = /cubre|cobertura|ampara/.test(p) ? fraseRelevante(paginas.map((x) => x.contenido).join("\n"), "cobertura cubre ampara", "") : null;
        const lista = f.condiciones_clave.map((c) => `- ${c}`).join("\n");
        if (!cobertura && !lista) return null;
        return { valor: [cobertura?.replace(/^> /gm, "- "), lista].filter(Boolean).join("\n"), pagina: null };
      }
      default:
        return null;
    }
  };

  if (intencion !== "general" && docs.length) {
    const top = docs[0];
    // Dos documentos parecidos (p. ej. dos pólizas de auto): mostrar ambos y preguntar cuál
    const parecidos = docs.filter(
      (x) => x.tipo_documento === top.tipo_documento && puntaje.get(x.id)! >= puntaje.get(top.id)! * 0.5 && datoDe(x),
    );
    if (parecidos.length >= 2 && new Set(parecidos.map((x) => datoDe(x)!.valor)).size > 1) {
      return {
        texto: `Encontré ${parecidos.length} documentos que podrían responder. ¿Cuál de ellos?\n\n${parecidos
          .slice(0, 3)
          .map((x) => {
            const dato = datoDe(x)!;
            return `- **${dato.valor}**: ${enlaceDoc(x, dato.pagina)}`;
          })
          .join("\n")}`,
        citas: parecidos.map((x) => ({ documento_id: x.id, nombre: x.nombre })),
      };
    }
    const dato = datoDe(top);
    if (dato) {
      const fecha = intencion === "vencimiento" ? top.ficha!.fecha_vencimiento : null;
      return {
        texto: `${dato.valor.includes("\n") ? dato.valor : `**${dato.valor}**`}\n\nSegún ${top.tipo_documento ? `tu ${top.tipo_documento.toLowerCase()}: ` : ""}${enlaceDoc(top, dato.pagina)}${fecha ? avisoDeFecha(fecha, d.hoy) : ""}`,
        citas: [{ documento_id: top.id, nombre: top.nombre, pagina: dato.pagina }],
      };
    }
    // El dato no está en la ficha: la frase del documento que lo menciona
    const frase = fraseRelevante((d.paginas[top.id] ?? []).map((x) => x.contenido).join("\n"), tema || palabrasDeIntencion(intencion), tituloDe(top));
    if (frase) return { texto: `${frase}\n\nSegún ${enlaceDoc(top)}`, citas: [{ documento_id: top.id, nombre: top.nombre }] };
    // El documento existe pero no trae ese dato
    const campo = { vencimiento: "la fecha de vencimiento", inicio: "la fecha de inicio", monto: "montos", contacto: "un teléfono o correo de contacto", numero: "un número de referencia", partes: "las partes", condiciones: "condiciones clave" }[intencion];
    const fragmento = d.fragmentos.find((f) => f.documento_id === top.id && f.tipo === "fragmento");
    return {
      texto: `${enlaceDoc(top)} no especifica ${campo}.${fragmento ? `\n\nLo más cercano que encontré (pág. ${fragmento.pagina}):\n> ${recorte(fragmento.contenido, tema)}` : ""}\n\nSi tú sabes el dato, puedes agregarlo en la ficha del documento.`,
      citas: [{ documento_id: top.id, nombre: top.nombre, pagina: fragmento?.pagina }],
    };
  }

  // Pregunta general: el fragmento más relevante, citado
  const mejor = d.fragmentos.find((f) => f.tipo !== "documento") ?? d.fragmentos[0];
  if (mejor.tipo === "nota") {
    const nota = d.notas.find((n) => n.id === mejor.nota_id);
    if (nota) {
      return {
        texto: `${fraseRelevante(nota.contenido, consultaDe(d.pregunta)) ?? recorte(nota.contenido || nota.titulo, tema)}\n\nDe tu nota: [${nota.titulo}](/notas#${nota.id})`,
        citas: [{ nota_id: nota.id, nombre: nota.titulo }],
      };
    }
  }
  const doc = docs.find((x) => x.id === mejor.documento_id) ?? docs[0];
  const frase = mejor.tipo === "fragmento" ? fraseRelevante(mejor.contenido, consultaDe(d.pregunta), tituloDe(doc)) : null;
  return {
    texto: `${frase ?? (mejor.tipo === "fragmento" ? recorte(mejor.contenido, tema) : `Encontré esto en ${doc.tipo_documento?.toLowerCase() ?? "un documento"}.`)}\n\nFuente: ${enlaceDoc(doc, mejor.pagina)}`,
    citas: [{ documento_id: doc.id, nombre: doc.nombre, pagina: mejor.pagina }],
  };
}

// Raíz de una palabra para comparar sin importar terminaciones ("mascotas" ~ "mascota", "renta" ~ "rentas")
const raiz = (w: string) => w.slice(0, Math.max(4, Math.min(6, w.length - 1)));
const VACIAS = new Set("que cual cuales cuando cuanto cuanta donde como para por con del las los una uno unos tengo tiene esta este esto mis son hay puedo debo dice".split(" "));
const consultaDe = (pregunta: string) => analizarPregunta(pregunta).consulta;
const tituloDe = (doc: Documento) => `${doc.nombre} ${doc.tipo_documento ?? ""}`;

// Qué tanto trata el documento de lo que preguntas: palabras en su nombre o tipo, más palabras en su texto
export function relevancia(doc: Documento, tema: string, paginas: Pagina[] = []): number {
  const titulo = plano(`${doc.nombre} ${doc.tipo_documento ?? ""}`);
  const texto = plano(paginas.map((p) => p.contenido).join(" "));
  const palabras = tema.split(" ").filter((w) => w.length >= 4 && !VACIAS.has(w));
  return palabras.filter((w) => titulo.includes(raiz(w))).length + palabras.filter((w) => texto.includes(raiz(w))).length;
}

// Palabras que suelen acompañar a cada tipo de dato en un documento
function palabrasDeIntencion(i: Intencion): string {
  return { vencimiento: "vigencia vence limite", inicio: "inicio desde", monto: "pago total", contacto: "telefono llame", numero: "numero", partes: "nombre titular", condiciones: "cubre exclusiones", general: "" }[i];
}

const CONCEPTO_MONTO = /\b(deducible|coaseguro|prima|renta|deposito|limite|minimo|intereses|suma asegurada|saldo|mensualidad|kwh|consumo|litros|megas)\b/;

// El monto que pides ("deducible", "para no generar intereses"): el que comparte más palabras con la pregunta
function montoPedido(entradas: [string, number][], p: string): [string, number] | undefined {
  let mejor: [string, number] | undefined;
  let max = 0;
  for (const e of entradas) {
    const n = plano(e[0])
      .split(" ")
      .filter((w) => w.length >= 4 && !["pago"].includes(w))
      .filter((w) => p.includes(raiz(w))).length;
    if (n > max) [mejor, max] = [e, n];
  }
  return mejor;
}

// La frase (o renglón) del texto que mejor responde: la que tiene más palabras de la pregunta. Sin números sensibles.
// "excluir": el nombre del documento; sus palabras ("seguro", "auto") describen el documento, no el dato que buscas
export function fraseRelevante(texto: string, consulta: string, excluir = ""): string | null {
  const titulo = plano(excluir);
  const todas = [...new Set(plano(consulta).split(/\s+/).filter((w) => w.length >= 3 && !VACIAS.has(w)))];
  const propias = todas.filter((w) => !titulo.includes(raiz(w)));
  const palabras = propias.length ? propias : todas;
  if (!palabras.length) return null;
  const frases = texto
    .split(/\n+|(?<=[.;])\s+/)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter((f) => f.length >= 8);
  // Una palabra que aparece en pocas frases dice más ("régimen") que una que está en todas ("fiscal")
  const planas = frases.map(plano);
  const peso = Object.fromEntries(palabras.map((w) => [w, 1 / Math.max(1, planas.filter((pf) => pf.includes(raiz(w))).length)]));
  const puntos = planas.map((pf) => palabras.reduce((t, w) => t + (pf.includes(raiz(w)) ? peso[w] : 0), 0));
  const max = Math.max(0, ...puntos);
  if (!max) return null;
  const empatadas = frases.filter((_, i) => puntos[i] >= max - 1e-9);
  const elegidas = empatadas.length === 2 && empatadas.every((f) => f.length <= 120) ? empatadas : [empatadas.sort((a, b) => a.length - b.length)[0]];
  return elegidas.map((f) => `> ${enmascarar(f.length > 260 ? recorte(f, consulta) : f)}`).join("\n");
}

// La parte del fragmento donde aparecen las palabras de la pregunta (máx. ~300 caracteres), sin números sensibles
export function recorte(texto: string, tema: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  const palabras = tema.split(" ").filter((w) => w.length >= 4);
  const p = plano(limpio);
  const pos = palabras.map((w) => p.indexOf(w.slice(0, 5))).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const inicio = Math.max(0, pos - 100);
  const trozo = limpio.slice(inicio, inicio + 300);
  return enmascarar(`${inicio > 0 ? "…" : ""}${trozo}${inicio + 300 < limpio.length ? "…" : ""}`);
}
