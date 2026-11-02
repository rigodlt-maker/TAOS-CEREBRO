import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Segundo Cerebro",
    short_name: "Cerebro",
    description: "Mis documentos, sus datos clave y respuestas al momento",
    start_url: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    lang: "es-MX",
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atajos: al dejar presionado el ícono de la app (Android) aparecen estos accesos directos
    shortcuts: [
      { name: "Subir un documento", short_name: "Subir", url: "/subir" },
      { name: "Mis documentos", short_name: "Documentos", url: "/biblioteca" },
      { name: "Notas", short_name: "Notas", url: "/notas" },
    ],
  };
}
