import { enCuanto, fechaCorta } from "@/lib/fechas";
import { estadoVencimiento } from "@/lib/vencimientos";
import { Badge } from "./ui/campos";

// Etiqueta de vencimiento: rojo si ya venció, borde fuerte si vence en menos de 30 días
export function Vencimiento({ fecha, hoy }: { fecha: string | null | undefined; hoy: string }) {
  const estado = estadoVencimiento(fecha, hoy);
  if (!fecha) return <Badge>Sin fecha</Badge>;
  return (
    <Badge tono={estado === "vencido" ? "rojo" : estado === "pronto" ? "fuerte" : "neutro"} title={fechaCorta(fecha)}>
      {estado === "vigente" ? `Vence ${fechaCorta(fecha)}` : `${enCuanto(fecha, hoy).replace(/^./, (c) => c.toUpperCase())}`}
    </Badge>
  );
}
