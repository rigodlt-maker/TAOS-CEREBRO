// Tao contra una base Postgres real (PGlite, misma búsqueda en español que Supabase) con documentos de ejemplo inventados
import assert from "node:assert/strict";
import { before, test } from "node:test";
import type { Repo } from "../lib/datos/repo";
import { preguntar } from "../lib/preguntar";
import { repoDePrueba } from "./fixtures/repo-pglite";

let repo: Repo;
before(async () => {
  repo = await repoDePrueba();
});

async function r(p: string) {
  let t = "";
  for await (const x of preguntar(repo, p)) t += x;
  return t;
}

const CASOS: [string, RegExp][] = [
  ["¿Cuándo vence mi seguro del auto?", /15 de marzo de 2027[\s\S]*Poliza seguro auto/],
  ["¿cuándo vence mi seguro de gastos médicos?", /1 de junio de 2027[\s\S]*gastos medicos/],
  ["¿A qué teléfono llamo si choco?", /800 800 2880/],
  ["numero de la aseguradora", /800 800 2880/],
  ["¿cuál es el deducible de mi seguro de auto?", /deducible 5%[\s\S]*deducible 10%/],
  ["¿cuál es el deducible de gastos médicos?", /\$25,000\.00/],
  ["teléfono de GNP", /55 5227 9000/],
  ["¿cuánto pago de renta?", /\$9,500\.00/],
  ["¿cuándo se termina mi contrato de renta?", /31 de julio de 2027/],
  ["¿quién es el arrendador?", /Arrendador: Carlos Ramírez Ejemplo/],
  ["¿puedo tener mascotas?", /Se permiten mascotas/],
  ["¿qué pasa si me salgo antes del depa?", /penalización/],
  ["¿cuál es mi clave de elector?", /PREXJN90010109H100/],
  ["¿cuándo vence mi INE?", /31 de diciembre de 2034/],
  ["¿cuándo vence mi licencia?", /10 de febrero de 2027/],
  ["¿qué tipo de sangre tengo?", /O\+/],
  ["¿cuánto debo de luz?", /Total a pagar: \$1,236/],
  ["¿cuándo tengo que pagar la luz?", /30 de septiembre de 2026/],
  ["¿cuántos kWh gasté?", /450 kWh/],
  ["¿hasta cuándo tiene garantía el refri?", /20 de abril de 2028/],
  ["¿qué régimen fiscal tengo?", /Sueldos y Salarios/],
  ["¿qué medicina me recetaron?", /Omeprazol/],
  ["¿cuándo es mi próxima cita con el doctor?", /12\/11\/2026/],
  ["¿cuánto tengo que pagar de la tarjeta para no generar intereses?", /\$7,845\.20/],
  ["¿cuándo es la fecha límite de pago de mi tarjeta?", /8 de octubre de 2026/],
  ["¿cuál es mi límite de crédito?", /\$60,000\.00/],
  ["¿cuál es la placa de mi carro?", /XYZ-123-A/],
  ["¿número de serie del versa?", /3N1CN8AE0NL000001/],
  ["¿cuándo vence la tarjeta de circulación?", /31 de diciembre de 2027/],
  ["¿qué tengo del carro?", /Vehículos\*\* \(3\)/],
  ["¿qué documentos de salud tengo?", /Salud\*\* \(2\)[\s\S]*Receta/],
  ["¿dónde está mi licencia?", /^Aquí está: \[Licencia de conducir/],
  ["¿cuál es la contraseña del wifi?", /^> La contraseña del wifi está en el router\./],
];

for (const [p, esperado] of CASOS) test(`Tao responde: "${p}"`, async () => assert.match(await r(p), esperado));

test("volver a leer rellena lo que faltaba sin tocar lo que ya tenía la ficha", async () => {
  const { releer } = await import("../lib/releer");
  const doc = (await repo.documentos()).find((d) => d.nombre.startsWith("Licencia"))!;
  const paginas = (await repo.paginasDe([doc.id]))[doc.id];
  // Ficha vieja: sin vencimiento y con un teléfono que tú escribiste
  const viejo = { ...doc, ficha: { ...doc.ficha!, fecha_vencimiento: null, contacto: "55 0000 0000" } };
  const cambio = releer(viejo, paginas)!;
  assert.equal(cambio.ficha.fecha_vencimiento, "2027-02-10");
  assert.equal(cambio.ficha.contacto, "55 0000 0000");
  assert.equal(releer(doc, paginas), null);
});
