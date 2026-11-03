import { Suspense } from "react";
import { redirect } from "next/navigation";
import { configuracionPendiente } from "@/lib/configuracion";
import { Chat } from "@/components/chat";
import { Navegacion } from "@/components/navegacion";
import { Encabezado } from "@/components/taos/encabezado";
import { Recorrido, type Paso } from "@/components/taos/recorrido";
import { Campana } from "@/components/taos/campana";
import { BotonTao } from "@/components/taos/tao";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Recorrido de bienvenida (sale una sola vez)
const RECORRIDO: Paso[] = [
  { icono: "🧠", titulo: "Bienvenido a Segundo Cerebro", texto: "Tus papeles importantes, siempre a la mano. Te enseño lo básico en 1 minuto." },
  { icono: "📤", titulo: "Sube tus papeles", texto: "Un PDF o una foto: la app lo lee, lo acomoda y guarda sus datos.", donde: "flotante" },
  { icono: "🎙️", titulo: "Pregunta como a un amigo", texto: "“Pásame mi INE”, “¿cuándo vence mi seguro?”. Te da el dato y de dónde sale.", donde: "tao" },
  { icono: "⏰", titulo: "Lo que vence", texto: "Lo que está por caducar, para renovarlo a tiempo.", donde: "/indice" },
  { icono: "🔔", titulo: "Tus avisos", texto: "Aquí quedan los avisos que te manda la app, por si se te pasó alguno. El numerito te dice cuántos no has visto.", donde: "campana" },
  { icono: "⚙️", titulo: "Tu cuenta", texto: "Conecta Google Drive, revisa Mis documentos y activa los avisos.", donde: "/cuenta" },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  // Primera vez (o tras una actualización): primero se crean las tablas en Supabase
  if (await configuracionPendiente()) redirect("/configurar");
  const repo = await obtenerRepo();
  return (
    <div className="mx-auto max-w-2xl px-4 pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <Encabezado
        nombre="Segundo Cerebro"
        derecha={
          <div className="flex items-center gap-2">
            <Campana ajustes="/cuenta" />
            <BotonTao>
              <Chat />
            </BotonTao>
          </div>
        }
      />
      {repo.modo === "demo" && !process.env.OCULTAR_AVISO_DEMO && (
        <p className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Modo demostración:</strong> estás viendo 3 documentos de ejemplo.
        </p>
      )}
      <main>{children}</main>
      <Suspense>
        <Recorrido pasos={RECORRIDO} />
      </Suspense>
      <Navegacion />
    </div>
  );
}
