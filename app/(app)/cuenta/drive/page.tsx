import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Copiar } from "@/components/copiar";
import { BotonBorrarSueltos } from "@/components/borrar-sueltos";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { urlDeLaApp } from "@/lib/correo";
import { CARPETA_DRIVE, claveDrive, scriptDrive } from "@/lib/script-drive";
import { obtenerRepo } from "@/lib/sesion";
import type { DocumentoDrive } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const PASOS = [
  "Toca “Copiar código”.",
  `Abre script.google.com con tu cuenta de Google (la del Drive donde está la carpeta “${CARPETA_DRIVE}”) y toca “Nuevo proyecto”.`,
  "Borra lo que aparece y pega el código. Toca el ícono de guardar (💾).",
  "En el menú de la izquierda, junto a “Servicios”, toca “+”, elige “Drive API” y toca “Agregar”. Así Google puede leer el texto de tus PDF y fotos.",
  "Arriba, junto a “Ejecutar”, elige la función “instalar” y toca “Ejecutar”.",
  "Google te pedirá permiso: “Revisar permisos” › tu cuenta › “Configuración avanzada” › “Ir a Proyecto sin título” › “Permitir”. Es tu propio script: solo lee esa carpeta y manda el texto a tu app.",
  "Abajo dirá “¡Listo!” y empezará a leer tus archivos. La primera vez puede tardar: cada 30 minutos sigue con los que falten.",
];

// Guía para conectar la carpeta de Google Drive (gratis, sin dar tu contraseña a nadie)
export default async function ConectarDrive() {
  const clave = claveDrive();
  const h = await headers();
  const url = urlDeLaApp() ?? `https://${h.get("host")}`;
  const repo = await obtenerRepo();
  // Antes de correr el SQL de Drive esto no existe: no pasa nada
  const docs: DocumentoDrive[] = await repo.documentosDrive().catch(() => []);
  const conectados = docs.filter((d) => d.drive_id).length;
  const sueltos = docs.filter((d) => !d.drive_id);

  return (
    <div className="grid gap-4">
      <Link href="/cuenta" className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-5" /> Cuenta
      </Link>
      <Titulo detalle={`Lo que agregues, cambies o borres en tu carpeta “${CARPETA_DRIVE}” se refleja solo en la app.`}>Conectar Google Drive</Titulo>
      {conectados > 0 && (
        <Card>
          <CardTitle>✅ {conectados} documentos sincronizados con Drive</CardTitle>
        </Card>
      )}
      {!clave ? (
        <Card>
          <CardTitle>Primero conecta Supabase</CardTitle>
          <CardDescription className="mt-2">Esto funciona cuando la app ya guarda tus datos reales (no en modo demostración).</CardDescription>
        </Card>
      ) : (
        <>
          <Card className="grid gap-3">
            <ol className="grid list-decimal gap-2 pl-5 text-sm">
              {PASOS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </Card>
          <Card>
            <Copiar texto={scriptDrive(url, clave)} />
          </Card>
          <Card>
            <CardTitle>Cómo se acomodan</CardTitle>
            <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
              <li>La categoría sale del inicio del nombre: “SEGUROS - …”, “IDENTIDAD - …”, “SALUD - …”, “AUTO - …”, “FINANZAS - …”, “CONTRATOS - …”, “HOGAR - …”.</li>
              <li>Si reemplazas un archivo por uno nuevo (como tu constancia), se actualiza; si lo borras de la carpeta, se quita de la app.</li>
              <li>Google lee el texto, incluso de documentos escaneados.</li>
            </ul>
          </Card>
          <CardDescription className="text-center">El código contiene tu clave personal: no lo compartas.</CardDescription>
        </>
      )}
      {conectados > 0 && sueltos.length > 0 && (
        <Card className="grid gap-3">
          <CardTitle>{sueltos.length} documentos que no están en tu Drive</CardTitle>
          <CardDescription>Los subiste directo a la app y no están en la carpeta (por ejemplo, versiones viejas). Si tu Drive es tu archivo oficial, bórralos aquí.</CardDescription>
          <ul className="grid gap-1 text-sm">
            {sueltos.slice(0, 20).map((d) => (
              <li key={d.id}>
                <Link href={`/documentos/${d.id}`} className="text-primary underline underline-offset-2">
                  {d.nombre}
                </Link>
              </li>
            ))}
          </ul>
          <BotonBorrarSueltos cuantos={sueltos.length} />
        </Card>
      )}
    </div>
  );
}
