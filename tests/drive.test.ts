// Sincronización con la carpeta de Google Drive
import assert from "node:assert/strict";
import { test } from "node:test";
import { repoMemoria } from "../lib/datos/memoria";
import { procesarTexto } from "../lib/procesar";
import { categoriaDe, guardarContenido, mismoContenido, nombreVisible, paginar, posiblesIguales, sincronizarLista, unirDocumentos, type ArchivoDrive } from "../lib/drive";

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

test("S11: lo que ya subiste a mano con el mismo nombre y contenido NO se une solo: se sugiere y tú lo unes", async () => {
  const repo = await nuevoRepo();
  const texto = "CLAVE ÚNICA DE REGISTRO DE POBLACIÓN. Nombre JUAN PEREZ LOPEZ. Entidad de registro JALISCO. Fecha de inscripción 1999";
  const id = await repo.crearDocumento({ nombre: "IDENTIDAD - CURP.pdf", ruta_storage: "u/curp.pdf", tipo_archivo: "application/pdf" });
  await procesarTexto(repo, id, "IDENTIDAD - CURP.pdf", [{ pagina: 1, contenido: texto }]);
  const a = archivo("d4", "IDENTIDAD - CURP.pdf");
  const r = await sincronizarLista(repo, [a]);
  assert.equal(r.vinculados, 0); // el contador dice lo que de verdad se unió
  assert.equal(r.parecidos, 1);
  await guardarContenido(repo, { ...a, texto });
  assert.equal((await repo.documentos()).length, 2);
  const [deDrive] = await posiblesIguales(repo, id);
  assert.ok(deDrive?.drive_id);
  await unirDocumentos(repo, id, deDrive.id);
  const docs = await repo.documentos();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, id);
  assert.equal((await repo.documentosDrive())[0].drive_id, "d4");
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

test("S07: una lista incompleta nunca borra; muchas bajas de golpe se pausan; lo subido a mano solo se desvincula", async () => {
  const repo = await nuevoRepo();
  const a = archivo("s7a", "Uno.pdf"), b = archivo("s7b", "Dos.pdf");
  await guardarContenido(repo, { ...a, texto: "Documento uno" });
  await guardarContenido(repo, { ...b, texto: "Documento dos" });
  // Lista incompleta [a]: b se queda
  const r = await sincronizarLista(repo, [a], 6, false);
  assert.equal(r.borrados, 0);
  assert.equal(r.bajasPausadas, 1);
  assert.equal((await repo.documentos()).length, 2);
  // Faltan 4 de 5 de golpe: se pausan
  for (const n of ["c", "d", "e"]) await guardarContenido(repo, { ...archivo(`s7${n}`, `${n}.pdf`), texto: "x" });
  const masivo = await sincronizarLista(repo, [a]);
  assert.equal(masivo.borrados, 0);
  assert.equal(masivo.bajasPausadas, 4);
  assert.equal((await repo.documentos()).length, 5);
  // Uno subido a mano y vinculado: al quitarlo de Drive se desvincula, no se borra
  const id = await repo.crearDocumento({ nombre: "INE.pdf", ruta_storage: "u/ine.pdf", tipo_archivo: "application/pdf" });
  const textoIne = "INSTITUTO NACIONAL ELECTORAL credencial para votar nombre MARIA LOPEZ GARCIA domicilio GUADALAJARA";
  await procesarTexto(repo, id, "INE.pdf", [{ pagina: 1, contenido: textoIne }]);
  const ine = archivo("s7i", "INE.pdf");
  const todos = ["a", "b", "c", "d", "e"].map((n) => archivo(`s7${n}`, n === "a" ? "Uno.pdf" : n === "b" ? "Dos.pdf" : `${n}.pdf`));
  await sincronizarLista(repo, [...todos, ine]);
  await guardarContenido(repo, { ...ine, texto: textoIne });
  const [copia] = await posiblesIguales(repo, id);
  await unirDocumentos(repo, id, copia.id);
  const fin = await sincronizarLista(repo, todos);
  assert.equal(fin.borrados, 1);
  assert.ok((await repo.documentos()).some((d) => d.id === id));
});

test("S11: dos INE.pdf con contenido distinto no se unen: quedan dos documentos y el tuyo no cambia", async () => {
  const repo = await nuevoRepo();
  const id = await repo.crearDocumento({ nombre: "INE.pdf", ruta_storage: "u/ine.pdf", tipo_archivo: "application/pdf" });
  await procesarTexto(repo, id, "INE.pdf", [{ pagina: 1, contenido: "INSTITUTO NACIONAL ELECTORAL credencial para votar nombre MARIA LOPEZ GARCIA domicilio GUADALAJARA" }]);
  const b = archivo("ineB", "INE.pdf");
  await sincronizarLista(repo, [b]);
  await guardarContenido(repo, { ...b, texto: "INSTITUTO NACIONAL ELECTORAL credencial para votar nombre PEDRO RAMIREZ SOTO domicilio MONTERREY NUEVO LEON seccion 1234" });
  const docs = await repo.documentos();
  assert.equal(docs.length, 2);
  assert.equal((await repo.documentosDrive()).find((d) => d.id === id)?.drive_id ?? null, null);
});

// Contraejemplos de Codex: misma cabecera, distinta persona; y OCR parcial sin números
const CABECERA = "instituto nacional electoral credencial ciudadano domicilio estado municipio seccion registro nacimiento vigencia documento identidad mexicano";
test("S11-R1/R2/R3: ni la misma cabecera con otro folio ni un OCR parcial unen documentos (aunque se parezcan)", async () => {
  const repo = await nuevoRepo();
  const ta = `${CABECERA} Juan Perez 2020 2030 1990 1234 5678 1111`;
  const tb = `${CABECERA} Ana Lopez 2020 2030 1990 1234 5678 9999`;
  assert.equal(mismoContenido(ta, tb), true); // se PARECEN (por eso solo se sugiere)
  const id = await repo.crearDocumento({ nombre: "INE.pdf", ruta_storage: "u/ine.pdf", tipo_archivo: "application/pdf" });
  await procesarTexto(repo, id, "INE.pdf", [{ pagina: 1, contenido: ta }]);
  const fichaAntes = (await repo.documento(id))!.ficha;
  const lista: ArchivoDrive[] = [];
  for (const [n, texto] of [["r1", tb], ["r2", CABECERA]] as const) {
    const f = archivo(n, "INE.pdf");
    lista.push(f);
    await sincronizarLista(repo, lista);
    await guardarContenido(repo, { ...f, texto });
  }
  assert.equal((await repo.documentos()).length, 3);
  const manual = (await repo.documentosDrive()).find((d) => d.id === id)!;
  assert.equal(manual.drive_id, null); // R1: sin nuevo drive_id
  assert.deepEqual((await repo.documento(id))!.ficha, fichaAntes); // ni ficha reemplazada
});

test("S11-R5: si no los unes, la sincronización no insiste por detrás", async () => {
  const repo = await nuevoRepo();
  const texto = `${CABECERA} Juan Perez 2020 2030`;
  const id = await repo.crearDocumento({ nombre: "INE.pdf", ruta_storage: "u/ine.pdf", tipo_archivo: "application/pdf" });
  await procesarTexto(repo, id, "INE.pdf", [{ pagina: 1, contenido: texto }]);
  const f = archivo("r5", "INE.pdf");
  for (let i = 0; i < 3; i++) {
    await sincronizarLista(repo, [f]);
    await guardarContenido(repo, { ...f, texto, actualizado: `2026-10-2${7 + i}T19:00:00Z` });
  }
  assert.equal((await repo.documentosDrive()).find((d) => d.id === id)!.drive_id, null);
  assert.equal((await repo.documentos()).length, 2);
});

test("unir solo junta uno subido a mano con uno de Drive (no dos de Drive ni dos a mano)", async () => {
  const repo = await nuevoRepo();
  const a = await repo.crearDocumento({ nombre: "X.pdf", ruta_storage: "u/x.pdf", tipo_archivo: "application/pdf" });
  const b = await repo.crearDocumento({ nombre: "X.pdf", ruta_storage: "u/x2.pdf", tipo_archivo: "application/pdf" });
  await assert.rejects(unirDocumentos(repo, a, b));
});

// Repo que se comporta como Postgres con el índice único (user_id, drive_id) y deja hacer fallar un paso
function conFallas(repo: Awaited<ReturnType<typeof nuevoRepo>>) {
  const fallar = { editarManual: false, editarCopia: false, borrar: false };
  let manualId = "";
  const r = {
    ...repo,
    async editarDocumento(id: string, datos: Parameters<typeof repo.editarDocumento>[1]) {
      if (fallar.editarManual && id === manualId) throw new Error("se cayó la base");
      if (fallar.editarCopia && id !== manualId) throw new Error("se cayó la base");
      if (datos.drive_id && (await repo.documentosDrive()).some((d) => d.id !== id && d.drive_id === datos.drive_id)) throw new Error("duplicate key documents_drive_id");
      return repo.editarDocumento(id, datos);
    },
    async borrarDocumento(id: string) {
      if (fallar.borrar) throw new Error("se cayó la base");
      return repo.borrarDocumento(id);
    },
  };
  return { r, fallar, fijar: (id: string) => (manualId = id) };
}

async function dosParaUnir() {
  const repo = await nuevoRepo();
  const texto = "CLAVE ÚNICA DE REGISTRO DE POBLACIÓN. Nombre JUAN PEREZ LOPEZ. Entidad de registro JALISCO.";
  const id = await repo.crearDocumento({ nombre: "IDENTIDAD - CURP.pdf", ruta_storage: "u/curp.pdf", tipo_archivo: "application/pdf" });
  await procesarTexto(repo, id, "IDENTIDAD - CURP.pdf", [{ pagina: 1, contenido: texto }]);
  const a = archivo("d9", "IDENTIDAD - CURP.pdf");
  await sincronizarLista(repo, [a]);
  await guardarContenido(repo, { ...a, texto });
  const copia = (await repo.documentosDrive()).find((d) => d.drive_id === "d9")!;
  return { repo, id, copia, a };
}

test("S11-M: si falla la base al editar tu documento, NO se borra la copia de Drive y los dos quedan como estaban", async () => {
  const { repo, id, copia } = await dosParaUnir();
  const { r, fallar, fijar } = conFallas(repo);
  fijar(id);
  fallar.editarManual = true;
  await assert.rejects(unirDocumentos(r as never, id, copia.id), /No se borró nada/);
  const docs = await repo.documentosDrive();
  assert.equal(docs.length, 2);
  assert.equal(docs.find((d) => d.id === copia.id)?.drive_id, "d9"); // la copia sigue siendo la de Drive
  assert.equal(docs.find((d) => d.id === id)?.drive_id, null);
  assert.equal(await repo.enlaceExterno(copia.id), "https://drive.google.com/file/d/d9/view");
});

test("S11-M: si se cae también al deshacer, la marca queda y la siguiente sincronización lo deshace (sin duplicar ni perder)", async () => {
  const { repo, id, copia, a } = await dosParaUnir();
  const { r, fallar, fijar } = conFallas(repo);
  fijar(id);
  // Falla tu documento y luego también regresar la copia: queda apartada con la marca
  let primera = true;
  const r2 = { ...r, async editarDocumento(i: string, d: never) { if (i === copia.id && !primera) throw new Error("se cayó"); if (i === copia.id) primera = false; return r.editarDocumento(i, d); } };
  fallar.editarManual = true;
  await assert.rejects(unirDocumentos(r2 as never, id, copia.id));
  assert.match((await repo.documentosDrive()).find((d) => d.id === copia.id)!.drive_id!, /#uniendo:/);
  // La sincronización lo repara antes de comparar: no pide leer otra vez ni crea un tercer documento
  const s = await sincronizarLista(repo, [a]);
  assert.deepEqual(s.pedir, []);
  const docs = await repo.documentosDrive();
  assert.equal(docs.length, 2);
  assert.equal(docs.find((d) => d.id === copia.id)?.drive_id, "d9");
});

test("S11-M: unido y comprobado, pero falla quitar la copia: tu documento ya tiene Drive y la copia se quita en la siguiente sincronización", async () => {
  const { repo, id, copia, a } = await dosParaUnir();
  const { r, fallar, fijar } = conFallas(repo);
  fijar(id);
  fallar.borrar = true;
  await unirDocumentos(r as never, id, copia.id);
  assert.equal((await repo.documentosDrive()).find((d) => d.id === id)?.drive_id, "d9");
  const s = await sincronizarLista(repo, [a]);
  assert.deepEqual(s.pedir, []);
  const docs = await repo.documentos();
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, id);
});
