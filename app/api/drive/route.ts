import { revalidatePath } from "next/cache";
import { mismaClave, repoDelDueno } from "@/lib/cron";
import { guardarContenido, sincronizarLista, type ArchivoDrive, type ContenidoDrive } from "@/lib/drive";
import { claveDrive } from "@/lib/script-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// El script de Drive manda "Authorization: Bearer <clave>"
function autorizado(req: Request) {
  const clave = claveDrive();
  return !!clave && clave.length >= 12 && mismaClave(req.headers.get("authorization"), `Bearer ${clave}`);
}

const archivo = (a: Partial<ArchivoDrive> | undefined): ArchivoDrive | null =>
  a && typeof a.id === "string" && typeof a.nombre === "string" && !Number.isNaN(Date.parse(String(a.actualizado)))
    ? { id: a.id.slice(0, 200), nombre: a.nombre.slice(0, 300), mime: String(a.mime ?? "").slice(0, 120), actualizado: String(a.actualizado), url: String(a.url ?? "").slice(0, 500), carpeta: String(a.carpeta ?? "").slice(0, 300) }
    : null;

// Prueba de conexión desde el script
export async function GET(req: Request) {
  if (!claveDrive()) return Response.json({ ok: false, error: "Falta SUPABASE_SECRET_KEY en Vercel" }, { status: 500 });
  if (!autorizado(req)) return Response.json({ ok: false, error: "La clave no coincide" }, { status: 401 });
  return Response.json({ ok: true, mensaje: "Conexión lista" });
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "La clave no coincide" }, { status: 401 });
  const cuerpo = (await req.json().catch(() => null)) as { accion?: string; archivos?: Partial<ArchivoDrive>[]; archivo?: Partial<ContenidoDrive> } | null;
  try {
    const repo = await repoDelDueno();
    if (cuerpo?.accion === "lista") {
      const archivos = (cuerpo.archivos ?? []).slice(0, 2000).map(archivo).filter((a): a is ArchivoDrive => !!a);
      // Una carpeta vacía (o mal encontrada) nunca borra tus documentos
      if (!archivos.length) return Response.json({ ok: true, pedir: [], pendientes: 0, vinculados: 0, borrados: 0 });
      const r = await sincronizarLista(repo, archivos, 15);
      revalidatePath("/", "layout");
      return Response.json({ ok: true, ...r });
    }
    if (cuerpo?.accion === "contenido") {
      const a = archivo(cuerpo.archivo);
      if (!a) return Response.json({ ok: false, error: "Archivo incompleto" }, { status: 400 });
      const mensaje = await guardarContenido(repo, { ...a, texto: String(cuerpo.archivo?.texto ?? "").slice(0, 1_000_000), error: String(cuerpo.archivo?.error ?? "") || undefined });
      revalidatePath("/", "layout");
      return Response.json({ ok: true, mensaje });
    }
    return Response.json({ ok: false, error: "Acción desconocida" }, { status: 400 });
  } catch (e) {
    console.error("Drive:", e);
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
