import type { Metadata, Viewport } from "next";
import { RegistrarSW } from "@/components/registrar-sw";
import "./globals.css";

export const metadata: Metadata = {
  title: "Segundo Cerebro",
  description: "Mis documentos, sus datos clave y respuestas al momento",
  appleWebApp: { capable: true, title: "Cerebro", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
