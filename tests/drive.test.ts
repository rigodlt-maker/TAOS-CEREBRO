// Sincronización con la carpeta de Google Drive
import assert from "node:assert/strict";
import { test } from "node:test";
import { repoMemoria } from "../lib/datos/memoria";
import { categoriaDe, guardarContenido, nombreVisible, paginar, sincronizarLista, type ArchivoDrive } from "../lib/drive";

const archivo = (id: string, nombre: string, actualizado = "2026-10-27T19:00:00Z"): ArchivoDrive => ({
  id, nombre, mime: "application/pdf", actualizado, url: `https://drive.google.com/file/d/${id}/view`, carpeta: "",
});

test("la categoría sale del prefijo del nombre (o de la subcarpeta)", () => {
  assert.equal(categoriaDe("IDENTIDAD - Constancia de situacion fiscal (RFC) oct-2026.pdf"), "Identidad y trámites");
  assert.equal(categoriaDe("SEGUROS - Poliza auto Versa.pdf"), "Seguros");
  assert.equal(categoriaDe("AUTO - Versa servicio Nissan jul-2026 y verificación.pdf"), "Vehículos");
  assert.equal(categoriaDe("SALUD - Informe medico 2021.pdf"), "Salud");
  assert.equal(categoriaDe("FINANZAS - Precalificacion credito.pdf"), "Finanzas e impuestos");
  assert.equal(categoriaDe("Contrato.pdf", "Contratos"), "Contratos");
  assert.equal(categoriaDe("Contrato de renta.pdf"), null);
  assert.equal(nombreVisible("SEGUROS - Poliza auto Versa.pdf"), "Poliza auto Versa.pdf");
});

test("parte el texto en páginas", () => {
  const p = paginar("a".repeat(7000));
  assert.equal(p.length, 3);
  assert.equal(paginar("uno\fdos")[1].contenido, "dos");
});

async function nuevoRepo() {
  (globalThis as { __cerebroDemo?: unknown }).__cerebroDemo = undefined;
  const repo = repoMemoria();
  for (const d of await repo.documentos()) await repo.borrarDocumento(d.id);
  return repo;
}

test("archivo nuevo → se lee, con la categoría de su prefijo y enlace a Drive", async () => {
  const repo = await nuevoRepo();
  const a = archivo("d1", "SEGUROS - Poliza auto Versa.pdf");
  const r = await sincronizarLista(repo, [a]);
  assert.deepEqual(r.pedir, ["d1"]);
  await guardarContenido(repo, { ...a, texto: "PÓLIZA DE SEGURO DE AUTOMÓVIL. Vigencia del 10/01/2026 al 10/01/2027. Prima total $8,500.00" });
  const [doc] = await repo.documentos();
  assert.equal(doc.nombre, "Poliza auto Versa.pdf");
  assert.equal(doc.categoria, "Seguros");
  assert.equal(doc.estado_procesamiento, "listo");
  assert.equal(await repo.enlaceExterno(doc.id), a.url);
  // Sin cambios: no se vuelve a leer
  assert.deepEqual((await sincronizarLista(repo, [a])).pedir, []);
});

test("una versión nueva del archivo se vuelve a leer; si lo borras de Drive, se quita de la app", async () => {
  const repo = await nuevoRepo();
  const a = archivo("d2", "IDENTIDAD - Constancia de situacion fiscal (RFC).pdf", "2026-09-01T10:00:00Z");
  await guardarContenido(repo, { ...a, texto: "CONSTANCIA DE SITUACIÓN FISCAL. Lugar y fecha de emisión 01 de septiembre de 2026" });
  const nueva = { ...a, actualizado: "2026-10-27T19:00:24Z" };
  assert.deepEqual((await sincronizarLista(repo, [nueva])).pedir, ["d2"]);
  const otra = archivo("d3", "SALUD - Informe medico 2021.pdf");
  const r = await sincronizarLista(repo, [otra]);
  assert.equal(r.borrados, 1);
  assert.equal((await repo.documentos()).length, 0);
});

test("lo que ya subiste a mano con el mismo nombre se vincula (no se duplica) y se corrige su categoría", async () => {
  const repo = await nuevoRepo();
  const id = await repo.crearDocumento({ nombre: "IDENTIDAD - CURP.pdf", ruta_storage: "u/curp.pdf", tipo_archivo: "application/pdf" });
  const a = archivo("d4", "IDENTIDAD - CURP.pdf");
  const r = await sincronizarLista(repo, [a]);
  assert.equal(r.vinculados, 1);
  await guardarContenido(repo, { ...a, texto: "CLAVE ÚNICA DE REGISTRO DE POBLACIÓN" });
  const docs = await repo.documentos();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, id);
  assert.equal(docs[0].categoria, "Identidad y trámites");
});

test("una carpeta vacía no borra nada", async () => {
  const repo = await nuevoRepo();
  await guardarContenido(repo, { ...archivo("d5", "SALUD - Vacuna.pdf"), texto: "Comprobante de vacunación" });
  const plan = await sincronizarLista(repo, [archivo("d5", "SALUD - Vacuna.pdf")]);
  assert.equal(plan.borrados, 0);
  assert.equal((await repo.documentos()).length, 1);
});

test("el contenido manda sobre el prefijo; sin texto, manda el prefijo; los errores se reintentan", async () => {
  const repo = await nuevoRepo();
  const constancia = archivo("d6", "IDENTIDAD - Constancia de situacion fiscal (RFC) oct-2026.pdf");
  await guardarContenido(repo, { ...constancia, texto: "CÉDULA DE IDENTIFICACIÓN FISCAL. CONSTANCIA DE SITUACIÓN FISCAL. Lugar y Fecha de Emisión CUERNAVACA, MORELOS A 27 DE OCTUBRE DE 2026" });
  const imss = archivo("d7", "SEGUROS - Constancia de vigencia IMSS.pdf");
  await guardarContenido(repo, { ...imss, texto: "", error: "Request had insufficient authentication scopes" });
  const docs = await repo.documentos();
  assert.equal(docs.find((d) => d.nombre.startsWith("Constancia de situacion"))!.categoria, "Finanzas e impuestos");
  const fallido = docs.find((d) => d.nombre.startsWith("Constancia de vigencia"))!;
  assert.equal(fallido.categoria, "Seguros");
  assert.match(fallido.error_procesamiento!, /intento 1/);
  // En la siguiente vuelta se vuelve a pedir; ya con texto se lee bien y se clasifica por contenido
  assert.deepEqual((await sincronizarLista(repo, [constancia, imss])).pedir, ["d7"]);
  await guardarContenido(repo, { ...imss, texto: "Instituto Mexicano del Seguro Social. Constancia de Vigencia de Derechos. Vigente: 15/07/2021" });
  const leido = (await repo.documentos()).find((d) => d.nombre.startsWith("Constancia de vigencia"))!;
  assert.equal(leido.categoria, "Salud");
  assert.equal(leido.tipo_documento, "Constancia de vigencia de derechos (IMSS)");
  assert.equal(leido.ficha?.fecha_vencimiento, "2021-07-15");
  assert.deepEqual((await sincronizarLista(repo, [constancia, imss])).pedir, []);
});

test("clasifica bien aunque el texto traiga datos de otros documentos", async () => {
  const { clasificar } = await import("../lib/extraer");
  assert.equal(clasificar("Estados Unidos Mexicanos Acta de Nacimiento CURP TOAR920115HGRRBD08", "escaneo1.pdf").tipo_documento, "Acta de nacimiento");
  assert.equal(clasificar("PRECA NUEVA TRADICIONAL FOVISSTE NSS 25149213701 CURP", "doc.pdf").tipo_documento, "Precalificación de crédito");
  assert.equal(clasificar("Travel Protection Póliza Individual. No cubre trámites de visa ni pasaporte.", "archivo.pdf").categoria, "Seguros");
  assert.equal(clasificar("Asignación o Localización de Número de Seguridad Social", "x.pdf").tipo_documento, "Número de Seguridad Social (NSS)");
});

test("al sincronizar, corrige la clasificación por el nombre sin volver a leer el archivo", async () => {
  const repo = await nuevoRepo();
  const acta = archivo("d8", "IDENTIDAD - Acta de nacimiento.pdf");
  await guardarContenido(repo, { ...acta, texto: "Acta de Nacimiento ... CURP" });
  const doc = (await repo.documentos())[0];
  await repo.editarDocumento(doc.id, { tipo_documento: "CURP" }); // como quedó antes del arreglo
  const r = await sincronizarLista(repo, [acta]);
  assert.deepEqual(r.pedir, []);
  assert.equal((await repo.documentos())[0].tipo_documento, "Acta de nacimiento");
});
