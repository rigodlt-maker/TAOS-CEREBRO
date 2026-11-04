import type { MetadataRoute } from "next";
import { supabaseConfigurado } from "@/lib/supabase/config";

export default function manifest(): MetadataRoute.Manifest {
  // Apps de demostración (sin base de datos): ícono a lápiz y "Demo" en el nombre, para no confundirlas con la app real
  const demo = !supabaseConfigurado();
  const ico = demo ? "/demo/icono" : "/icono";
  return {
    name: demo ? "Segundo Cerebro (demo)" : "Segundo Cerebro",
    short_name: demo ? "Cerebro demo" : "Cerebro",
    description: "Mis documentos, sus datos clave y respuestas al momento",
    start_url: "/",
    display: "standalone",
    background_color: "#060606",
    theme_color: "#060606",
    lang: "es-MX",
    icons: [
      { src: `${ico}-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${ico}-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${ico}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Atajos: al dejar presionado el ícono de la app (Android) aparecen estos accesos directos
    shortcuts: [
      { name: "Subir un documento", short_name: "Subir", url: "/subir" },
      { name: "Mis documentos", short_name: "Documentos", url: "/biblioteca" },
      { name: "Notas", short_name: "Notas", url: "/notas" },
    ],
  };
}
