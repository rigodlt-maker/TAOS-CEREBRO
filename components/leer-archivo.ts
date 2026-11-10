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

// Límites para que un PDF enorme no congele el celular (S18): páginas, tamaño del dibujo y texto por página
const MAX_PAGINAS = 200;
const MAX_PAGINAS_ESCANEADAS = 30;
const MAX_PIXELES = 8_000_000; // ~ una hoja carta a buena resolución
const MAX_TEXTO_PAGINA = 20_000;

async function leerPdf(archivo: File, avisar: Progreso): Promise<Pagina[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise.catch(() => {
    throw new Error("No se pudo abrir este PDF (puede estar dañado o protegido con contraseña). Prueba con otro archivo o una foto.");
  });
  const paginas: Pagina[] = [];
  let ocr: Ocr | null = null;
  let escaneadas = 0;
  const total = Math.min(pdf.numPages, MAX_PAGINAS);
  try {
    for (let n = 1; n <= total; n++) {
      avisar(`Leyendo página ${n} de ${total}${pdf.numPages > total ? ` (solo las primeras ${MAX_PAGINAS} de ${pdf.numPages})` : ""}…`);
      const pagina = await pdf.getPage(n);
      const contenido = await pagina.getTextContent();
      let texto = "";
      for (const item of contenido.items) {
        if ("str" in item) texto += item.str + (item.hasEOL ? "\n" : "");
      }
      // Página escaneada (sin texto): se dibuja y se lee con OCR
      if (texto.replace(/\s/g, "").length < MIN_TEXTO_POR_PAGINA && escaneadas < MAX_PAGINAS_ESCANEADAS) {
        escaneadas++;
        ocr ??= await crearOcr(avisar);
        avisar(`Leyendo página escaneada ${n} de ${total}…`);
        // Escala 2, pero sin pasar del tope de píxeles (una página gigante se dibuja más chica)
        const base = pagina.getViewport({ scale: 1 });
        const escala = Math.max(0.1, Math.min(2, Math.sqrt(MAX_PIXELES / Math.max(1, base.width * base.height))));
        const vista = pagina.getViewport({ scale: escala });
        const lienzo = document.createElement("canvas");
        lienzo.width = vista.width;
        lienzo.height = vista.height;
        await pagina.render({ canvas: lienzo, viewport: vista }).promise;
        texto = await ocr.leer(lienzo);
        lienzo.width = lienzo.height = 0; // libera la memoria del dibujo
      }
      paginas.push({ pagina: n, contenido: texto.slice(0, MAX_TEXTO_PAGINA) });
      pagina.cleanup();
    }
  } finally {
    await ocr?.cerrar();
    await pdf.cleanup().catch(() => {});
  }
  return paginas;
}

export async function leerArchivo(archivo: File, avisar: Progreso): Promise<Pagina[]> {
  const tipo = archivo.type || "";
  if (tipo === "application/pdf" || archivo.name.toLowerCase().endsWith(".pdf")) return leerPdf(archivo, avisar);
  if (tipo.startsWith("image/")) {
    const ocr = await crearOcr(avisar);
    try {
      avisar("Leyendo la imagen…");
      return [{ pagina: 1, contenido: await ocr.leer(archivo) }];
    } finally {
      await ocr.cerrar();
    }
  }
  avisar("Leyendo texto…");
  return [{ pagina: 1, contenido: await archivo.text() }];
}

export const ACEPTA = "application/pdf,image/*,text/plain,text/markdown,.txt,.md,.csv";
