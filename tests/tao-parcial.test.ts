// S18 (reverificación de Codex): si Tao responde con un documento que se leyó incompleto, lo advierte siempre.
import assert from "node:assert/strict";
import test from "node:test";

async function repoCon(parcial: string | null) {
  const { repoMemoria } = await import("../lib/datos/memoria");
  const { procesarTexto } = await import("../lib/procesar");
  (globalThis as { __cerebroDemo?: unknown }).__cerebroDemo = undefined;
  const repo = repoMemoria();
  for (const d of await repo.documentos()) await repo.borrarDocumento(d.id);
  const texto = "CONTRATO DE ARRENDAMIENTO. El arrendador Juan Pérez renta al arrendatario el departamento ubicado en Calle Falsa 123. Renta mensual de $8,500.00. Vigencia del contrato y fecha de vencimiento: ";
  const id = await repo.crearDocumento({ nombre: "Contrato departamento.pdf", ruta_storage: null, tipo_archivo: "application/pdf" });
  await procesarTexto(repo, id, "Contrato departamento.pdf", [{ pagina: 1, contenido: texto }], parcial);
  return { repo, id };
}
async function preguntarA(repo: unknown, p: string) {
  const { preguntar } = await import("../lib/preguntar");
  let t = "";
  for await (const parte of preguntar(repo as never, p)) t += parte;
  return t;
}

for (const pregunta of ["¿Cuándo vence mi contrato de arrendamiento?", "¿Cuánto pago de renta del departamento?", "pásame mi contrato"]) {
  test(`S18: Tao advierte la lectura parcial · «${pregunta}»`, async () => {
    const { repo, id } = await repoCon("Solo se leyeron las primeras páginas; falta el final con el vencimiento.");
    const doc = (await repo.documentos())[0];
    assert.match(doc.error_procesamiento ?? "", /^Lectura parcial/);
    const r = await preguntarA(repo, pregunta);
    assert.match(r, /⚠️ Ojo: \[Contrato departamento\.pdf\]\(\/documentos\/[\w-]+\) se leyó incompleto/);
    assert.ok(r.includes(`/documentos/${id}`));
    // Queda también en el historial
    const hist = await repo.preguntas();
    assert.match(hist[0].respuesta, /se leyó incompleto/);
  });
}

test("S18: con el documento completo, Tao no agrega el aviso", async () => {
  const { repo } = await repoCon(null);
  const r = await preguntarA(repo, "¿Cuánto pago de renta del departamento?");
  assert.doesNotMatch(r, /incompleto/);
});
