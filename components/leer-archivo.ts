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

async function leerPdf(archivo: File, avisar: Progreso): Promise<Pagina[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
  const paginas: Pagina[] = [];
  let ocr: Ocr | null = null;
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      avisar(`Leyendo página ${n} de ${pdf.numPages}…`);
      const pagina = await pdf.getPage(n);
      const contenido = await pagina.getTextContent();
      let texto = "";
      for (const item of contenido.items) {
        if ("str" in item) texto += item.str + (item.hasEOL ? "\n" : "");
      }
      // Página escaneada (sin texto): se dibuja y se lee con OCR
      if (texto.replace(/\s/g, "").length < MIN_TEXTO_POR_PAGINA) {
        ocr ??= await crearOcr(avisar);
        avisar(`Leyendo página escaneada ${n} de ${pdf.numPages}…`);
        const vista = pagina.getViewport({ scale: 2 });
        const lienzo = document.createElement("canvas");
        lienzo.width = vista.width;
        lienzo.height = vista.height;
        await pagina.render({ canvas: lienzo, viewport: vista }).promise;
        texto = await ocr.leer(lienzo);
      }
      paginas.push({ pagina: n, contenido: texto });
    }
  } finally {
    await ocr?.cerrar();
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
