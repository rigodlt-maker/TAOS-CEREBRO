import { createHmac } from "node:crypto";

export const CARPETA_DRIVE = "05 CEREBRO";

// Clave del script de Drive: DRIVE_CLAVE si la pusiste en Vercel; si no, se deriva de la llave secreta de Supabase
export function claveDrive(): string | null {
  if (process.env.DRIVE_CLAVE) return process.env.DRIVE_CLAVE;
  const base = process.env.SUPABASE_SECRET_KEY;
  if (!base) return null;
  return createHmac("sha256", base).update("taos-cerebro:drive").digest("base64url").slice(0, 32);
}

// Script de Google Apps Script que vive en tu cuenta: cada 30 minutos revisa tu carpeta y manda lo nuevo a la app
export function scriptDrive(urlApp: string, clave: string, carpeta = CARPETA_DRIVE): string {
  return `// Segundo Cerebro TAOS: mantiene tu app al día con tu carpeta de Google Drive.
// 1) Pega todo esto en script.google.com  2) Elige la función "instalar" y toca Ejecutar  3) Da permiso.
const URL_APP = "${urlApp}/api/drive";
const CLAVE = "${clave}";
const CARPETA = "${carpeta}";

function instalar() {
  const prueba = UrlFetchApp.fetch(URL_APP, { headers: { Authorization: "Bearer " + CLAVE }, muteHttpExceptions: true });
  if (prueba.getResponseCode() !== 200) throw new Error("No me pude conectar con tu app: " + prueba.getContentText());
  carpeta();
  revisarServicio();
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("sincronizar").timeBased().everyMinutes(30).create();
  Logger.log("¡Listo! Cada 30 minutos reviso tu carpeta " + CARPETA + ". Ahora leo lo que ya tienes...");
  sincronizar();
}

function carpeta() {
  const it = DriveApp.getFoldersByName(CARPETA);
  if (!it.hasNext()) throw new Error('No encontré la carpeta "' + CARPETA + '" en tu Drive.');
  return it.next();
}

function listar(c, ruta, lista) {
  const archivos = c.getFiles();
  while (archivos.hasNext()) {
    const f = archivos.next();
    lista.push({ id: f.getId(), nombre: f.getName(), mime: f.getMimeType(), actualizado: f.getLastUpdated().toISOString(), url: f.getUrl(), carpeta: ruta });
  }
  const sub = c.getFolders();
  while (sub.hasNext()) {
    const s = sub.next();
    listar(s, ruta ? ruta + "/" + s.getName() : s.getName(), lista);
  }
  return lista;
}

function enviar(datos) {
  const r = UrlFetchApp.fetch(URL_APP, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + CLAVE },
    payload: JSON.stringify(datos),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 200) throw new Error(r.getResponseCode() + " " + r.getContentText());
  return JSON.parse(r.getContentText());
}

// Google convierte el archivo en un documento temporal (lee hasta escaneos y fotos), saca el texto y lo tira
// Usa el servicio "Drive API" (se agrega una vez en el menú Servicios del script)
function leerTexto(f) {
  if (f.mime === MimeType.GOOGLE_DOCS) return DocumentApp.openById(f.id).getBody().getText();
  if (f.mime === "text/plain") return DriveApp.getFileById(f.id).getBlob().getDataAsString();
  revisarServicio();
  const copia = Drive.Files.copy({ name: "tmp-segundo-cerebro", mimeType: MimeType.GOOGLE_DOCS }, f.id, { ocrLanguage: "es" });
  try {
    return DocumentApp.openById(copia.id).getBody().getText();
  } finally {
    DriveApp.getFileById(copia.id).setTrashed(true);
  }
}

function revisarServicio() {
  if (typeof Drive === "undefined") throw new Error('Falta agregar el servicio "Drive API": en el menú de la izquierda, junto a "Servicios", toca "+", elige "Drive API" y toca "Agregar".');
}

function sincronizar() {
  const inicio = Date.now();
  const archivos = listar(carpeta(), "", []);
  const r = enviar({ accion: "lista", archivos: archivos });
  let leidos = 0;
  for (const id of r.pedir) {
    if (Date.now() - inicio > 4 * 60 * 1000) break; // Google da 6 minutos por vuelta; lo demás sigue en la próxima
    const f = archivos.find((a) => a.id === id);
    let texto = "";
    let error = "";
    try {
      texto = leerTexto(f);
    } catch (e) {
      error = String((e && e.message) || e).slice(0, 200);
    }
    const res = enviar({ accion: "contenido", archivo: Object.assign({}, f, { texto: texto.slice(0, 900000), error: error }) });
    Logger.log(res.mensaje + (error ? " — " + error : ""));
    leidos++;
  }
  Logger.log("Leí " + leidos + " archivos. Faltan " + Math.max(0, r.pendientes - leidos) + " (siguen en la próxima vuelta).");
}
`;
}
