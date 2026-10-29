"use server";

import { revalidatePath } from "next/cache";
import { BUCKET } from "./datos/supabase";
import { queMeFalta, type Sugerencia } from "./faltantes";
import { camposVacios } from "./extraer";
import { procesarTexto } from "./procesar";
import { obtenerRepo } from "./sesion";
import { clienteServidor } from "./supabase/servidor";
import { CATEGORIAS, type Categoria, type Ficha, type Pagina, type Resultado } from "./tipos";

function nombreSeguro(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return limpio || "archivo";
}

// 1) Registra el documento y devuelve a dónde subir el archivo (URL firmada de un solo uso)
export async function prepararSubida(nombre: string, tipo: string): Promise<{ id: string; ruta: string | null; token: string | null } | { error: string }> {
  try {
    const repo = await obtenerRepo();
    if (repo.modo === "demo") return { id: await repo.crearDocumento({ nombre, ruta_storage: null, tipo_archivo: tipo }), ruta: null, token: null };
    const db = await clienteServidor();
    const { data } = await db.auth.getClaims();
    const ruta = `${data!.claims.sub}/${crypto.randomUUID()}-${nombreSeguro(nombre)}`;
    const subida = await db.storage.from(BUCKET).createSignedUploadUrl(ruta);
    if (subida.error) return { error: `No se pudo preparar la subida: ${subida.error.message}` };
    const id = await repo.crearDocumento({ nombre, ruta_storage: ruta, tipo_archivo: tipo });
    return { id, ruta, token: subida.data.token };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// 2) Con el texto ya leído en el navegador, extrae la ficha y guarda todo
export async function procesarDocumento(id: string, nombre: string, paginas: Pagina[]): Promise<Resultado> {
  const r = await procesarTexto(await obtenerRepo(), id, nombre, paginas);
  revalidatePath("/", "layout");
  return { ok: r.ok, mensaje: r.mensaje } as Resultado;
}

export async function marcarErrorDeLectura(id: string, mensaje: string): Promise<void> {
  const repo = await obtenerRepo();
  await repo.marcarError(id, mensaje);
  revalidatePath("/", "layout");
}

const texto = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v && v.toLowerCase() !== "no especificado" ? v : null;
};
const fecha = (f: FormData, k: string) => {
  const v = texto(f, k);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};

// Edición manual de la ficha
export async function guardarFicha(f: FormData): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const id = String(f.get("id"));
    const categoria = String(f.get("categoria")) as Categoria;
    if (!CATEGORIAS.includes(categoria)) return { ok: false, mensaje: "Categoría no válida" };

    const montos: Record<string, number> = {};
    for (const linea of String(f.get("montos") ?? "").split("\n")) {
      const [concepto, valor] = linea.split(":");
      const n = Number((valor ?? "").replace(/[$,\s]/g, ""));
      if (concepto?.trim() && n > 0) montos[concepto.trim()] = n;
    }
    const referencia = texto(f, "numero_referencia");
    const ficha: Ficha = {
      partes: texto(f, "partes"),
      // Si escriben el número completo, solo se guardan los últimos 4
      numero_referencia: referencia ? (referencia.replace(/[^A-Za-z0-9]/g, "").length > 4 && !referencia.includes("•") ? `•••• ${referencia.replace(/[^A-Za-z0-9]/g, "").slice(-4)}` : referencia) : null,
      fecha_inicio: fecha(f, "fecha_inicio"),
      fecha_vencimiento: fecha(f, "fecha_vencimiento"),
      montos,
      condiciones_clave: String(f.get("condiciones") ?? "").split("\n").map((c) => c.trim()).filter(Boolean).slice(0, 3),
      contacto: texto(f, "contacto"),
      campos_no_especificados: [],
    };
    ficha.campos_no_especificados = camposVacios(ficha);
    await repo.actualizarFicha(
      id,
      { categoria, tipo_documento: texto(f, "tipo_documento") ?? "Documento", nombre: texto(f, "nombre") ?? "Documento" },
      ficha,
    );
    revalidatePath("/", "layout");
    return { ok: true, mensaje: "Ficha guardada ✓" };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

export async function borrarDocumento(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarDocumento(id);
    revalidatePath("/", "layout");
    return { ok: true, mensaje: "Documento borrado" };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

export async function guardarNota(f: FormData): Promise<Resultado> {
  try {
    const titulo = String(f.get("titulo") ?? "").trim();
    if (!titulo) return { ok: false, mensaje: "Ponle un título a la nota" };
    const categoria = String(f.get("categoria") ?? "Notas personales");
    await (await obtenerRepo()).guardarNota({
      id: String(f.get("id") ?? "") || undefined,
      titulo,
      contenido: String(f.get("contenido") ?? ""),
      categoria: CATEGORIAS.includes(categoria as Categoria) ? categoria : "Notas personales",
    });
    revalidatePath("/notas");
    return { ok: true, mensaje: "Nota guardada ✓" };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

export async function borrarNota(id: string): Promise<Resultado> {
  try {
    await (await obtenerRepo()).borrarNota(id);
    revalidatePath("/notas");
    return { ok: true, mensaje: "Nota borrada" };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}

export async function queMeFaltaAccion(): Promise<Sugerencia[]> {
  const repo = await obtenerRepo();
  const [docs, notas] = await Promise.all([repo.documentos(), repo.notas()]);
  return queMeFalta(docs, notas);
}

// Borra los documentos que subiste directo a la app y no están en tu carpeta de Drive (solo si ya hay sincronización)
export async function borrarFueraDeDrive(): Promise<Resultado> {
  try {
    const repo = await obtenerRepo();
    const docs = await repo.documentosDrive();
    if (!docs.some((d) => d.drive_id)) return { ok: false, mensaje: "Primero conecta tu Drive." };
    const sueltos = docs.filter((d) => !d.drive_id);
    for (const d of sueltos) await repo.borrarDocumento(d.id);
    revalidatePath("/", "layout");
    return { ok: true, mensaje: `Listo: borré ${sueltos.length} documentos.` };
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }
}
