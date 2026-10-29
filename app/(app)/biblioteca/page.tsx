import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/campos";
import { Vencimiento } from "@/components/vencimiento";
import { hoyEnMexico } from "@/lib/fechas";
import { obtenerRepo } from "@/lib/sesion";
import { CATEGORIAS } from "@/lib/tipos";

export default async function Biblioteca({ searchParams }: { searchParams: Promise<{ categoria?: string; q?: string }> }) {
  const { categoria, q } = await searchParams;
  const repo = await obtenerRepo();
  const hoy = hoyEnMexico();
  const docs = await repo.documentos({ categoria: categoria || undefined, q: q?.trim() || undefined });

  return (
    <div className="grid gap-4">
      <Titulo detalle={`${docs.length} documentos`}>Biblioteca</Titulo>
      {/* Buscar y filtrar en un solo formulario: menos botones en pantalla */}
      <form action="/biblioteca" className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
        <div className="relative">
          <Search className="absolute top-3.5 left-4 size-5 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar…" className="pl-12" aria-label="Buscar" />
        </div>
        <Select name="categoria" defaultValue={categoria ?? ""} aria-label="Categoría">
          <option value="">Todas</option>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <button type="submit" className="sr-only">
          Buscar
        </button>
      </form>
      {docs.length === 0 ? (
        <Card>
          <CardDescription>{q || categoria ? "No encontré documentos con ese filtro." : "Todavía no subes documentos. Toca Subir."}</CardDescription>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/documentos/${d.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-3 active:bg-muted">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{d.tipo_documento ?? "Documento"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {d.estado_procesamiento === "procesando" ? "Procesando…" : d.estado_procesamiento === "error" ? "Error al leer" : d.categoria}
                  </span>
                </span>
                {d.ficha?.fecha_vencimiento && <Vencimiento fecha={d.ficha.fecha_vencimiento} hoy={hoy} />}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
