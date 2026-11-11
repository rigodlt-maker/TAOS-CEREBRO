// S18 · Topes del lector de archivos (se revisan ANTES de crear el dibujo)
import assert from "node:assert/strict";
import { test } from "node:test";
import { escalaSegura, MAX_LADO, MAX_PIXELES } from "../components/leer-archivo";

const cabe = (w: number, h: number) => {
  const e = escalaSegura(w, h);
  if (e === null) return null;
  const [a, b] = [Math.floor(w * e), Math.floor(h * e)];
  return { a, b, area: a * b };
};

test("S18-R1: una página de 100,000 × 100,000 no pasa de 8 MP ni de 4096 por lado (o se omite)", () => {
  const r = cabe(100_000, 100_000);
  assert.ok(r === null || (r.area <= MAX_PIXELES && r.a <= MAX_LADO && r.b <= MAX_LADO));
  assert.equal(escalaSegura(100_000, 100_000), null); // para caber habría que achicarla a menos de 0.25: se omite
});

test("S18-R1: tiras angostas y larguísimas respetan el lado máximo", () => {
  for (const [w, h] of [[200, 60_000], [60_000, 200], [10, 20_000], [612, 792], [2000, 3000]]) {
    const r = cabe(w, h);
    if (r) assert.ok(r.area <= MAX_PIXELES && r.a <= MAX_LADO && r.b <= MAX_LADO, `${w}×${h}`);
  }
});

test("S18: medidas inválidas no se dibujan; una hoja carta normal sí, a escala 2", () => {
  for (const [w, h] of [[0, 100], [NaN, 100], [Infinity, 100], [-5, 100]]) assert.equal(escalaSegura(w, h), null);
  assert.equal(escalaSegura(612, 792), 2);
});

test("S18-T: un TXT de 450,000 letras se marca como lectura parcial y se guarda en páginas, sin cortar cada una", async () => {
  const { partirTexto, MAX_TEXTO_TOTAL, MAX_TEXTO_PAGINA } = await import("../components/leer-archivo");
  const texto = "a".repeat(450_000);
  const l = partirTexto(texto, "Solo se leyó el principio.");
  assert.equal(l.parcial, true);
  assert.match(l.motivo ?? "", /principio/);
  assert.equal(l.paginas.reduce((n, p) => n + p.contenido.length, 0), MAX_TEXTO_TOTAL);
  assert.ok(l.paginas.every((p) => p.contenido.length <= MAX_TEXTO_PAGINA));
  // Uno que sí cabe completo NO dice parcial, y conserva todo el texto
  const chico = partirTexto("b".repeat(45_000), "x");
  assert.equal(chico.parcial, false);
  assert.equal(chico.motivo, null);
  assert.equal(chico.paginas.map((p) => p.contenido).join("").length, 45_000);
});

test("S18-T: el servidor tampoco recorta en silencio: una página de 45,000 letras se guarda completa en trozos", async () => {
  const { repoMemoria } = await import("../lib/datos/memoria");
  const { procesarTexto, recortarPaginas, TOPES } = await import("../lib/procesar");
  (globalThis as { __cerebroDemo?: unknown }).__cerebroDemo = undefined;
  const repo = repoMemoria();
  for (const d of await repo.documentos()) await repo.borrarDocumento(d.id);
  const largo = "CONTRATO DE ARRENDAMIENTO. " + "cláusula ".repeat(5_000); // ~45,000 letras en una sola página
  const id = await repo.crearDocumento({ nombre: "contrato.txt", ruta_storage: null, tipo_archivo: "text/plain" });
  const r = await procesarTexto(repo, id, "contrato.txt", [{ pagina: 1, contenido: largo }]);
  assert.equal(r.ok, true);
  assert.equal(r.parcial, null);
  assert.equal((await repo.documentos())[0].error_procesamiento, null);
  // Lo que de verdad no cabe se dice
  const enorme = recortarPaginas([{ pagina: 1, contenido: "x".repeat(TOPES.total + 10) }]);
  assert.equal(enorme.motivos.length, 1);
  const r2 = await procesarTexto(repo, id, "contrato.txt", [{ pagina: 1, contenido: "x ".repeat(TOPES.total) }]);
  assert.match(r2.parcial ?? "", /muy largo/);
  assert.match((await repo.documentos())[0].error_procesamiento ?? "", /^Lectura parcial/);
  // Lo que ya venía parcial del celular se conserva junto al aviso
  const r3 = await procesarTexto(repo, id, "contrato.txt", [{ pagina: 1, contenido: largo }], "Solo se leyó el principio de este archivo de texto (es muy grande).");
  assert.match(r3.parcial ?? "", /principio/);
});
