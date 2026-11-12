import type { Repo } from "./datos/repo";
import { hoyEnMexico } from "./fechas";
import { buscarPorNombre, comoFragmentos, conversar, limpio } from "./conversar";
import { datoPedido, responderDato } from "./datos-personales";
import { iaDisponible, responderConIA } from "./ia";
import { analizarPregunta, recorte, responder } from "./responder";
import { respuestaTarjetas } from "./tarjetas-administrador";
import type { Cita, Documento } from "./tipos";

// S18 · Si la respuesta usa un documento que se leyó INCOMPLETO, Tao lo dice siempre, al final de la respuesta (y queda
// en el historial): puede faltar justo lo que preguntas (p. ej. el vencimiento que venía al final).
export const esParcial = (d: Pick<Documento, "estado_procesamiento" | "error_procesamiento">) =>
  d.estado_procesamiento === "listo" && !!d.error_procesamiento?.startsWith("Lectura parcial");
export function avisoParcial(ids: Iterable<string | null | undefined>, todos: Documento[]): string {
  const usados = new Set([...ids].filter(Boolean));
  const parciales = todos.filter((d) => usados.has(d.id) && esParcial(d));
  if (!parciales.length) return "";
  const lista = parciales.map((d) => `[${d.nombre}](/documentos/${d.id})`).join(", ");
  const uno = parciales.length === 1;
  return `\n\n⚠️ Ojo: ${lista} ${uno ? "se leyó incompleto" : "se leyeron incompletos"}: puede faltar información (por ejemplo, fechas o datos que venían al final). Revisa el documento original antes de confiar en esta respuesta.`;
}
const idsDe = (citas: Cita[]) => citas.map((c) => c.documento_id);

// Busca, arma la respuesta (reglas o IA) y la entrega por partes (streaming). Al final la guarda en el historial.
export async function* preguntar(repo: Repo, pregunta: string): AsyncGenerator<string> {
  const hoy = hoyEnMexico();
  const [todos, notas] = await Promise.all([repo.documentos(), repo.notas()]);

  // "¿Cuál es mi RFC?": el dato exacto, sacado del texto de tus documentos
  const dato = datoPedido(pregunta);
  if (dato) {
    const listos = todos.filter((d) => d.estado_procesamiento === "listo");
    const r = responderDato(dato, listos, await repo.paginasDe(listos.map((d) => d.id)));
    const texto = r.texto + avisoParcial(idsDe(r.citas), todos);
    for (const trozo of texto.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
    await repo.guardarPregunta(pregunta, texto, r.citas);
    return;
  }

  // "¿Cuándo corta mi Plata?": tus tarjetas de Administrador Tao
  const tarjeta = respuestaTarjetas(pregunta, await repo.tarjetasAdministrador(), hoy);
  if (tarjeta) {
    for (const trozo of tarjeta.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
    await repo.guardarPregunta(pregunta, tarjeta, []);
    return;
  }

  // Preguntas sobre tu archivo en general ("¿qué documentos tengo?", "pásame mi INE", "¿qué me falta?")
  const general = conversar(pregunta, todos, notas, hoy);
  if (general) {
    const texto = general.texto + avisoParcial(idsDe(general.citas), todos);
    for (const trozo of texto.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
    await repo.guardarPregunta(pregunta, texto, general.citas);
    return;
  }

  const { consulta, tema } = analizarPregunta(pregunta);
  let fragmentos = await repo.buscar(consulta, 8);
  // Si la búsqueda de texto no encuentra nada, se busca por nombre, tipo y categoría del documento
  if (!fragmentos.length) fragmentos = comoFragmentos(buscarPorNombre(limpio(tema || pregunta), todos).slice(0, 3));
  const ids = [...new Set(fragmentos.map((f) => f.documento_id).filter((x): x is string => !!x))];
  const paginas = await repo.paginasDe(ids);
  const documentos = todos.filter((d) => ids.includes(d.id));

  let texto = "";
  let citas: Cita[] = [];
  if (iaDisponible() && fragmentos.length) {
    const contexto = [
      ...documentos.map(
        (d) =>
          `FICHA de [${d.nombre}](/documentos/${d.id}) (${d.tipo_documento ?? d.categoria})${esParcial(d) ? " [LECTURA PARCIAL: el documento se leyó incompleto; puede faltar el final]" : ""}: ${JSON.stringify(d.ficha)}`,
      ),
      ...fragmentos
        .filter((f) => f.tipo !== "documento")
        .map((f) => {
          const doc = documentos.find((d) => d.id === f.documento_id);
          const enlace = doc ? `[${doc.nombre}, pág. ${f.pagina}](/documentos/${doc.id}?pagina=${f.pagina})` : `nota`;
          return `FRAGMENTO de ${enlace}:\n${recorte(f.contenido, tema)}`;
        }),
    ].join("\n\n");
    citas = documentos.map((d) => ({ documento_id: d.id, nombre: d.nombre }));
    try {
      for await (const parte of responderConIA(pregunta, contexto, hoy)) {
        texto += parte;
        yield parte;
      }
    } catch (e) {
      // Si la IA falla, se responde con reglas
      texto = "";
      yield "\u0000"; // señal para que la pantalla borre lo que llevaba
      console.error("IA:", e);
    }
  }
  if (!texto) {
    const r = responder({ pregunta, fragmentos, documentos, paginas, notas, todos, hoy });
    texto = r.texto;
    citas = r.citas;
    // Se envía en trozos para que se vea escribiéndose
    for (const trozo of texto.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
  }
  // Documentos que se buscaron o se citaron: si alguno se leyó incompleto, se avisa (con reglas o con IA)
  const aviso = avisoParcial([...ids, ...idsDe(citas)], todos);
  if (aviso) {
    texto += aviso;
    for (const trozo of aviso.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
  }
  await repo.guardarPregunta(pregunta, texto, citas);
}
