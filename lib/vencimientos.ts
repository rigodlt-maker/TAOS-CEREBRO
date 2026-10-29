import { diasEntre } from "./fechas";
import type { Documento } from "./tipos";

export type Estado = "vencido" | "pronto" | "vigente" | "sin fecha";

export function estadoVencimiento(fecha: string | null | undefined, hoy: string): Estado {
  if (!fecha) return "sin fecha";
  const dias = diasEntre(hoy, fecha);
  if (dias < 0) return "vencido";
  if (dias < 30) return "pronto";
  return "vigente";
}

// Qué conviene hacer antes de que venza
export function accionSugerida(doc: Pick<Documento, "categoria" | "tipo_documento">): string {
  const tipo = (doc.tipo_documento ?? "").toLowerCase();
  if (tipo.includes("renta")) return "Avisar al arrendador si vas a renovar o a salirte (revisa el plazo de aviso del contrato).";
  if (tipo.includes("garantía")) return "Si el producto tiene alguna falla, usa la garantía antes de que venza.";
  if (tipo.includes("servicios")) return "Decidir si lo renuevas o lo cancelas, y avisar al proveedor a tiempo.";
  switch (doc.categoria) {
    case "Seguros":
      return "Renovar la póliza o cotizar otra antes de quedarte sin cobertura.";
    case "Vehículos":
      return "Renovar o hacer el trámite antes de la fecha para evitar multas.";
    case "Identidad y trámites":
      return "Sacar cita para renovarlo con tiempo.";
    case "Contratos":
      return "Revisar si se renueva solo y avisar a la otra parte si lo vas a cancelar.";
    default:
      return "Revisar si hay que renovarlo, cancelarlo o avisar a alguien.";
  }
}

export type Aviso = { doc: Documento; dias: number; clave: string };

// Avisos de 30 y 7 días. Si un día no corrió el cron, se manda al siguiente (sin repetir: "avisos_enviados")
export function avisosPendientes(docs: Documento[], hoy: string): Aviso[] {
  const avisos: Aviso[] = [];
  for (const doc of docs) {
    const fecha = doc.ficha?.fecha_vencimiento;
    if (!fecha) continue;
    const dias = diasEntre(hoy, fecha);
    if (dias < 0) continue;
    const enviados = doc.avisos_enviados ?? [];
    const umbral = dias <= 7 ? 7 : dias <= 30 ? 30 : null;
    if (umbral === null) continue;
    const clave = `${umbral}:${fecha}`;
    if (!enviados.includes(clave)) avisos.push({ doc, dias, clave });
  }
  return avisos.sort((a, b) => a.dias - b.dias);
}

// Lo que vence en los próximos N días (para el resumen del día 1)
export function vencenEn(docs: Documento[], hoy: string, dias: number): Documento[] {
  return docs
    .filter((d) => {
      const f = d.ficha?.fecha_vencimiento;
      return f && diasEntre(hoy, f) >= 0 && diasEntre(hoy, f) <= dias;
    })
    .sort((a, b) => a.ficha!.fecha_vencimiento!.localeCompare(b.ficha!.fecha_vencimiento!));
}
