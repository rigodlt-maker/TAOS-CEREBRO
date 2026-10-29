// Responder preguntas sin IA: busca en tus documentos y contesta con el dato exacto y su origen.
// Solo usa lo que dicen los documentos; si no está, lo dice y sugiere qué subir.
import { enmascarar } from "./enmascarar";
import { plano } from "./extraer";
import { buscarFechas, enCuanto, fechaLarga } from "./fechas";
import type { Cita, Documento, Fragmento, Nota, Pagina } from "./tipos";
import { estadoVencimiento, vencenEn } from "./vencimientos";

export type Intencion = "vencimiento" | "inicio" | "monto" | "contacto" | "numero" | "partes" | "condiciones" | "general";

const INTENCIONES: [Intencion, RegExp][] = [
  ["inicio", /(cuando|desde cuando) (empieza|inicia|comienza|empezo|inicio)|fecha de inicio|desde cuando/],
  ["vencimiento", /venc|caduc|expir|hasta cuando|cuando (termina|se acaba)|vigencia|vigente|renovar|renovacion/],
  ["contacto", /telefono|contacto|llamar|marcar|whats|correo|email|siniestro|cabina/],
  ["numero", /numero de (poliza|contrato|serie|folio|cuenta|cliente)|folio|numero/],
  ["monto", /cuanto|prima|renta|deducible|suma asegurada|costo|cuesta|precio|pago|monto|deposito/],
  ["partes", /quien|a nombre de|titular|asegurado|arrendador|arrendatario/],
  ["condiciones", /condicion|aviso|exclu|cubre|ampara|cancelar|penaliza|clausula/],
];

// Palabras de la pregunta que no ayudan a encontrar el documento
const PALABRAS_DE_INTENCION =
  /\b(cuando|vence|vencen|vencimiento|caduca|expira|hasta|termina|vigencia|vigente|renovar|empieza|inicia|cuanto|cuesta|costo|precio|pago|monto|telefono|numero|contacto|llamar|quien|que|cual|cuales|mi|mis|el|la|los|las|de|del|tengo|es|son|pronto|proximo|proximos|este|mes)\b/g;

const SINONIMOS: [RegExp, string][] = [
  [/\bseguros?\b/, "poliza aseguradora seguro"],
  [/\bpolizas?\b/, "seguro poliza"],
  [/\b(carro|coche|auto|camioneta|vehiculo|moto)\b/, "auto automovil vehiculo"],
  [/\b(renta|depa|departamento|casero|casera)\b/, "renta arrendamiento arrendador"],
  [/\b(luz|electricidad)\b/, "cfe luz"],
  [/\b(medico|gastos medicos|hospital)\b/, "medicos salud"],
  [/\b(ine|credencial)\b/, "credencial votar ine"],
  [/\b(refri|refrigerador|lavadora|tele|television|pantalla)\b/, "garantia"],
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
  const docs = d.documentos.filter((x) => puntaje.has(x.id)).sort((a, b) => puntaje.get(b.id)! - puntaje.get(a.id)!);

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
        const pedido = entradas.find(([k]) => p.includes(plano(k).split(" ")[0]));
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
      case "condiciones":
        return f.condiciones_clave.length ? { valor: f.condiciones_clave.map((c) => `- ${c}`).join("\n"), pagina: null } : null;
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
        texto: `**${dato.valor}**\n\nSegún ${top.tipo_documento ? `tu ${top.tipo_documento.toLowerCase()}: ` : ""}${enlaceDoc(top, dato.pagina)}${fecha ? avisoDeFecha(fecha, d.hoy) : ""}`,
        citas: [{ documento_id: top.id, nombre: top.nombre, pagina: dato.pagina }],
      };
    }
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
        texto: `${recorte(nota.contenido || nota.titulo, tema)}\n\nDe tu nota: [${nota.titulo}](/notas#${nota.id})`,
        citas: [{ nota_id: nota.id, nombre: nota.titulo }],
      };
    }
  }
  const doc = docs.find((x) => x.id === mejor.documento_id) ?? docs[0];
  return {
    texto: `${mejor.tipo === "fragmento" ? recorte(mejor.contenido, tema) : `Encontré esto en ${doc.tipo_documento?.toLowerCase() ?? "un documento"}.`}\n\nFuente: ${enlaceDoc(doc, mejor.pagina)}`,
    citas: [{ documento_id: doc.id, nombre: doc.nombre, pagina: mejor.pagina }],
  };
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
