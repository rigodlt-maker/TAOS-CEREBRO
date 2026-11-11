// Con el texto ya leído (en el navegador o por Google Drive): clasifica, extrae la ficha y guarda todo
import type { Repo } from "./datos/repo";
import { camposVacios, clasificar, extraerFicha, trocear } from "./extraer";
import { extraerConIA, iaDisponible } from "./ia";
import type { Categoria, Ficha, Pagina, Resultado } from "./tipos";

// Topes del servidor. Lo que no cabe NO se tira en silencio: se dice en el aviso de lectura parcial (S18-T).
export const TOPES = { paginas: 400, porPagina: 20_000, total: 2_000_000 };

// Una página más larga que el tope se parte en trozos con el mismo número de página (no se corta);
// lo que pase del total o del número de trozos se deja fuera y se explica.
export function recortarPaginas(paginas: Pagina[]): { paginas: Pagina[]; motivos: string[] } {
  const salida: Pagina[] = [];
  let total = 0;
  let fuera = false;
  for (const p of paginas) {
    const pagina = Math.max(1, Math.floor(Number(p.pagina) || 1));
    const contenido = String(p.contenido ?? "");
    for (let i = 0; i < Math.max(1, contenido.length); i += TOPES.porPagina) {
      const trozo = contenido.slice(i, i + TOPES.porPagina);
      if (salida.length >= TOPES.paginas || total + trozo.length > TOPES.total) {
        fuera = true;
        break;
      }
      total += trozo.length;
      salida.push({ pagina, contenido: trozo });
    }
    if (fuera) break;
  }
  return { paginas: salida, motivos: fuera ? [`El documento es muy largo: solo se guardó hasta la página ${salida.at(-1)?.pagina ?? 1}.`] : [] };
}

// parcialPrevio: lo que ya no se pudo leer antes de llegar aquí (en el celular o en Drive). Se junta con los recortes
// de aquí y, si hay alguno, el documento queda "listo" pero con su aviso de lectura parcial.
export async function procesarTexto(
  repo: Repo,
  id: string,
  nombre: string,
  paginas: Pagina[],
  parcialPrevio: string | null = null,
): Promise<Resultado & { categoria?: Categoria; tipo?: string; parcial?: string | null }> {
  try {
    const { paginas: limpias, motivos } = recortarPaginas(paginas);
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
    const parcial = [parcialPrevio, ...motivos].filter(Boolean).join(" ").slice(0, 400) || null;
    if (parcial) await repo.marcarParcial(id, `Lectura parcial: ${parcial}`);
    const faltan = datos.ficha.campos_no_especificados.length;
    return { ok: true, parcial, categoria: datos.categoria, tipo: datos.tipo_documento, mensaje: `${datos.tipo_documento} · ${datos.categoria}${faltan ? ` · ${faltan} campos sin especificar` : ""}` };
  } catch (e) {
    await repo.marcarError(id, (e as Error).message).catch(() => {});
    return { ok: false, mensaje: `Error al procesar: ${(e as Error).message}` };
  }
}
