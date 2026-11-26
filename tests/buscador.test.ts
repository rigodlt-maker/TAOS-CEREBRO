// Buscador 🔍: lo que escribe la gente → la pantalla correcta
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { buscarDestinos } from "../components/taos/buscador";
import { DESTINOS } from "../lib/destinos";

const primero = (q: string) => buscarDestinos(q, DESTINOS)[0]?.ruta;

test("lleva a la pantalla correcta (también mal escrito)", () => {
  assert.equal(primero("subir ine"), "/subir");
  assert.equal(primero("que vence"), "/indice");
  assert.equal(primero("drive"), "/cuenta/drive");
  assert.equal(primero("notas"), "/notas");
  assert.equal(primero("bibloteca"), "/biblioteca");
  assert.equal(primero("que documentos me faltan"), "/mis-documentos");
  assert.deepEqual(buscarDestinos("zzzz", DESTINOS), []);
});

test("cada pantalla existe y no se repite", () => {
  const rutas = DESTINOS.map((d) => d.ruta);
  assert.equal(new Set(rutas).size, rutas.length);
  for (const r of rutas) assert.ok(existsSync(`app/(app)${r.split("#")[0] === "/" ? "" : r.split("#")[0]}/page.tsx`), r);
});
