// Documentos de ejemplo (inventados) para probar la app sin usar papeles reales:
// póliza de auto, contrato de renta, garantía, INE, CURP, NSS, escrituras y pasaporte.
// Todos los nombres, claves y números son ficticios.
import type { Pagina } from "./tipos";

export type Ejemplo = { nombre: string; paginas: Pagina[] };

// dd/mm/aaaa, N días después de hoy (para que el pasaporte salga en "Vence pronto")
function enDias(hoy: string, dias: number) {
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

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
Contratante: Rodrigo Martínez Solís
Asegurado: Rodrigo Martínez Solís
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
Arrendador: María López
Arrendatario: Rodrigo Martínez Solís
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
    {
      nombre: "INE Rodrigo.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `INSTITUTO NACIONAL ELECTORAL
MÉXICO CREDENCIAL PARA VOTAR
NOMBRE MARTÍNEZ SOLÍS RODRIGO DOMICILIO C JACARANDAS 45 COL DEL VALLE 03100 BENITO JUÁREZ, CDMX
CLAVE DE ELECTOR MRSLRD90031509H400
CURP MASR900315HDFRLD08
FECHA DE NACIMIENTO 15/03/1990  SEXO H
AÑO DE REGISTRO 2008 01  SECCIÓN 4120
VIGENCIA 2024 - 2034`,
        },
      ],
    },
    {
      nombre: "CURP Rodrigo.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `CONSTANCIA DE LA CLAVE ÚNICA DE REGISTRO DE POBLACIÓN
Clave: MASR900315HDFRLD08
Nombre: RODRIGO MARTÍNEZ SOLÍS
Fecha de nacimiento: 15/03/1990
Entidad de registro: CIUDAD DE MÉXICO
Documento ficticio de ejemplo.`,
        },
      ],
    },
    {
      nombre: "NSS IMSS Rodrigo.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `INSTITUTO MEXICANO DEL SEGURO SOCIAL
CONSTANCIA DE ASIGNACIÓN O LOCALIZACIÓN DE NÚMERO DE SEGURIDAD SOCIAL
Nombre: RODRIGO MARTÍNEZ SOLÍS
CURP: MASR900315HDFRLD08
Número de Seguridad Social (NSS): 43169012345
Este número es único, permanente e intransferible.`,
        },
      ],
    },
    {
      nombre: "Escrituras casa.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `ESCRITURA PÚBLICA NÚMERO 48,215
NOTARÍA PÚBLICA No. 99 DE LA CIUDAD DE MÉXICO
En la Ciudad de México, a 20 de agosto de ${a - 4}, ante el Notario Público Lic. Ernesto Ejemplo,
se hace constar la COMPRAVENTA que otorga Inmobiliaria Ejemplo, S.A. de C.V. como vendedora
y Rodrigo Martínez Solís como comprador, respecto de la casa ubicada en
Calle Jacarandas 45, Col. Del Valle, Alcaldía Benito Juárez, C.P. 03100.
Superficie del terreno: 160 m². Cuenta predial: 045-123-08-000-1.`,
        },
        {
          pagina: 2,
          contenido: `Precio de la operación: $3,850,000.00 pesos.
Inscrita en el Registro Público de la Propiedad con folio real 1234567.
Testimonio expedido para el comprador.`,
        },
      ],
    },
    {
      nombre: "Pasaporte Rodrigo.pdf",
      paginas: [
        {
          pagina: 1,
          contenido: `ESTADOS UNIDOS MEXICANOS
PASAPORTE / PASSPORT
PASAPORTE NO. G12345678
Apellidos: MARTÍNEZ SOLÍS
Nombre: RODRIGO
Nacionalidad: MEXICANA
Fecha de nacimiento: 15/03/1990
Fecha de expedición: ${enDias(hoy, 50).slice(0, 6)}${Number(enDias(hoy, 50).slice(6)) - 6}
Fecha de caducidad: ${enDias(hoy, 50)}`,
        },
      ],
    },
  ];
}
