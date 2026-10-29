"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { queMeFaltaAccion } from "@/lib/acciones";
import type { Sugerencia } from "@/lib/faltantes";
import { Button } from "./ui/button";

export function QueMeFalta() {
  const [lista, setLista] = useState<Sugerencia[] | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="grid gap-3">
      <Button variant="outline" className="w-full" onClick={() => iniciar(async () => setLista(await queMeFaltaAccion()))} disabled={pendiente}>
        {pendiente ? <Loader2 className="size-4 animate-spin" /> : <Lightbulb className="size-4" />}
        ¿Qué me falta?
      </Button>
      {lista &&
        (lista.length ? (
          <ul className="grid gap-2 text-sm">
            {lista.map((s) => (
              <li key={s.documento} className="rounded-xl border p-3">
                <p className="font-medium">{s.documento}</p>
                <p className="text-muted-foreground">{s.porque}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">¡Tienes todo lo básico! 🎉</p>
        ))}
    </div>
  );
}
