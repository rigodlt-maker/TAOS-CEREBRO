"use client";

// Un renglón de "Mis documentos" con sus botones: Lo tengo en papel · No aplica · No cuento con él (abre la guía)
import { Check, ChevronDown, ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { marcarDocumentoAccion } from "@/lib/acciones";
import type { ItemConEstado, ItemPantalla, Marca } from "@/lib/mis-documentos";
import { cn } from "@/lib/utils";

const ETIQUETA: Record<ItemConEstado["estado"], { texto: string; clase: string }> = {
  listo: { texto: "Listo", clase: "bg-emerald-500/15 text-emerald-400" },
  tengo: { texto: "En papel", clase: "bg-emerald-500/15 text-emerald-400" },
  falta: { texto: "Falta", clase: "bg-amber-500/15 text-amber-400" },
  no_tengo: { texto: "Por tramitar", clase: "bg-rose-500/15 text-rose-400" },
  no_aplica: { texto: "No aplica", clase: "bg-muted text-muted-foreground" },
};

export function RenglonDocumento({ item }: { item: ItemPantalla }) {
  const [abierto, setAbierto] = useState(item.estado === "no_tengo");
  const [error, setError] = useState("");
  const [pendiente, iniciar] = useTransition();
  const etiqueta = ETIQUETA[item.estado];

  const marcar = (marca: Marca | null) =>
    iniciar(async () => {
      const r = await marcarDocumentoAccion(item.clave, marca);
      setError(r.ok ? "" : r.mensaje);
      if (r.ok && marca === "no_tengo") setAbierto(true);
    });

  const boton = "flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm active:bg-muted disabled:opacity-50";

  return (
    <li className={cn("grid gap-2 rounded-2xl border p-3", item.estado === "no_aplica" && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.nombre}</p>
          <p className="text-xs text-muted-foreground">{item.nota}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", etiqueta.clase)}>{etiqueta.texto}</span>
      </div>

      {item.estado === "listo" && item.documento && (
        <Link href={`/documentos/${item.documento.id}`} className="flex min-h-11 items-center gap-2 text-sm text-primary">
          <FileText className="size-4" /> {item.documento.nombre}
        </Link>
      )}

      {item.estado !== "listo" && (
        <div className="flex flex-wrap gap-2">
          {pendiente && <Loader2 className="size-5 animate-spin self-center text-muted-foreground" />}
          {item.estado === "falta" && (
            <>
              <Link href="/subir" className={cn(boton, "border-primary/60 text-primary")}>
                Subirlo
              </Link>
              <button type="button" className={boton} disabled={pendiente} onClick={() => marcar("tengo")}>
                <Check className="size-4" /> Lo tengo en papel
              </button>
              <button type="button" className={boton} disabled={pendiente} onClick={() => marcar("no_tengo")}>
                No cuento con él
              </button>
              <button type="button" className={boton} disabled={pendiente} onClick={() => marcar("no_aplica")}>
                No aplica
              </button>
            </>
          )}
          {item.estado !== "falta" && (
            <button type="button" className={boton} disabled={pendiente} onClick={() => marcar(null)}>
              <RotateCcw className="size-4" /> Quitar marca
            </button>
          )}
          {item.guia && item.estado !== "no_aplica" && item.estado !== "tengo" && (
            <button type="button" className={boton} onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
              <ChevronDown className={cn("size-4 transition-transform", abierto && "rotate-180")} /> Cómo tramitarlo
            </button>
          )}
        </div>
      )}

      {abierto && item.guia && item.estado !== "listo" && (
        <div className="grid gap-2 rounded-xl bg-muted/50 p-3 text-sm">
          <ol className="grid list-decimal gap-1 pl-5">
            {item.guia.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          {item.guia.enlace && (
            <a href={item.guia.enlace.url} target="_blank" rel="noopener" className="flex min-h-11 items-center gap-1.5 font-medium text-primary">
              <ExternalLink className="size-4" /> Sitio oficial: {item.guia.enlace.texto}
            </a>
          )}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </li>
  );
}
