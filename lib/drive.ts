// Sincroniza tu carpeta de Google Drive ("05 CEREBRO") con la app:
// archivo nuevo → se lee y se agrega; archivo cambiado → se vuelve a leer; archivo borrado → se quita de la app.
// La categoría sale del contenido; si la app no reconoce el documento, del prefijo del nombre ("SEGUROS - Póliza auto.pdf" → Seguros).
import type { Repo } from "./datos/repo";
import { clasificarPorNombre, plano } from "./extraer";
import { procesarTexto } from "./procesar";
import { avisoDocumentoNuevo, enviarPush } from "./push";
import type { Categoria, DocumentoDrive, Pagina } from "./tipos";

export type ArchivoDrive = { id: string; nombre: string; mime: string; actualizado: string; url: string; carpeta?: string };
export type ContenidoDrive = ArchivoDrive & { texto: string; error?: string; recortado?: boolean };

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
  vincular: { doc: DocumentoDrive; archivo: ArchivoDrive }[]; // solo candidatos: mismo nombre que algo subido a mano (nunca se unen solos, S11)
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
// Bajas: solo con una lista completa (sin recortes ni archivos inválidos). Si de golpe faltan muchos (más de 3 y más de
// la mitad), se pausan: casi siempre es un error de Google o de la carpeta, no que borraste todo.
// Lo que subiste a mano y luego se vinculó con Drive no se borra: solo se desvincula (tu archivo original se queda).
export async function sincronizarLista(repo: Repo, archivos: ArchivoDrive[], maximo = 6, listaCompleta = true) {
  await repararUniones(repo); // una unión que se quedó a la mitad se termina o se deshace antes de comparar (S11-M)
  const docs = await repo.documentosDrive();
  const plan = planear(archivos, docs);
  const deDrive = docs.filter((d) => d.drive_id).length;
  const masivo = plan.borrar.length > 3 && plan.borrar.length > deDrive / 2;
  const bajasPausadas = !listaCompleta || masivo ? plan.borrar.length : 0;
  if (bajasPausadas) plan.borrar = [];
  // Nada se une solo (S11): ni por nombre ni por parecido. Si se parecen, la app lo sugiere en el documento y tú decides.
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
  for (const doc of plan.borrar) {
    if (doc.ruta_storage) await repo.editarDocumento(doc.id, { drive_id: null, drive_actualizado: null, url_externa: null });
    else await repo.borrarDocumento(doc.id);
  }
  // vinculados = uniones hechas de verdad (siempre 0 aquí); parecidos = mismo nombre que algo subido a mano, para revisar
  return { pedir: plan.pedir.slice(0, maximo), pendientes: plan.pedir.length, vinculados: 0, parecidos: plan.vincular.length, borrados: plan.borrar.length, bajasPausadas };
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

// ¿Se PARECEN? Palabras (4+ letras) en 80% o más y, si los dos traen números, también esos. Solo sirve para SUGERIR
// "podría ser el mismo documento": dos INE comparten casi todo el formato aunque sean de personas distintas (S11).
export function mismoContenido(a: string, b: string): boolean {
  const palabras = (t: string) => new Set(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{4,}/g) ?? []);
  const parecido = (x: Set<string>, y: Set<string>) => {
    let comunes = 0;
    for (const w of x) if (y.has(w)) comunes++;
    return comunes / Math.min(x.size, y.size);
  };
  const x = palabras(a), y = palabras(b);
  if (x.size < 5 || y.size < 5 || parecido(x, y) < 0.8) return false;
  const nx = new Set([...x].filter((w) => /\d/.test(w))), ny = new Set([...y].filter((w) => /\d/.test(w)));
  return !nx.size || !ny.size || parecido(nx, ny) >= 0.8;
}

// Documentos que podrían ser el mismo que `id` (mismo nombre y contenido parecido): uno subido a mano y otro de Drive.
// Es solo una sugerencia que se muestra en el documento; nunca se aplica sola.
export async function posiblesIguales(repo: Repo, id: string): Promise<DocumentoDrive[]> {
  const docs = await repo.documentosDrive();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return [];
  const otros = docs.filter((d) => d.id !== id && !!d.drive_id !== !!doc.drive_id && clave(d.nombre) === clave(doc.nombre));
  if (!otros.length) return [];
  const paginas = await repo.paginasDe([id, ...otros.map((d) => d.id)]);
  const texto = (x: string) => (paginas[x] ?? []).map((p) => p.contenido).join(" ");
  return otros.filter((d) => mismoContenido(texto(id), texto(d.id)));
}

// Tú confirmaste que son el mismo: el subido a mano se queda (con su archivo y su ficha) y toma el enlace de Drive;
// la copia que creó Drive se quita. Solo une un documento subido a mano con uno de Drive sin archivo propio.
// Unión manual en pasos que se pueden retomar (S11-M). Nunca se borra la copia de Drive antes de que tu documento
// ya tenga el enlace y se haya comprobado. Como Postgres no deja dos documentos con el mismo drive_id, la copia
// primero queda "apartada" (drive_id con la marca #uniendo:<tu documento>), así siempre se sabe qué se estaba haciendo.
// Si algo falla a la mitad, repararUniones() lo termina o lo deshace: al inicio de cada sincronización y de cada unión.
const MARCA = "#uniendo:";
export const apartado = (driveId: string, manualId: string) => `${driveId}${MARCA}${manualId}`;

export async function repararUniones(repo: Repo): Promise<number> {
  let arreglados = 0;
  const docs = await repo.documentosDrive();
  for (const d of docs) {
    const i = d.drive_id?.indexOf(MARCA) ?? -1;
    if (!d.drive_id || i < 0) continue;
    const original = d.drive_id.slice(0, i);
    const manual = docs.find((x) => x.id === d.drive_id!.slice(i + MARCA.length));
    if (manual?.drive_id === original) await repo.borrarDocumento(d.id); // ya estaba unido: solo faltaba quitar la copia
    else await repo.editarDocumento(d.id, { drive_id: original }); // no se alcanzó a unir: la copia vuelve a ser la de Drive
    arreglados++;
  }
  return arreglados;
}

export async function unirDocumentos(repo: Repo, manualId: string, driveDocId: string): Promise<void> {
  await repararUniones(repo);
  const docs = await repo.documentosDrive();
  const manual = docs.find((d) => d.id === manualId);
  const deDrive = docs.find((d) => d.id === driveDocId);
  if (!manual || !deDrive || manual.drive_id || !deDrive.drive_id || deDrive.ruta_storage) throw new Error("Estos dos documentos no se pueden unir.");
  const driveId = deDrive.drive_id;
  const url = await repo.enlaceExterno(deDrive.id);
  // 1) Apartar la copia (sigue completa, con su texto y su enlace)
  await repo.editarDocumento(deDrive.id, { drive_id: apartado(driveId, manual.id) });
  try {
    // 2) Tu documento toma el enlace de Drive y 3) se comprueba que de verdad quedó
    await repo.editarDocumento(manual.id, { drive_id: driveId, drive_actualizado: deDrive.drive_actualizado, url_externa: url });
    const quedo = (await repo.documentosDrive()).find((d) => d.id === manual.id);
    if (quedo?.drive_id !== driveId) throw new Error("no quedó el enlace");
  } catch {
    // No se unió: la copia vuelve a ser la de Drive. Si ni eso se puede, la marca queda y repararUniones lo deshace.
    await repo.editarDocumento(deDrive.id, { drive_id: driveId }).catch(() => {});
    throw new Error("No se pudieron unir. No se borró nada: tus dos documentos siguen como estaban. Inténtalo de nuevo.");
  }
  // 4) Ya unido y comprobado: ahora sí se quita la copia (si falla, se quita en la próxima sincronización)
  await repo.borrarDocumento(deDrive.id).catch(() => {});
}

// 2) El script manda el texto de un archivo (Google lo lee, incluso si es escaneado)
export async function guardarContenido(repo: Repo, a: ContenidoDrive): Promise<string> {
  const docs = await repo.documentosDrive();
  let doc = docs.find((d) => d.drive_id === a.id);
  const nombre = nombreVisible(a.nombre);
  // Si ya lo habías subido a mano NO se une solo (S11): queda como documento aparte y la app te sugiere unirlos
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
    const r = await procesarTexto(repo, id, nombre, paginar(a.texto), a.recortado ? "Google entregó solo el principio del texto (el archivo es muy largo)." : null);
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
