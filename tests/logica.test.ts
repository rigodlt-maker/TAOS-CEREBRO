import assert from "node:assert/strict";
import { test } from "node:test";
import { repoMemoria } from "../lib/datos/memoria";
import { ejemplos } from "../lib/ejemplos";
import { enmascarar } from "../lib/enmascarar";
import { clasificar, extraerFicha } from "../lib/extraer";
import { queMeFalta } from "../lib/faltantes";
import { buscarFechas } from "../lib/fechas";
import { preguntar } from "../lib/preguntar";
import { responder } from "../lib/responder";
import type { Documento } from "../lib/tipos";
import { avisosPendientes } from "../lib/vencimientos";

const [poliza, renta, garantia] = ejemplos("2026-10-22");
const texto = (e: typeof poliza) => e.paginas.map((p) => p.contenido).join("\n");

test("lee fechas en los formatos comunes de México", () => {
  const f = buscarFechas("del 10/01/2026 al 15 de marzo de 2027, emitida 3-ENE-26 y 2026-12-31").map((x) => x.fecha);
  assert.deepEqual(f, ["2026-01-10", "2027-03-15", "2026-01-03", "2026-12-31"]);
  assert.deepEqual(buscarFechas("31/02/2026"), []);
});

test("clasifica los tres documentos de ejemplo", () => {
  assert.deepEqual(clasificar(texto(poliza), poliza.nombre), { categoria: "Seguros", tipo_documento: "Póliza de seguro de auto" });
  assert.deepEqual(clasificar(texto(renta), renta.nombre), { categoria: "Contratos", tipo_documento: "Contrato de renta" });
  assert.deepEqual(clasificar(texto(garantia), garantia.nombre), { categoria: "Hogar", tipo_documento: "Garantía" });
});

test("extrae la ficha de la póliza sin inventar nada", () => {
  const f = extraerFicha(poliza.paginas);
  assert.equal(f.fecha_inicio, "2026-01-10");
  assert.equal(f.fecha_vencimiento, "2027-01-10");
  assert.equal(f.montos["Prima total"], 9802);
  assert.equal(f.numero_referencia, "•••• 2000");
  assert.match(f.contacto ?? "", /800 123 4567/);
  assert.ok(f.condiciones_clave.some((c) => /15 días naturales/.test(c)));
  assert.ok(f.partes?.includes("Asegurado: Juan Pérez Ejemplo"));
});

test("contrato de renta: renta, depósito, vigencia y sin número de referencia (no especificado)", () => {
  const f = extraerFicha(renta.paginas);
  assert.equal(f.montos["Renta mensual"], 9500);
  assert.equal(f.fecha_vencimiento, "2027-02-28");
  assert.equal(f.numero_referencia, null);
  assert.ok(f.campos_no_especificados.includes("numero_referencia"));
});

test("garantía: calcula el vencimiento desde la fecha de compra y lo indica", () => {
  const f = extraerFicha(garantia.paginas);
  assert.equal(f.fecha_vencimiento, "2027-06-15");
  assert.ok(f.condiciones_clave[0].includes("calculado"));
  assert.equal(f.numero_referencia, "•••• 8877");
});

test("documento sin datos: todo queda como no especificado", () => {
  const f = extraerFicha([{ pagina: 1, contenido: "Lista del súper: leche, pan y huevos." }]);
  assert.equal(f.fecha_vencimiento, null);
  assert.equal(f.campos_no_especificados.length, 7);
});

test("enmascara cuentas, tarjetas, CURP y RFC pero no teléfonos", () => {
  const t = enmascarar("Tarjeta 4152 3138 1234 5678, CLABE 012180015874968530, CURP TOAR920115HDFRBD09, RFC TOAR920115932, llama al 55 1234 5678");
  assert.ok(!t.includes("4152"));
  assert.ok(t.includes("•••• 5678"));
  assert.ok(t.includes("•••• 8530"));
  assert.ok(!t.includes("TOAR920115"));
  assert.ok(t.includes("55 1234 5678"));
});

async function pregunta(p: string) {
  let r = "";
  for await (const parte of preguntar(repoMemoria(), p)) r += parte;
  return r;
}

test("responde cuándo vence el seguro, con el documento y la página", async () => {
  const r = await pregunta("¿Cuándo vence mi seguro?");
  assert.match(r.split("\n")[0], /\*\*10 de enero de 2027\*\*/);
  assert.match(r, /\/documentos\/demo-1\?pagina=1/);
});

test("responde cuánto pago de renta", async () => {
  const r = await pregunta("¿Cuánto pago de renta?");
  assert.match(r, /Renta mensual: \$9,500\.00/);
  assert.match(r, /Contrato de renta departamento\.pdf/);
});

test("responde el teléfono para reportar un choque", async () => {
  const r = await pregunta("¿A qué teléfono llamo si choco con el carro?");
  assert.match(r, /800 123 4567/);
});

test("si no está en los documentos, lo dice y sugiere qué subir", async () => {
  const r = await pregunta("¿Cuándo vence mi pasaporte?");
  assert.match(r, /No encontré eso en tus documentos/);
  assert.match(r, /documento de identidad/);
});

test("con dos pólizas de auto distintas, muestra ambas y pregunta cuál", () => {
  const base = (id: string, fecha: string): Documento => ({
    id, nombre: `Póliza ${id}.pdf`, ruta_storage: null, tipo_archivo: null, categoria: "Seguros", tipo_documento: "Póliza de seguro de auto",
    estado_procesamiento: "listo", error_procesamiento: null, created_at: "",
    ficha: { partes: null, numero_referencia: null, fecha_inicio: null, fecha_vencimiento: fecha, montos: {}, condiciones_clave: [], contacto: null, campos_no_especificados: [] },
  });
  const docs = [base("a", "2027-01-10"), base("b", "2026-11-01")];
  const r = responder({
    pregunta: "¿Cuándo vence el seguro del auto?",
    fragmentos: docs.map((d) => ({ tipo: "documento" as const, documento_id: d.id, nota_id: null, pagina: null, contenido: d.nombre, rango: 1 })),
    documentos: docs, paginas: {}, notas: [], todos: docs, hoy: "2026-10-22",
  });
  assert.match(r.texto, /¿Cuál de ellos\?/);
  assert.match(r.texto, /10 de enero de 2027/);
  assert.match(r.texto, /1 de noviembre de 2026/);
});

test("avisa a 30 y a 7 días sin repetir", () => {
  const doc = { id: "x", ficha: { fecha_vencimiento: "2026-11-15" }, avisos_enviados: [] } as unknown as Documento;
  assert.equal(avisosPendientes([doc], "2026-10-22")[0].clave, "30:2026-11-15");
  doc.avisos_enviados = ["30:2026-11-15"];
  assert.equal(avisosPendientes([doc], "2026-10-25").length, 0);
  assert.equal(avisosPendientes([doc], "2026-11-09")[0].clave, "7:2026-11-15");
});

test("¿Qué me falta? sugiere la tarjeta de circulación si hay póliza de auto", async () => {
  const docs = await repoMemoria().documentos();
  const s = queMeFalta(docs).map((x) => x.documento);
  assert.ok(s.includes("Tarjeta de circulación"));
  assert.ok(s.includes("INE"));
});
