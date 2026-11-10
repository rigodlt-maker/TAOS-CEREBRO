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
