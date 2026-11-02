import { RenglonDocumento } from "@/components/mis-documentos";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { evaluar, resumen } from "@/lib/mis-documentos";
import { obtenerRepo } from "@/lib/sesion";

export const metadata = { title: "Mis documentos" };

// La lista de papeles importantes: qué ya tienes, qué falta y cómo tramitar lo que no tienes
export default async function MisDocumentos() {
  const repo = await obtenerRepo();
  const [docs, notas, marcas] = await Promise.all([repo.documentos(), repo.notas(), repo.marcasDocumentos()]);
  const secciones = evaluar(docs, notas, marcas);
  const { total, listos, basicosFaltan } = resumen(secciones);
  const avance = total ? Math.round((listos / total) * 100) : 0;

  return (
    <div className="grid gap-4">
      <Card>
        <CardTitle className="text-xl">Mis documentos</CardTitle>
        <CardDescription className="mt-1">
          Los papeles que todo adulto en México debe tener a la mano. Los que subes se marcan solos.
        </CardDescription>
        <div className="mt-4 grid gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <strong className="text-lg">{listos}</strong> de {total} listos
            </span>
            <span className="text-muted-foreground">{avance}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${avance}%` }} />
          </div>
          {basicosFaltan.length > 0 && (
            <p className="text-sm text-amber-400">
              Te faltan básicos: {basicosFaltan.map((i) => i.nombre).join(", ")}.
            </p>
          )}
        </div>
      </Card>

      {secciones.map((s) => (
        <section key={s.titulo} className="grid gap-2">
          <h2 className="px-1 text-sm font-semibold text-muted-foreground">
            {s.icono} {s.titulo}
          </h2>
          <ul className="grid gap-2">
            {s.items.map(({ patron: _, ...item }) => (
              <RenglonDocumento key={item.clave} item={item} />
            ))}
          </ul>
        </section>
      ))}
      <p className="px-1 text-center text-xs text-muted-foreground">Los trámites cambian: confirma siempre requisitos y costos en el sitio oficial.</p>
    </div>
  );
}
