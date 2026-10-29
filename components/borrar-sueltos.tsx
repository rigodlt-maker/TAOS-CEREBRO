"use client";

import { useState, useTransition } from "react";
import { borrarFueraDeDrive } from "@/lib/acciones";
import { Button } from "./ui/button";

export function BotonBorrarSueltos({ cuantos }: { cuantos: number }) {
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState("");
  return (
    <div className="grid gap-2">
      <Button
        variant="outline"
        disabled={pendiente}
        onClick={() => {
          if (!window.confirm(`¿Borrar ${cuantos} documentos que no están en tu Drive? No se puede deshacer.`)) return;
          iniciar(async () => setMensaje((await borrarFueraDeDrive()).mensaje));
        }}
      >
        {pendiente ? "Borrando…" : "Borrar los que no están en Drive"}
      </Button>
      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}
    </div>
  );
}
