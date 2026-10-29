// "¿Cuál es mi RFC?": el dato exacto desde tus documentos
import assert from "node:assert/strict";
import { test } from "node:test";
import { datoPedido, responderDato } from "../lib/datos-personales";
import type { Documento } from "../lib/tipos";

const doc = (id: string, nombre: string, tipo: string): Documento => ({
  id, nombre, ruta_storage: null, tipo_archivo: null, categoria: "Identidad y trámites", tipo_documento: tipo, estado_procesamiento: "listo", error_procesamiento: null, created_at: "", ficha: null,
});
const docs = [
  doc("acta", "Acta de nacimiento.pdf", "Acta de nacimiento"),
  doc("csf", "Constancia de situacion fiscal (RFC) oct-2026.pdf", "Constancia de situación fiscal"),
  doc("nss", "NSS (IMSS).pdf", "Número de Seguridad Social (NSS)"),
  doc("pas", "Pasaporte.pdf", "Pasaporte"),
  doc("ced", "Cedula profesional.pdf", "Cédula o título profesional"),
];
const paginas = {
  acta: [{ pagina: 1, contenido: "Acta de Nacimiento JUAN PEREZ CURP PEPJ800101HDFRRN09" }],
  csf: [{ pagina: 1, contenido: "Datos de Identificación del Contribuyente: RFC: PEPJ800101AB1 CURP: PEPJ800101HDFRRN09" }],
  nss: [{ pagina: 1, contenido: "Asignación de Número de Seguridad Social. NSS: 12345678901. Folio de la solicitud: 1630637605026598756348" }],
  pas: [{ pagina: 1, contenido: "PASAPORTE PASSPORT Pasaporte No./ Passport No. G12345678 Fecha de caducidad 11 03 2033" }],
  ced: [{ pagina: 1, contenido: "12345678 PEPJ800101HDFRRN09 LICENCIATURA EN ARQUITECTURA 06/02/2022" }],
};

test("entiende qué dato le pides", () => {
  assert.equal(datoPedido("¿Cuál es mi RFC?")?.nombre, "RFC");
  assert.equal(datoPedido("dame mi curp")?.nombre, "CURP");
  assert.equal(datoPedido("cual es mi numero de seguro social")?.nombre, "Número de Seguridad Social (NSS)");
  assert.equal(datoPedido("número de pasaporte")?.nombre, "número de pasaporte");
  assert.equal(datoPedido("¿Cuándo vence mi pasaporte?"), null);
  assert.equal(datoPedido("pásame mi pasaporte"), null); // eso es el documento, no el número
});

test("saca el dato del documento correcto", () => {
  const r = (p: string) => responderDato(datoPedido(p)!, docs, paginas).texto;
  assert.match(r("¿Cuál es mi RFC?"), /\*\*PEPJ800101AB1\*\*.*\n\n.*Constancia de situación fiscal/s);
  assert.match(r("dame mi curp"), /\*\*PEPJ800101HDFRRN09\*\*/);
  assert.match(r("cual es mi nss"), /\*\*12345678901\*\*/);
  assert.match(r("mi numero de pasaporte"), /\*\*G12345678\*\*/);
  assert.match(r("cual es mi cedula profesional"), /\*\*12345678\*\*/);
  assert.match(responderDato(datoPedido("numero de pasaporte")!, [docs[3]], { pas: [{ pagina: 1, contenido: "Pasaporte No./ Passport No.\n\nNO1234567" }] }).texto, /\*\*N01234567\*\*/);
  assert.match(responderDato(datoPedido("mi rfc")!, [], {}).texto, /No encontré tu RFC/);
});
