// Mis documentos: detecta lo que ya subiste, respeta tus marcas y avisa de los básicos que faltan (datos inventados)
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluar, resumen, TODOS } from "../lib/mis-documentos";
import { proximoDia, respuestaTarjetas } from "../lib/tarjetas-administrador";
import type { Documento } from "../lib/tipos";

const doc = (id: string, nombre: string, tipo: string) => ({ id, nombre, tipo_documento: tipo }) as unknown as Documento;

test("las claves no se repiten y todo básico tiene guía con liga oficial", () => {
  assert.equal(new Set(TODOS.map((i) => i.clave)).size, TODOS.length);
  for (const i of TODOS.filter((x) => x.basico)) assert.ok(i.guia?.enlace?.url.startsWith("https://"), i.clave);
});

test("lo subido queda listo; tus marcas cuentan; no aplica no cuenta", () => {
  const secciones = evaluar([doc("1", "INE Juan.pdf", "INE"), doc("2", "Recibo CFE.pdf", "Recibo de luz")], [], { curp: "tengo", pasaporte: "no_aplica", acta_nacimiento: "no_tengo" });
  const item = (c: string) => secciones.flatMap((s) => s.items).find((i) => i.clave === c)!;
  assert.equal(item("ine").estado, "listo");
  assert.equal(item("ine").documento?.id, "1");
  assert.equal(item("domicilio").estado, "listo");
  assert.equal(item("curp").estado, "tengo");
  assert.equal(item("pasaporte").estado, "no_aplica");
  assert.equal(item("acta_nacimiento").estado, "no_tengo");
  const r = resumen(secciones);
  assert.equal(r.total, TODOS.length - 1);
  assert.equal(r.listos, 3);
  assert.deepEqual(r.basicosFaltan.map((i) => i.clave), ["acta_nacimiento", "csf"]);
});

test("próximo día de corte, también en meses cortos", () => {
  assert.equal(proximoDia(20, "2026-10-30"), "2026-11-20");
  assert.equal(proximoDia(31, "2026-11-05"), "2026-11-30");
  assert.equal(proximoDia(5, "2026-12-10"), "2027-01-05");
  assert.equal(proximoDia(30, "2026-10-30"), "2026-10-30");
});

test("Tao responde el corte de una tarjeta de Administrador Tao, o pregunta cuál", () => {
  const tarjetas = [{ nombre: "Plata", dia_corte: 20, dia_limite_pago: 10 }, { nombre: "Nu", dia_corte: 12, dia_limite_pago: 2 }];
  assert.match(respuestaTarjetas("oye cuándo corta mi tarjeta plata", tarjetas, "2026-10-30")!, /Plata\*\* corta el día \*\*20/);
  assert.match(respuestaTarjetas("¿cuándo cortan mis tarjetas?", tarjetas, "2026-10-30")!, /\[\[opciones: ¿Cuándo corta mi Plata\?/);
  assert.equal(respuestaTarjetas("¿cuándo vence mi INE?", tarjetas, "2026-10-30"), null);
  assert.equal(respuestaTarjetas("¿cuándo corta mi Plata?", [], "2026-10-30"), null);
});
