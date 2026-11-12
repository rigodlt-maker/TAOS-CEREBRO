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

// Ronda 3 de Codex: respuesta NEGATIVA tras revisar un documento parcial
test("S18 (ronda 3): «¿Cuál es mi RFC?» sin encontrarlo, con la constancia leída a medias: Tao advierte en la respuesta y en el historial", async () => {
  const { repoMemoria } = await import("../lib/datos/memoria");
  const { procesarTexto } = await import("../lib/procesar");
  (globalThis as { __cerebroDemo?: unknown }).__cerebroDemo = undefined;
  const repo = repoMemoria();
  for (const d of await repo.documentos()) await repo.borrarDocumento(d.id);
  const id = await repo.crearDocumento({ nombre: "Constancia de situacion fiscal.txt", ruta_storage: null, tipo_archivo: "text/plain" });
  await procesarTexto(repo, id, "Constancia de situacion fiscal.txt", [{ pagina: 1, contenido: "CONSTANCIA DE SITUACIÓN FISCAL. Servicio de Administración Tributaria. Datos de identificación del contribuyente:" }], "Solo se leyó el principio; falta el final que contiene el RFC.");
  assert.match((await repo.documentos())[0].error_procesamiento ?? "", /^Lectura parcial/);
  const r = await preguntarA(repo, "¿Cuál es mi RFC?");
  assert.match(r, /No encontré/);
  assert.match(r, /⚠️ Ojo: \[Constancia de situacion fiscal\.txt\]\(\/documentos\/[\w-]+\) se leyó incompleto: lo que buscas podría estar en la parte que no se leyó/);
  assert.match((await repo.preguntas())[0].respuesta, /se leyó incompleto/);
});

test("S18 (ronda 3): negativo también en preguntas generales y en la búsqueda, con un documento parcial", async () => {
  const { repo } = await repoCon("Solo se leyeron las primeras páginas; falta el final con el vencimiento.");
  for (const p of ["pásame mi pasaporte", "¿cuál es el número de póliza del seguro del coche?"]) {
    const r = await preguntarA(repo, p);
    assert.match(r, /se leyó incompleto/, p);
  }
});

test("S18 (ronda 3): sin documentos parciales, una respuesta negativa no lleva aviso", async () => {
  const { repo } = await repoCon(null);
  const r = await preguntarA(repo, "¿Cuál es mi RFC?");
  assert.doesNotMatch(r, /incompleto/);
});
