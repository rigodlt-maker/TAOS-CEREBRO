import { redirect } from "next/navigation";
import { configuracionPendiente } from "@/lib/configuracion";
import { BotonPreguntar } from "@/components/chat";
import { Navegacion } from "@/components/navegacion";
import { Encabezado } from "@/components/taos/encabezado";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  // Primera vez (o tras una actualización): primero se crean las tablas en Supabase
  if (await configuracionPendiente()) redirect("/configurar");
  const repo = await obtenerRepo();
  return (
    <div className="mx-auto max-w-2xl px-4 pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <Encabezado nombre="Segundo Cerebro" derecha={<BotonPreguntar />} />
      {repo.modo === "demo" && (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Modo demostración:</strong> estás viendo 3 documentos de ejemplo.
        </p>
      )}
      <main>{children}</main>
      <Navegacion />
    </div>
  );
}
