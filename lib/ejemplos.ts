// Tres documentos de ejemplo (inventados) para probar la app sin usar papeles reales:
// una póliza de auto, un contrato de renta y una garantía.
import type { Pagina } from "./tipos";

export type Ejemplo = { nombre: string; paginas: Pagina[] };

export function ejemplos(hoy: string): Ejemplo[] {
  const [a] = hoy.split("-").map(Number);
  return [
    {
      nombre: "Póliza auto Seguros Ejemplo.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `SEGUROS EJEMPLO, S.A. DE C.V.
PÓLIZA DE SEGURO DE AUTOMÓVILES
Póliza No. 4471-883920-00
Contratante: Juan Pérez Ejemplo
Asegurado: Juan Pérez Ejemplo
Vehículo: Sedán modelo ${a - 3}, placas ABC-123-D
Vigencia: del 10/01/${a} al 10/01/${a + 1}, a las 12:00 horas
Prima neta: $8,450.00
Prima total: $9,802.00 MXN`,
        },
        {
          pagina: 2,
          contenido: `COBERTURAS
Daños materiales. Suma asegurada: valor comercial. Deducible: 5% del valor comercial.
Robo total. Deducible: 10% del valor comercial.
Responsabilidad civil por daños a terceros. Suma asegurada: $3,000,000.00
Exclusiones: no cubre daños causados cuando el conductor maneje en estado de ebriedad.
Para reportar un siniestro llama a la cabina 800 123 4567 las 24 horas.
Para cancelar la póliza se debe dar aviso por escrito con 15 días naturales de anticipación.`,
        },
      ],
    },
    {
      nombre: "Contrato de renta departamento.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `CONTRATO DE ARRENDAMIENTO DE CASA HABITACIÓN
Celebrado el 1 de marzo de ${a} entre
Arrendador: María López Ejemplo
Arrendatario: Juan Pérez Ejemplo
PRIMERA. El inmueble ubicado en Calle Falsa 123, Col. Centro.
SEGUNDA. La renta mensual será de $9,500.00 pesos, pagaderos los primeros 5 días de cada mes.
TERCERA. Depósito en garantía: $9,500.00 pesos.`,
        },
        {
          pagina: 2,
          contenido: `CUARTA. Vigencia: del 1 de marzo de ${a} al 28 de febrero de ${a + 1}.
QUINTA. Si el arrendatario no desea renovar, deberá dar aviso por escrito con 30 días de anticipación al vencimiento.
SEXTA. La renta se incrementará conforme a la inflación al renovar el contrato.
Contacto del arrendador: teléfono 55 1234 5678, maria.ejemplo@correo.com`,
        },
      ],
    },
    {
      nombre: "Garantía refrigerador.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `PÓLIZA DE GARANTÍA
Producto: Refrigerador 14 pies, Número de serie: RF2024X998877
Fecha de compra: 15/06/${a}
Esta garantía de 12 meses cubre defectos de fabricación.
No cubre daños por mal uso, golpes o variaciones de voltaje.
Para hacer válida la garantía presenta este certificado y tu ticket de compra.
Centro de atención: teléfono 800 555 0101, servicio@ejemplo.com.mx`,
        },
      ],
    },
  ];
}
