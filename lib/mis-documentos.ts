// "Mis documentos": la lista del Checklist de documentos (Bono 5) dentro de la app.
// Cada documento queda Listo (lo subiste o lo marcaste), Falta, No aplica o "No cuento con él" (con una guía para tramitarlo).
// Los trámites cambian: las guías son cortas y siempre llevan la liga oficial para confirmar requisitos.
import { plano } from "./extraer";
import type { Documento, Nota } from "./tipos";

export type Marca = "tengo" | "no_aplica" | "no_tengo";
export type Estado = "listo" | "tengo" | "falta" | "no_aplica" | "no_tengo";
export type Guia = { pasos: string[]; enlace?: { texto: string; url: string } };
export type Item = { clave: string; nombre: string; nota: string; basico?: boolean; patron: RegExp; guia?: Guia };
export type Seccion = { titulo: string; icono: string; items: Item[] };
export type ItemConEstado = Item & { estado: Estado; documento?: { id: string; nombre: string } };
// Lo que se manda a la pantalla (sin la expresión de detección, que el navegador no puede recibir)
export type ItemPantalla = Omit<ItemConEstado, "patron">;
export type SeccionConEstado = Omit<Seccion, "items"> & { items: ItemConEstado[] };

const CONFIRMA = "Confirma requisitos y costos en el sitio oficial antes de ir.";

export const SECCIONES: Seccion[] = [
  {
    titulo: "Identidad",
    icono: "🪪",
    items: [
      {
        clave: "acta_nacimiento",
        nombre: "Acta de nacimiento",
        nota: "Sin vencimiento. Muchas oficinas piden una copia reciente.",
        basico: true,
        patron: /acta de nacimiento/,
        guia: {
          pasos: ["Entra al sitio oficial con tu CURP.", "Busca tu acta, paga en línea y descárgala en PDF.", "Súbela aquí para tenerla siempre a la mano.", CONFIRMA],
          enlace: { texto: "gob.mx/ActaNacimiento", url: "https://www.gob.mx/ActaNacimiento" },
        },
      },
      {
        clave: "curp",
        nombre: "CURP",
        nota: "Sin vencimiento. Se descarga gratis.",
        basico: true,
        patron: /\bcurp\b/,
        guia: {
          pasos: ["Entra a la página de la CURP.", "Búscala con tus datos o con tu clave.", "Descarga el PDF (es gratis) y súbelo aquí."],
          enlace: { texto: "gob.mx/curp", url: "https://www.gob.mx/curp" },
        },
      },
      {
        clave: "ine",
        nombre: "Credencial del INE",
        nota: "Vence a los 10 años: revisa el año de vigencia al frente.",
        basico: true,
        patron: /\bine\b|credencial para votar/,
        guia: {
          pasos: [
            "Agenda una cita en el sitio del INE.",
            "Lleva tu acta de nacimiento, una identificación con foto y un comprobante de domicilio reciente.",
            "El trámite es gratuito. Cuando te la entreguen, súbela por ambos lados en un solo PDF.",
            CONFIRMA,
          ],
          enlace: { texto: "ine.mx", url: "https://www.ine.mx" },
        },
      },
      {
        clave: "pasaporte",
        nombre: "Pasaporte",
        nota: "Vence según lo que pagaste (1, 3, 6 o 10 años).",
        patron: /pasaporte/,
        guia: {
          pasos: [
            "Agenda tu cita en el sistema de citas de la SRE.",
            "Paga los derechos según los años de vigencia que elijas.",
            "Lleva acta de nacimiento, identificación oficial, CURP y tu comprobante de pago.",
            CONFIRMA,
          ],
          enlace: { texto: "gob.mx/sre (pasaporte)", url: "https://www.gob.mx/sre" },
        },
      },
      { clave: "cartilla_militar", nombre: "Cartilla del Servicio Militar", nota: "Solo hombres que la tramitaron. Guárdala escaneada.", patron: /cartilla (del servicio )?militar|servicio militar/ },
    ],
  },
  {
    titulo: "Impuestos y trabajo",
    icono: "💼",
    items: [
      {
        clave: "csf",
        nombre: "RFC / Constancia de Situación Fiscal",
        nota: "Suele pedirse reciente: descárgala cuando te la pidan.",
        basico: true,
        patron: /constancia de situacion fiscal|cedula de identificacion fiscal|\brfc\b/,
        guia: {
          pasos: ["Si aún no tienes RFC, inscríbete en línea en el SAT con tu CURP.", "Para la constancia, entra con tu RFC y contraseña (o e.firma) y descárgala.", "Súbela aquí; cuando caduque, solo vuelve a descargarla."],
          enlace: { texto: "sat.gob.mx", url: "https://www.sat.gob.mx" },
        },
      },
      {
        clave: "efirma",
        nombre: "e.firma del SAT",
        nota: "Vence a los 4 años. Guarda el .cer, el .key y la contraseña en un lugar seguro.",
        patron: /e\.?firma|firma electronica/,
        guia: {
          pasos: ["Agenda una cita en el SAT.", "Lleva identificación oficial, una memoria USB y un correo al que tengas acceso.", "El trámite es gratuito. No compartas nunca tu .key ni tu contraseña.", CONFIRMA],
          enlace: { texto: "sat.gob.mx", url: "https://www.sat.gob.mx" },
        },
      },
      {
        clave: "nss",
        nombre: "Número de Seguridad Social (IMSS)",
        nota: "Sin vencimiento.",
        patron: /seguridad social|\bnss\b|vigencia de derechos/,
        guia: {
          pasos: ["Entra al sitio del IMSS con tu CURP y un correo.", "Te llega el documento con tu NSS (es gratis).", "Súbelo aquí."],
          enlace: { texto: "imss.gob.mx", url: "https://www.imss.gob.mx" },
        },
      },
      { clave: "nomina", nombre: "Contrato laboral y recibos de nómina", nota: "Sirven para créditos y aclaraciones.", patron: /contrato (laboral|individual de trabajo)|recibo de nomina|\bnomina\b/ },
      {
        clave: "afore",
        nombre: "Estado de cuenta de tu AFORE",
        nota: "Revísalo cada 4 meses.",
        patron: /afore/,
        guia: { pasos: ["Consulta en e-SAR o en la app AforeMóvil con tu CURP.", "Descarga el estado de cuenta y súbelo aquí."], enlace: { texto: "e-sar.com.mx", url: "https://www.e-sar.com.mx" } },
      },
      { clave: "infonavit", nombre: "Precalificación Infonavit / Fovissste", nota: "Si cotizas, consulta tus puntos y tu ahorro para vivienda.", patron: /infonavit|fovissste|precalificacion/ },
    ],
  },
  {
    titulo: "Estudios",
    icono: "🎓",
    items: [
      { clave: "certificados", nombre: "Certificados de secundaria y preparatoria", nota: "Sin vencimiento. Si lo perdiste, pide duplicado en tu escuela o en la SEP de tu estado.", patron: /certificado de estudios|certificado de (secundaria|bachillerato|preparatoria)/ },
      {
        clave: "titulo_cedula",
        nombre: "Título y cédula profesional",
        nota: "Sin vencimiento.",
        patron: /titulo profesional|cedula (o titulo )?profesional/,
        guia: { pasos: ["La cédula electrónica se tramita en línea.", "Descárgala y súbela junto con tu título."], enlace: { texto: "gob.mx/cedulaprofesional", url: "https://www.gob.mx/cedulaprofesional" } },
      },
    ],
  },
  {
    titulo: "Salud",
    icono: "🩺",
    items: [
      { clave: "vacunas", nombre: "Carnet o cartilla de vacunación", nota: "Tuyo y de tus hijos. Si no la tienes, pide una en tu centro de salud.", patron: /vacunacion|cartilla de salud/ },
      { clave: "gastos_medicos", nombre: "Póliza de gastos médicos", nota: "Revisa la renovación, el deducible y el teléfono de siniestros.", patron: /gastos medicos/ },
      { clave: "sangre", nombre: "Tipo de sangre, alergias y medicamentos", nota: "Una nota con esto puede salvarte en una emergencia. Créala en Notas.", patron: /tipo de sangre|alergia/ },
      { clave: "estudios_medicos", nombre: "Estudios y recetas recientes", nota: "Últimos análisis, radiografías y recetas.", patron: /receta|informe medico|documento medico|laboratorio/ },
    ],
  },
  {
    titulo: "Casa",
    icono: "🏠",
    items: [
      { clave: "escrituras_renta", nombre: "Escrituras o contrato de arrendamiento", nota: "Contrato: revisa la fecha de término y el depósito.", patron: /escrituras|contrato de renta|arrendamiento/ },
      { clave: "predial_agua", nombre: "Predial y agua", nota: "Pago anual o bimestral según tu municipio; guarda los comprobantes.", patron: /predial|recibo de agua/ },
      {
        clave: "domicilio",
        nombre: "Comprobante de domicilio reciente",
        nota: "Casi siempre lo piden de los últimos 3 meses.",
        basico: true,
        patron: /comprobante de domicilio|recibo de (luz|agua|telefono|internet)/,
        guia: { pasos: ["Descarga tu último recibo de luz en la página de CFE (o el de agua, teléfono o internet).", "Súbelo aquí y repítelo cada 3 meses."], enlace: { texto: "cfe.mx", url: "https://www.cfe.mx" } },
      },
      { clave: "seguro_casa", nombre: "Póliza de seguro de casa", nota: "Si tienes; revisa qué cubre (sismo, inundación, robo).", patron: /seguro (de )?(casa|hogar)/ },
    ],
  },
  {
    titulo: "Auto",
    icono: "🚗",
    items: [
      { clave: "factura_auto", nombre: "Factura del auto", nota: "El documento más importante del auto. Nunca entregues la original.", patron: /factura del auto|factura (del )?vehiculo/ },
      { clave: "circulacion", nombre: "Tarjeta de circulación", nota: "La vigencia depende de tu estado.", patron: /tarjeta de circulacion/ },
      { clave: "licencia", nombre: "Licencia de manejo", nota: "La vigencia depende de tu estado. Se tramita en la secretaría de movilidad de tu estado.", patron: /licencia de conducir|licencia de manejo/ },
      { clave: "seguro_auto", nombre: "Póliza de seguro del auto", nota: "Vence cada año. Guarda el teléfono de siniestros en tus contactos.", patron: /seguro (de )?auto|poliza.*auto/ },
      { clave: "verificacion", nombre: "Verificación y tenencia / refrendo", nota: "Según tu estado; anota el periodo que te toca.", patron: /verificacion vehicular|tenencia|refrendo/ },
    ],
  },
  {
    titulo: "Dinero",
    icono: "💳",
    items: [
      { clave: "contratos_tarjetas", nombre: "Contratos de tarjetas y créditos", nota: "Tasa, fecha de corte, fecha de pago y CAT.", patron: /contrato de (tarjeta|credito)|caratula/ },
      { clave: "estados_cuenta", nombre: "Estados de cuenta", nota: "Al menos los últimos 3 meses de cada cuenta.", patron: /estado de cuenta/ },
      { clave: "beneficiarios", nombre: "Beneficiarios de cuentas y seguros", nota: "Verifica que estén registrados y actualizados.", patron: /beneficiario/ },
    ],
  },
  {
    titulo: "Familia",
    icono: "👨‍👩‍👧",
    items: [
      { clave: "acta_matrimonio", nombre: "Acta de matrimonio", nota: "Sin vencimiento.", patron: /acta de matrimonio/ },
      { clave: "actas_hijos", nombre: "Actas de nacimiento y CURP de tus hijos", nota: "Las piden en cada inscripción escolar.", patron: /acta.*(hijo|hija)|curp.*(hijo|hija)/ },
      { clave: "testamento", nombre: "Testamento", nota: "Se hace ante notario; cada septiembre hay descuentos por el Mes del Testamento.", patron: /testamento/ },
      { clave: "poderes", nombre: "Poderes notariales", nota: "Si diste o recibiste alguno, guarda copia.", patron: /poder notarial|poder general/ },
    ],
  },
];

export const TODOS: Item[] = SECCIONES.flatMap((s) => s.items);

// Estado de cada documento: tu marca manda, salvo que ya subiste uno que coincide (entonces está Listo)
export function evaluar(docs: Documento[], notas: Nota[], marcas: Record<string, Marca>): SeccionConEstado[] {
  const fuentes = [
    ...docs.map((d) => ({ texto: plano(`${d.tipo_documento ?? ""} ${d.nombre}`), documento: { id: d.id, nombre: d.nombre } })),
    ...notas.map((n) => ({ texto: plano(n.titulo), documento: undefined })),
  ];
  return SECCIONES.map((s) => ({
    ...s,
    items: s.items.map((it) => {
      const hallado = fuentes.find((f) => it.patron.test(f.texto));
      if (hallado) return { ...it, estado: "listo" as const, documento: hallado.documento };
      return { ...it, estado: (marcas[it.clave] ?? "falta") as Estado };
    }),
  }));
}

export function resumen(secciones: SeccionConEstado[]) {
  const items = secciones.flatMap((s) => s.items).filter((i) => i.estado !== "no_aplica");
  const listos = items.filter((i) => i.estado === "listo" || i.estado === "tengo").length;
  const basicosFaltan = items.filter((i) => i.basico && (i.estado === "falta" || i.estado === "no_tengo"));
  return { total: items.length, listos, basicosFaltan };
}
