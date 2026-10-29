import Link from "next/link";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription } from "@/components/ui/card";
import { Vencimiento } from "@/components/vencimiento";
import { hoyEnMexico } from "@/lib/fechas";
import { dinero } from "@/lib/formato";
import { obtenerRepo } from "@/lib/sesion";
import { cn } from "@/lib/utils";
import { estadoVencimiento } from "@/lib/vencimientos";

// Índice maestro: todas las fichas, lo que vence primero arriba (tarjetas en vez de tabla: sin scroll horizontal)
export default async function Indice() {
  const repo = await obtenerRepo();
  const hoy = hoyEnMexico();
  const docs = (await repo.documentos()).sort((a, b) =>
    (a.ficha?.fecha_vencimiento ?? "9999").localeCompare(b.ficha?.fecha_vencimiento ?? "9999"),
  );

  return (
    <div className="grid gap-4">
      <Titulo detalle="Lo que vence primero, arriba.">Vencimientos</Titulo>
      {docs.length === 0 ? (
        <Card>
          <CardDescription>Todavía no hay fichas. Toca Subir.</CardDescription>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {docs.map((d) => {
            const f = d.ficha;
            const estado = estadoVencimiento(f?.fecha_vencimiento, hoy);
            const monto = f && Object.entries(f.montos)[0];
            return (
              <li key={d.id}>
                <Link
                  href={`/documentos/${d.id}`}
                  className={cn(
                    "grid gap-1 rounded-2xl border bg-card px-4 py-3 active:bg-muted",
                    estado === "vencido" && "border-destructive/60",
                    estado === "pronto" && "border-primary/60",
                  )}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 font-medium">{d.tipo_documento ?? "Documento"}</span>
                    <Vencimiento fecha={f?.fecha_vencimiento} hoy={hoy} />
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {[d.categoria, f?.partes?.split(" · ")[0], monto && `${monto[0]}: ${dinero(monto[1])}`].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
