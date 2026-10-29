import type { Repo } from "./datos/repo";
import { hoyEnMexico } from "./fechas";
import { buscarPorNombre, comoFragmentos, conversar, limpio } from "./conversar";
import { datoPedido, responderDato } from "./datos-personales";
import { iaDisponible, responderConIA } from "./ia";
import { analizarPregunta, recorte, responder } from "./responder";
import type { Cita } from "./tipos";

// Busca, arma la respuesta (reglas o IA) y la entrega por partes (streaming). Al final la guarda en el historial.
export async function* preguntar(repo: Repo, pregunta: string): AsyncGenerator<string> {
  const hoy = hoyEnMexico();
  const [todos, notas] = await Promise.all([repo.documentos(), repo.notas()]);

  // "¿Cuál es mi RFC?": el dato exacto, sacado del texto de tus documentos
  const dato = datoPedido(pregunta);
  if (dato) {
    const listos = todos.filter((d) => d.estado_procesamiento === "listo");
    const r = responderDato(dato, listos, await repo.paginasDe(listos.map((d) => d.id)));
    for (const trozo of r.texto.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
    await repo.guardarPregunta(pregunta, r.texto, r.citas);
    return;
  }

  // Preguntas sobre tu archivo en general ("¿qué documentos tengo?", "pásame mi INE", "¿qué me falta?")
  const general = conversar(pregunta, todos, notas, hoy);
  if (general) {
    for (const trozo of general.texto.match(/[\s\S]{1,24}/g) ?? []) yield trozo;
    await repo.guardarPregunta(pregunta, general.texto, general.citas);
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
      ...documentos.map((d) => `FICHA de [${d.nombre}](/documentos/${d.id}) (${d.tipo_documento ?? d.categoria}): ${JSON.stringify(d.ficha)}`),
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
  await repo.guardarPregunta(pregunta, texto, citas);
}
