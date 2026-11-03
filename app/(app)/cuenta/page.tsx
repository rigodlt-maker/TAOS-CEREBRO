import { ChevronRight, ClipboardCheck, FolderSync } from "lucide-react";
import Link from "next/link";
import { AvisosPush } from "@/components/avisos-push";
import { TamanoLetra } from "@/components/taos/tamano-letra";
import { FormularioContrasena } from "@/components/contrasena";
import { BotonAccion } from "@/components/formulario";
import { Titulo } from "@/components/taos/encabezado";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { releerDocumentos } from "@/lib/acciones";
import { correoActual } from "@/lib/sesion";

export default async function Cuenta() {
  const correo = await correoActual();
  return (
    <div className="grid gap-4">
      <Titulo detalle={correo ?? undefined}>Cuenta</Titulo>
      <Link href="/mis-documentos" className="flex min-h-18 items-center gap-4 rounded-2xl border bg-card px-4 py-3 active:bg-muted">
        <ClipboardCheck className="size-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Mis documentos</span>
          <span className="block truncate text-sm text-muted-foreground">Qué tienes, qué falta y cómo tramitarlo</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
      <Link href="/cuenta/drive" className="flex min-h-18 items-center gap-4 rounded-2xl border bg-card px-4 py-3 active:bg-muted">
        <FolderSync className="size-6 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Conectar Google Drive</span>
          <span className="block truncate text-sm text-muted-foreground">Tu carpeta “05 CEREBRO” se refleja sola en la app</span>
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </Link>
      <Card>
        <CardTitle className="mb-1">Volver a leer mis documentos</CardTitle>
        <CardDescription className="mb-4">
          Tao aprendió a leer mejor fechas, teléfonos y montos. Toca para mejorar las fichas de lo que ya subiste; lo que corregiste a mano no se toca.
        </CardDescription>
        <BotonAccion accion={releerDocumentos} variant="outline" size="default">
          Volver a leer
        </BotonAccion>
      </Card>
      <Card>
        <CardTitle className="mb-1">Notificaciones en el celular</CardTitle>
        <CardDescription className="mb-4">
          Avisos cuando se lee un documento nuevo de tu Drive y cuando algo está por vencer. Actívalas en cada celular o computadora donde las quieras.
        </CardDescription>
        <AvisosPush />
      </Card>
      <Card>
        <CardTitle className="mb-1">Pantalla</CardTitle>
        <CardDescription className="mb-4">Tamaño de la letra en este celular.</CardDescription>
        <TamanoLetra />
        <a href="/?recorrido=1" className="mt-3 flex min-h-11 items-center justify-center text-sm text-primary">
          Ver el tutorial otra vez
        </a>
      </Card>
      <Card>
        <CardTitle className="mb-1">Contraseña</CardTitle>
        <CardDescription className="mb-4">Para entrar sin esperar el enlace por correo, también desde la app instalada.</CardDescription>
        <FormularioContrasena />
      </Card>
    </div>
  );
}
