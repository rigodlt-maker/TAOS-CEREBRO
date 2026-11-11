// Lectura de archivos en el navegador (gratis, sin IA): texto de PDF con pdf.js y
// fotos o escaneos con OCR en español (tesseract.js). Nada sale de tu dispositivo en este paso.
import type { Pagina } from "@/lib/tipos";

export type Progreso = (mensaje: string) => void;

const MIN_TEXTO_POR_PAGINA = 30;

type Ocr = { leer: (imagen: HTMLCanvasElement | File) => Promise<string>; cerrar: () => Promise<void> };

async function crearOcr(avisar: Progreso): Promise<Ocr> {
  avisar("Preparando lectura de imágenes (la primera vez tarda un poco)…");
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa");
  return {
    leer: async (imagen) => (await worker.recognize(imagen)).data.text,
    cerrar: async () => {
      await worker.terminate();
    },
  };
}

// Límites para que un archivo enorme no congele el celular (S18). Se revisan ANTES de crear el dibujo (canvas).
export const MAX_PAGINAS = 200;
export const MAX_PAGINAS_ESCANEADAS = 30;
export const MAX_PIXELES = 8_000_000; // ~ una hoja carta a buena resolución
export const MAX_LADO = 4096; // ningún lado del dibujo pasa de esto (páginas muy largas y angostas)
export const MIN_ESCALA_LEGIBLE = 0.25; // si para caber hay que achicarla más, ya no se podría leer: se omite
export const MAX_TEXTO_PAGINA = 20_000;
export const MAX_TEXTO_TOTAL = 400_000; // lo que se manda al servidor
export const MAX_BYTES_TEXTO = 2_000_000;

// Resultado de leer: las páginas y si quedó incompleto (y por qué). Texto incompleto NO quiere decir
// "el documento no trae esa fecha": por eso se guarda el aviso de lectura parcial junto al documento.
export type Lectura = { paginas: Pagina[]; parcial: boolean; omitidas: number[]; motivo: string | null };

// Escala segura para dibujar una página de ancho×alto: respeta el área y el lado máximo. null = no se puede leer legible.
export function escalaSegura(ancho: number, alto: number, preferida = 2): number | null {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) return null;
  const escala = Math.min(preferida, Math.sqrt(MAX_PIXELES / (ancho * alto)), MAX_LADO / ancho, MAX_LADO / alto);
  if (!(escala >= MIN_ESCALA_LEGIBLE)) return null;
  // Se redondea hacia abajo para que el dibujo final nunca pase de los topes
  return Math.floor(escala * 1000) / 1000;
}

const motivoDe = (m: string[]) => (m.length ? m.join(" ") : null);

// Texto sin páginas (TXT, foto): se parte en páginas de MAX_TEXTO_PAGINA en vez de cortarlo, hasta MAX_TEXTO_TOTAL.
// Si no cabe todo, se marca como lectura parcial y se dice qué pasó (S18-T): nunca se presenta mutilado como completo.
export function partirTexto(texto: string, motivoSiNoCabe: string, yaRecortado: string | null = null): Lectura {
  const cabe = texto.slice(0, MAX_TEXTO_TOTAL);
  const paginas: Pagina[] = [];
  for (let i = 0; i < cabe.length; i += MAX_TEXTO_PAGINA) paginas.push({ pagina: paginas.length + 1, contenido: cabe.slice(i, i + MAX_TEXTO_PAGINA) });
  if (!paginas.length) paginas.push({ pagina: 1, contenido: "" });
  const motivos = [yaRecortado, cabe.length < texto.length ? motivoSiNoCabe : null].filter((m): m is string => !!m);
  return { paginas, parcial: motivos.length > 0, omitidas: [], motivo: motivoDe([...new Set(motivos)]) };
}

async function leerPdf(archivo: File, avisar: Progreso): Promise<Lectura> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) });
  const paginas: Pagina[] = [];
  const omitidas: number[] = [];
  const motivos: string[] = [];
  let ocr: Ocr | null = null;
  let escaneadas = 0;
  let totalTexto = 0;
  try {
    const pdf = await tarea.promise.catch(() => {
      throw new Error("No se pudo abrir este PDF (puede estar dañado o protegido con contraseña). Prueba con otro archivo o una foto.");
    });
    const total = Math.min(pdf.numPages, MAX_PAGINAS);
    if (pdf.numPages > MAX_PAGINAS) motivos.push(`Solo se leyeron las primeras ${MAX_PAGINAS} de ${pdf.numPages} páginas.`);
    for (let n = 1; n <= total; n++) {
      avisar(`Leyendo página ${n} de ${total}…`);
      const pagina = await pdf.getPage(n);
      let lienzo: HTMLCanvasElement | null = null;
      try {
        const contenido = await pagina.getTextContent();
        let texto = "";
        for (const item of contenido.items) {
          if ("str" in item) texto += item.str + (item.hasEOL ? "\n" : "");
          if (texto.length > MAX_TEXTO_PAGINA) break; // deja de juntar texto al llegar al tope
        }
        // Página escaneada (sin texto): se dibuja y se lee con OCR, si cabe en los topes
        if (texto.replace(/\s/g, "").length < MIN_TEXTO_POR_PAGINA) {
          const base = pagina.getViewport({ scale: 1 });
          const escala = escalaSegura(base.width, base.height);
          if (escaneadas >= MAX_PAGINAS_ESCANEADAS) {
            omitidas.push(n);
          } else if (escala === null) {
            omitidas.push(n);
            motivos.push(`La página ${n} es demasiado grande para leerla en el celular; divide o recorta el archivo.`);
          } else {
            escaneadas++;
            ocr ??= await crearOcr(avisar);
            avisar(`Leyendo página escaneada ${n} de ${total}…`);
            const vista = pagina.getViewport({ scale: escala });
            lienzo = document.createElement("canvas");
            lienzo.width = Math.min(MAX_LADO, Math.floor(vista.width));
            lienzo.height = Math.min(MAX_LADO, Math.floor(vista.height));
            await pagina.render({ canvas: lienzo, viewport: vista }).promise;
            texto = await ocr.leer(lienzo);
          }
        }
        const recorte = texto.slice(0, Math.max(0, Math.min(MAX_TEXTO_PAGINA, MAX_TEXTO_TOTAL - totalTexto)));
        if (recorte.length < texto.length) motivos.push(`Se recortó el texto de la página ${n}.`);
        totalTexto += recorte.length;
        paginas.push({ pagina: n, contenido: recorte });
      } finally {
        // Se libera aunque algo falle en esta página
        if (lienzo) lienzo.width = lienzo.height = 0;
        try {
          pagina.cleanup();
        } catch {}
      }
    }
    const escaneadasOmitidas = omitidas.length - motivos.filter((m) => m.startsWith("La página")).length;
    if (escaneadasOmitidas > 0) motivos.push(`${escaneadasOmitidas} página(s) escaneada(s) sin leer: solo se leen ${MAX_PAGINAS_ESCANEADAS} por archivo.`);
  } finally {
    // Liberaciones independientes: si una falla, las otras igual se hacen
    await ocr?.cerrar().catch(() => {});
    await tarea.destroy().catch(() => {});
  }
  return { paginas, parcial: motivos.length > 0, omitidas, motivo: motivoDe(motivos) };
}

// Foto: se achica dentro de los topes antes de leerla (una foto enorme ya no se pasa entera al OCR)
async function leerImagen(archivo: File, avisar: Progreso): Promise<Lectura> {
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new Error("No se pudo abrir esta imagen. Prueba con otra foto (JPG o PNG).");
  });
  const lienzo = document.createElement("canvas");
  let ocr: Ocr | null = null;
  try {
    const escala = escalaSegura(bitmap.width, bitmap.height, 1);
    if (escala === null) throw new Error("La imagen es demasiado grande para leerla en el celular. Recórtala o toma la foto más de cerca.");
    lienzo.width = Math.floor(bitmap.width * escala);
    lienzo.height = Math.floor(bitmap.height * escala);
    lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    ocr = await crearOcr(avisar);
    avisar("Leyendo la imagen…");
    const texto = await ocr.leer(lienzo);
    return partirTexto(texto, "Se recortó el texto de la imagen (es muy largo).");
  } finally {
    lienzo.width = lienzo.height = 0;
    bitmap.close();
    await ocr?.cerrar().catch(() => {});
  }
}

export async function leerArchivo(archivo: File, avisar: Progreso): Promise<Lectura> {
  const tipo = archivo.type || "";
  if (tipo === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf")) return leerPdf(archivo, avisar);
  if (tipo.startsWith("image/")) return leerImagen(archivo, avisar);
  avisar("Leyendo texto…");
  const grande = archivo.size > MAX_BYTES_TEXTO;
  const texto = await archivo.slice(0, MAX_BYTES_TEXTO).text();
  const muyGrande = "Solo se leyó el principio de este archivo de texto (es muy grande).";
  return partirTexto(texto, muyGrande, grande ? muyGrande : null);
}

export const ACEPTA = "application/pdf,image/*,text/plain,text/markdown,.txt,.md,.csv";
