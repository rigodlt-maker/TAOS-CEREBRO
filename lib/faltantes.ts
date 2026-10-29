// "¿Qué me falta?": documentos que suelen ir juntos con los que ya tienes y todavía no subes
import { plano } from "./extraer";
import type { Documento, Nota } from "./tipos";

export type Sugerencia = { documento: string; porque: string };

type Regla = { si: RegExp; faltan: [string, RegExp][]; porque: string };

const REGLAS: Regla[] = [
  {
    si: /poliza de seguro de auto/,
    porque: "Tienes la póliza del auto",
    faltan: [
      ["Tarjeta de circulación", /tarjeta de circulacion/],
      ["Factura del auto", /factura del auto/],
      ["Licencia de conducir", /licencia de conducir/],
      ["Comprobante de verificación vehicular", /verificacion vehicular/],
    ],
  },
  {
    si: /tarjeta de circulacion|factura del auto|verificacion vehicular/,
    porque: "Tienes papeles del auto",
    faltan: [["Póliza de seguro de auto", /poliza de seguro de auto/]],
  },
  {
    si: /contrato de renta/,
    porque: "Tienes un contrato de renta",
    faltan: [
      ["Comprobante del depósito en garantía", /deposito/],
      ["Identificación del arrendador", /identificacion del arrendador|ine del arrendador/],
    ],
  },
  {
    si: /gastos medicos/,
    porque: "Tienes una póliza de gastos médicos",
    faltan: [
      ["Credencial o tarjeta del seguro médico", /credencial.*seguro|tarjeta.*seguro medico/],
      ["Condiciones generales de la póliza", /condiciones generales/],
    ],
  },
  {
    si: /poliza de seguro/,
    porque: "Tienes pólizas de seguro",
    faltan: [["Condiciones generales de cada póliza", /condiciones generales/]],
  },
  {
    si: /garantia/,
    porque: "Tienes garantías",
    faltan: [["Ticket o factura de compra", /ticket|factura de compra|nota de venta/]],
  },
  {
    si: /escrituras|predial/,
    porque: "Tienes papeles de tu casa",
    faltan: [
      ["Escrituras", /escrituras/],
      ["Último pago de predial", /predial/],
    ],
  },
];

// Los básicos que casi todos necesitamos tener a la mano en México
const BASICOS: [string, RegExp][] = [
  ["INE", /\bine\b|credencial para votar/],
  ["CURP", /\bcurp\b/],
  ["Acta de nacimiento", /acta de nacimiento/],
  ["Constancia de situación fiscal (RFC)", /constancia de situacion fiscal/],
  ["Comprobante de domicilio reciente", /comprobante de domicilio|recibo de luz|recibo de agua/],
];

export function queMeFalta(docs: Documento[], notas: Nota[] = []): Sugerencia[] {
  const tengo = plano(
    [...docs.map((d) => `${d.tipo_documento ?? ""} ${d.nombre}`), ...notas.map((n) => n.titulo)].join("\n"),
  );
  const sugerencias: Sugerencia[] = [];
  const agregar = (documento: string, porque: string) => {
    if (!sugerencias.some((s) => s.documento === documento)) sugerencias.push({ documento, porque });
  };
  for (const r of REGLAS) {
    if (!r.si.test(tengo)) continue;
    for (const [documento, patron] of r.faltan) if (!patron.test(tengo)) agregar(documento, r.porque);
  }
  for (const [documento, patron] of BASICOS) if (!patron.test(tengo)) agregar(documento, "Es un documento básico que conviene tener a la mano");
  return sugerencias;
}
