// Sincroniza tu carpeta de Google Drive ("05 CEREBRO") con la app:
// archivo nuevo → se lee y se agrega; archivo cambiado → se vuelve a leer; archivo borrado → se quita de la app.
// La categoría sale del contenido; si la app no reconoce el documento, del prefijo del nombre ("SEGUROS - Póliza auto.pdf" → Seguros).
import type { Repo } from "./datos/repo";
import { clasificarPorNombre, plano } from "./extraer";
import { procesarTexto } from "./procesar";
import { avisoDocumentoNuevo, enviarPush } from "./push";
import type { Categoria, DocumentoDrive, Pagina } from "./tipos";

export type ArchivoDrive = { id: string; nombre: string; mime: string; actualizado: string; url: string; carpeta?: string };
export type ContenidoDrive = ArchivoDrive & { texto: string; error?: string };

const PREFIJOS: [RegExp, Categoria][] = [
  [/^(identidad|identificacion|tramites?|personal(es)?)$/, "Identidad y trámites"],
  [/^(seguros?|polizas?)$/, "Seguros"],
  [/^(salud|medico|medicos)$/, "Salud"],
  [/^(auto|autos|carro|coche|vehiculos?|moto)$/, "Vehículos"],
  [/^(finanzas|impuestos|sat|banco|bancos|fiscal)$/, "Finanzas e impuestos"],
  [/^(contratos?|renta|arrendamiento)$/, "Contratos"],
  [/^(hogar|casa|depa|departamento)$/, "Hogar"],
  [/^(notas?|otros?)$/, "Notas personales"],
];

const limpio = (t: string) => plano(t).replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

// "SEGUROS - Póliza auto Versa.pdf" → Seguros. También sirve el nombre de una subcarpeta ("Seguros/…")
export function categoriaDe(nombre: string, carpeta = ""): Categoria | null {
  const prefijo = nombre.match(/^\s*([A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30}?)\s*[-–—:]\s+/)?.[1];
  for (const candidato of [prefijo, ...carpeta.split("/").reverse()]) {
    if (!candidato) continue;
    const c = PREFIJOS.find(([r]) => r.test(limpio(candidato)))?.[1];
    if (c) return c;
  }
  return null;
}

// Nombre para mostrar: sin el prefijo de categoría
export function nombreVisible(nombre: string): string {
  return categoriaDe(nombre) ? nombre.replace(/^\s*[A-Za-zÁÉÍÓÚÑáéíóúñ ]{3,30}?\s*[-–—:]\s+/, "") : nombre;
}

const clave = (n: string) => limpio(nombreVisible(n).replace(/\.(pdf|jpe?g|png|heic|docx?|txt)$/i, ""));

// Si Google no pudo leerlo, se reintenta hasta 3 veces (p. ej. si faltaba un permiso)
const INTENTOS = 6;
const intentosDe = (doc: Pick<DocumentoDrive, "error_procesamiento">) => Number(doc.error_procesamiento?.match(/\(intento (\d+)\)/)?.[1] ?? (doc.error_procesamiento ? 1 : 0));
const reintentar = (doc: DocumentoDrive) => doc.estado_procesamiento === "error" && intentosDe(doc) < INTENTOS;

export type Plan = {
  pedir: string[]; // archivos de Drive que hay que leer (nuevos o cambiados)
  vincular: { doc: DocumentoDrive; archivo: ArchivoDrive }[]; // documentos que ya subiste a mano y son el mismo archivo
  borrar: DocumentoDrive[]; // vinieron de Drive y ya no están en la carpeta
  recategorizar: { doc: DocumentoDrive; archivo: ArchivoDrive }[];
};

export function planear(archivos: ArchivoDrive[], docs: DocumentoDrive[]): Plan {
  const plan: Plan = { pedir: [], vincular: [], borrar: [], recategorizar: [] };
  const porDrive = new Map(docs.filter((d) => d.drive_id).map((d) => [d.drive_id!, d]));
  const sueltos = docs.filter((d) => !d.drive_id);
  const usados = new Set<string>();
  for (const a of archivos) {
    const doc = porDrive.get(a.id);
    if (doc) {
      // Cambió en Drive (nueva versión del archivo): se vuelve a leer
      if (!doc.drive_actualizado || Date.parse(a.actualizado) > Date.parse(doc.drive_actualizado) + 1000 || reintentar(doc)) plan.pedir.push(a.id);
      else plan.recategorizar.push({ doc, archivo: a });
      continue;
    }
    // ¿Ya lo habías subido a mano con el mismo nombre? Se vincula en lugar de duplicarlo
    const mismo = sueltos.find((d) => !usados.has(d.id) && clave(d.nombre) === clave(a.nombre));
    if (mismo) {
      usados.add(mismo.id);
      plan.vincular.push({ doc: mismo, archivo: a });
      plan.pedir.push(a.id); // se vuelve a leer para corregir la categoría y la ficha
    } else plan.pedir.push(a.id);
  }
  const enDrive = new Set(archivos.map((a) => a.id));
  plan.borrar = docs.filter((d) => d.drive_id && !enDrive.has(d.drive_id));
  return plan;
}

// 1) El script manda la lista de archivos de la carpeta; la app responde cuáles necesita leer
export async function sincronizarLista(repo: Repo, archivos: ArchivoDrive[], maximo = 6) {
  const plan = planear(archivos, await repo.documentosDrive());
  for (const { doc, archivo } of plan.vincular) await repo.editarDocumento(doc.id, { drive_id: archivo.id, url_externa: archivo.url });
  // Sin volver a leerlos: si cambió el nombre en Drive, o el nombre ya dice qué es y estaba mal clasificado, se corrige
  for (const { doc, archivo } of plan.recategorizar) {
    const nombre = nombreVisible(archivo.nombre);
    const segun = clasificarPorNombre(nombre);
    const cambios = {
      ...(doc.nombre !== nombre ? { nombre, url_externa: archivo.url } : {}),
      ...(segun && doc.estado_procesamiento === "listo" && (doc.tipo_documento !== segun.tipo_documento || doc.categoria !== segun.categoria) ? segun : {}),
    };
    if (Object.keys(cambios).length) await repo.editarDocumento(doc.id, cambios);
  }
  for (const doc of plan.borrar) await repo.borrarDocumento(doc.id);
  return { pedir: plan.pedir.slice(0, maximo), pendientes: plan.pedir.length, vinculados: plan.vincular.length, borrados: plan.borrar.length };
}

// El texto de Drive no trae páginas: se parte en trozos de ~3,000 caracteres
export function paginar(texto: string, tamano = 3000): Pagina[] {
  const paginas: Pagina[] = [];
  const limpio = texto.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  // Si Google marcó saltos de página (\f), se respetan
  const bloques = limpio.includes("\f") ? limpio.split("\f") : [limpio];
  for (const bloque of bloques) {
    for (let i = 0; i < bloque.length; i += tamano) {
      let fin = Math.min(bloque.length, i + tamano);
      const espacio = bloque.lastIndexOf("\n", fin);
      if (fin < bloque.length && espacio > i + tamano / 2) fin = espacio;
      paginas.push({ pagina: paginas.length + 1, contenido: bloque.slice(i, fin).trim() });
      i = fin - tamano;
    }
  }
  return paginas.filter((p) => p.contenido);
}

// 2) El script manda el texto de un archivo (Google lo lee, incluso si es escaneado)
export async function guardarContenido(repo: Repo, a: ContenidoDrive): Promise<string> {
  const docs = await repo.documentosDrive();
  let doc = docs.find((d) => d.drive_id === a.id);
  const nombre = nombreVisible(a.nombre);
  // Nuevo: no existía, o la vez anterior Google no lo pudo leer
  const nuevo = !doc || doc.estado_procesamiento === "error";
  const id = doc?.id ?? (await repo.crearDocumento({ nombre, ruta_storage: null, tipo_archivo: a.mime || null }));
  await repo.editarDocumento(id, { drive_id: a.id, url_externa: a.url, nombre: doc?.ruta_storage ? doc.nombre : nombre });
  doc = undefined;
  const categoria = categoriaDe(a.nombre, a.carpeta);
  let mensaje: string;
  // Si la app reconoce el documento por su contenido, esa categoría manda; si no, la del prefijo del nombre
  let reconocido = false;
  if (a.texto?.trim()) {
    const r = await procesarTexto(repo, id, nombre, paginar(a.texto));
    mensaje = r.mensaje;
    reconocido = r.ok && !!r.tipo && r.tipo !== "Documento";
    // Aviso en el celular solo la primera vez que se lee un documento nuevo de Drive
    if (nuevo && r.ok) await enviarPush(repo, avisoDocumentoNuevo(id, nombre, r.tipo));
  } else {
    const previo = docs.find((d) => d.id === id);
    const intento = previo?.estado_procesamiento === "error" ? intentosDe(previo) + 1 : 1;
    await repo.marcarError(id, `Google no pudo leer el texto${a.error ? `: ${a.error.slice(0, 120)}` : ""}. Ábrelo en Drive. (intento ${intento})`);
    mensaje = "sin texto";
  }
  // El prefijo del nombre manda sobre la clasificación automática; y se marca la versión de Drive ya leída
  await repo.editarDocumento(id, { ...(categoria && !reconocido ? { categoria } : {}), drive_actualizado: a.actualizado });
  return `${nombre}: ${mensaje}`;
}
