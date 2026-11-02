import { Suspense } from "react";
import { redirect } from "next/navigation";
import { configuracionPendiente } from "@/lib/configuracion";
import { Chat } from "@/components/chat";
import { Navegacion } from "@/components/navegacion";
import { Encabezado } from "@/components/taos/encabezado";
import { Recorrido, type Paso } from "@/components/taos/recorrido";
import { BotonTao } from "@/components/taos/tao";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Recorrido de bienvenida (sale una sola vez)
const RECORRIDO: Paso[] = [
  { icono: "🧠", titulo: "Bienvenido a Segundo Cerebro", texto: "Tus papeles importantes, siempre a la mano. Sube un PDF o una foto con el botón Subir, o conecta tu Google Drive en Cuenta." },
  { icono: "🎙️", titulo: "Pregunta como a un amigo", texto: "Toca Tao y pregunta o habla: “pásame mi INE”, “¿cuándo vence mi seguro?”, “¿cómo me llamo?”. Te da el dato y de dónde sale." },
  { icono: "⏰", titulo: "Te aviso antes", texto: "En Vence ves lo que está por caducar. Activa las notificaciones en Cuenta y te aviso con tiempo." },
  { icono: "✅", titulo: "Mis documentos", texto: "La lista de papeles que todo adulto necesita: qué tienes, qué falta y cómo tramitar lo que no tienes." },
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
          <BotonTao>
            <Chat />
          </BotonTao>
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
