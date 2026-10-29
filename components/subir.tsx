"use client";

import { createBrowserClient } from "@supabase/ssr";
import { CheckCircle2, FileUp, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { marcarErrorDeLectura, prepararSubida, procesarDocumento } from "@/lib/acciones";
import { SUPABASE_LLAVE_PUBLICA, SUPABASE_URL } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import { ACEPTA, leerArchivo } from "./leer-archivo";

type Estado = { clave: string; nombre: string; paso: string; fin?: "ok" | "error"; id?: string };

const MAX_MB = 50;

// Zona para arrastrar y soltar: sube cada archivo, lo lee y extrae su ficha, mostrando el avance en vivo
export function Subir() {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [encima, setEncima] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const actualizar = (clave: string, cambio: Partial<Estado>) =>
    setEstados((lista) => lista.map((e) => (e.clave === clave ? { ...e, ...cambio } : e)));

  async function procesar(archivo: File, clave: string) {
    if (archivo.size > MAX_MB * 1024 * 1024) return actualizar(clave, { paso: `Pesa más de ${MAX_MB} MB`, fin: "error" });
    actualizar(clave, { paso: "Subiendo…" });
    const prep = await prepararSubida(archivo.name, archivo.type || "application/octet-stream");
    if ("error" in prep) return actualizar(clave, { paso: prep.error, fin: "error" });
    actualizar(clave, { id: prep.id });

    if (prep.ruta && prep.token) {
      const db = createBrowserClient(SUPABASE_URL, SUPABASE_LLAVE_PUBLICA);
      const { error } = await db.storage.from("documentos").uploadToSignedUrl(prep.ruta, prep.token, archivo, { contentType: archivo.type || undefined });
      if (error) {
        await marcarErrorDeLectura(prep.id, `No se pudo subir: ${error.message}`);
        return actualizar(clave, { paso: `No se pudo subir: ${error.message}`, fin: "error" });
      }
    }

    try {
      const paginas = await leerArchivo(archivo, (paso) => actualizar(clave, { paso }));
      actualizar(clave, { paso: "Sacando los datos clave…" });
      const r = await procesarDocumento(prep.id, archivo.name, paginas);
      actualizar(clave, { paso: r.mensaje, fin: r.ok ? "ok" : "error" });
    } catch (e) {
      await marcarErrorDeLectura(prep.id, `No se pudo leer: ${(e as Error).message}`);
      actualizar(clave, { paso: `No se pudo leer el archivo: ${(e as Error).message}`, fin: "error" });
    }
  }

  async function recibir(archivos: FileList | File[]) {
    const lista = [...archivos];
    if (!lista.length) return;
    const nuevos = lista.map((a) => ({ clave: crypto.randomUUID(), nombre: a.name, paso: "En espera…" }));
    setEstados((e) => [...nuevos, ...e]);
    // Uno por uno, para no saturar el celular
    for (let i = 0; i < lista.length; i++) await procesar(lista[i], nuevos[i].clave);
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          recibir(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 px-4 py-12 text-center transition-colors active:bg-muted",
          encima && "border-foreground bg-muted",
        )}
      >
        <FileUp className="size-10 text-primary" />
        <span className="text-lg font-semibold">Toca para elegir tus documentos</span>
        <span className="text-sm text-muted-foreground">o arrástralos aquí desde la computadora</span>
      </button>
      <input
        ref={entrada}
        type="file"
        multiple
        accept={ACEPTA}
        className="hidden"
        data-testid="entrada-archivos"
        onChange={(e) => {
          if (e.target.files) recibir(e.target.files);
          e.target.value = "";
        }}
      />
      {estados.length > 0 && (
        <ul className="grid gap-2" aria-live="polite">
          {estados.map((e) => (
            <li key={e.clave} className="flex items-start gap-3 rounded-xl border bg-card p-3 text-sm">
              {e.fin === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : e.fin === "error" ? (
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.nombre}</p>
                <p className={cn("text-muted-foreground", e.fin === "error" && "text-destructive")}>{e.paso}</p>
              </div>
              {e.fin === "ok" && e.id && (
                <Link href={`/documentos/${e.id}`} className="flex min-h-11 shrink-0 items-center font-medium text-primary">
                  Ver ficha
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
