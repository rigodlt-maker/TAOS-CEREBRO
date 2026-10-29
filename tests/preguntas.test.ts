// Batería de preguntas reales a tus documentos, escritas de muchas formas
import assert from "node:assert/strict";
import { test } from "node:test";
import { conversar } from "../lib/conversar";
import { repoMemoria } from "../lib/datos/memoria";
import { preguntar } from "../lib/preguntar";
import type { Categoria, Documento } from "../lib/tipos";

const doc = (id: string, nombre: string, categoria: Categoria, tipo: string, vence: string | null = null, creado = "2026-10-01"): Documento => ({
  id, nombre, ruta_storage: null, tipo_archivo: null, categoria, tipo_documento: tipo, estado_procesamiento: "listo", error_procesamiento: null, created_at: creado,
  ficha: { partes: null, numero_referencia: null, fecha_inicio: null, fecha_vencimiento: vence, montos: {}, condiciones_clave: [], contacto: null, campos_no_especificados: [] },
});
const docs = [
  doc("ine", "INE Juan.pdf", "Identidad y trámites", "INE", "2031-12-31", "2026-10-20"),
  doc("pas", "Pasaporte.pdf", "Identidad y trámites", "Pasaporte", "2026-05-01"),
  doc("sat", "Constancia situación fiscal.pdf", "Finanzas e impuestos", "Constancia de situación fiscal"),
  doc("gmm", "Póliza GMM.pdf", "Seguros", "Póliza de gastos médicos", "2027-03-01"),
  doc("auto", "Póliza Versa.pdf", "Seguros", "Póliza de seguro de auto", "2026-11-20"),
  doc("tc", "Tarjeta de circulación Versa.pdf", "Vehículos", "Tarjeta de circulación", "2027-01-15", "2026-10-25"),
  doc("mess", "Calendario propedéutico MESS.pdf", "Identidad y trámites", "Calendario de actividades", null, "2026-10-26"),
];
const hoy = "2026-10-27";
const r = (p: string) => conversar(p, docs, [], hoy)?.texto ?? "(sin respuesta general)";

const CASOS: [string, RegExp][] = [
  ["hola", /Tienes \*\*7 documentos\*\*/],
  ["buenas tardes", /Tienes \*\*7 documentos\*\*/],
  ["¿qué puedes hacer?", /Puedo encontrar/],
  ["ayuda", /Puedo encontrar/],
  ["gracias", /Con gusto/],
  ["¿qué documentos tengo?", /Tienes \*\*7 documentos\*\*:/],
  ["cuantos documentos tengo", /Tienes \*\*7 documentos\*\*:/],
  ["lista de mis documentos", /Tienes \*\*7 documentos\*\*:/],
  ["mis seguros", /Seguros\*\* \(2\)/],
  ["que polizas tengo", /Seguros\*\* \(2\)/],
  ["¿qué tengo del carro?", /Vehículos\*\* \(1\)/],
  ["documentos de identidad", /Identidad y trámites\*\* \(3\)/],
  ["documentos de salud", /No tienes documentos de \*\*Salud/],
  ["¿qué ya venció?", /Pasaporte\.pdf/],
  ["que documentos estan vencidos", /ya vencieron \(1\)/],
  ["¿qué subí últimamente?", /Lo último que subiste:\n\n- \[Calendario propedéutico MESS/],
  ["documentos recientes", /Lo último que subiste/],
  ["¿qué me falta?", /Te sugiero subir/],
  ["que documentos me faltan", /Te sugiero subir/],
  ["que deberia subir", /Te sugiero subir/],
  ["pásame mi INE", /Aquí está: \[INE Juan\.pdf\]/],
  ["dame mi pasaporte", /Aquí está: \[Pasaporte\.pdf\]/],
  ["¿dónde está mi constancia del SAT?", /Aquí está: \[Constancia situación fiscal\.pdf\]/],
  ["necesito la tarjeta de circulación", /Aquí está: \[Tarjeta de circulación Versa\.pdf\]/],
  ["abre el calendario del propedéutico", /Aquí está: \[Calendario propedéutico MESS\.pdf\]/],
  ["muéstrame mis pólizas", /Seguros\*\* \(2\)/],
  ["mis notas", /No tienes notas/],
];

for (const [p, esperado] of CASOS) test(`entiende: "${p}"`, () => assert.match(r(p), esperado, r(p)));

test("las preguntas de un dato siguen yendo a los documentos", () => {
  for (const p of ["¿Cuándo vence mi seguro del auto?", "¿cuánto pago de renta?", "teléfono del seguro", "¿quién es el arrendador?"]) assert.equal(conversar(p, docs, [], hoy), null, p);
});

async function pregunta(p: string) {
  let t = "";
  for await (const parte of preguntar(repoMemoria(), p)) t += parte;
  return t;
}

test("de punta a punta con los documentos de ejemplo", async () => {
  assert.match(await pregunta("¿Cuándo vence mi seguro?"), /10 de enero de 2027/);
  assert.match(await pregunta("cuando se acaba la poliza del coche"), /10 de enero de 2027/);
  assert.match(await pregunta("¿Cuánto pago de renta?"), /9,500/);
  assert.match(await pregunta("hasta cuando es la garantia del refri"), /garant/i);
  assert.match(await pregunta("¿qué documentos tengo?"), /Tienes \*\*3 documentos\*\*/);
  assert.match(await pregunta("hola"), /Tienes \*\*3 documentos\*\*/);
  assert.match(await pregunta("pásame el contrato de renta"), /Aquí está/);
});
