// Con el texto ya leído (en el navegador o por Google Drive): clasifica, extrae la ficha y guarda todo
import type { Repo } from "./datos/repo";
import { camposVacios, clasificar, extraerFicha, trocear } from "./extraer";
import { extraerConIA, iaDisponible } from "./ia";
import type { Categoria, Ficha, Pagina, Resultado } from "./tipos";

const MAX_TEXTO = 2_000_000;

export async function procesarTexto(repo: Repo, id: string, nombre: string, paginas: Pagina[]): Promise<Resultado & { categoria?: Categoria; tipo?: string }> {
  try {
    let total = 0;
    const limpias = paginas
      .map((p) => ({ pagina: Math.max(1, Math.floor(p.pagina)), contenido: String(p.contenido ?? "") }))
      .filter((p) => (total += p.contenido.length) <= MAX_TEXTO);
    const texto = limpias.map((p) => p.contenido).join("\n");
    if (!texto.trim()) {
      await repo.marcarError(id, "No se encontró texto en el archivo.");
      return { ok: false, mensaje: "No se encontró texto en el archivo. Si es una foto, intenta con una imagen más nítida." };
    }

    let datos: { categoria: Categoria; tipo_documento: string; ficha: Ficha };
    if (iaDisponible()) {
      try {
        datos = await extraerConIA(limpias, nombre);
      } catch {
        datos = { ...clasificar(texto, nombre), ficha: extraerFicha(limpias) };
      }
    } else {
      datos = { ...clasificar(texto, nombre), ficha: extraerFicha(limpias) };
    }
    datos.ficha.campos_no_especificados = camposVacios(datos.ficha);

    await repo.guardarProcesado(id, { ...datos, texto, paginas: trocear(limpias) });
    const faltan = datos.ficha.campos_no_especificados.length;
    return { ok: true, categoria: datos.categoria, tipo: datos.tipo_documento, mensaje: `${datos.tipo_documento} · ${datos.categoria}${faltan ? ` · ${faltan} campos sin especificar` : ""}` };
  } catch (e) {
    await repo.marcarError(id, (e as Error).message).catch(() => {});
    return { ok: false, mensaje: `Error al procesar: ${(e as Error).message}` };
  }
}
