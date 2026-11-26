"use client";

// El buscador 🔍 con las pantallas de esta app (lib/destinos.ts)
import { Buscador } from "@/components/taos/buscador";
import { DESTINOS, GRUPOS } from "@/lib/destinos";

export function BuscadorApp() {
  return <Buscador destinos={DESTINOS} grupos={GRUPOS} ejemplo="Ej. mi INE" pistas="subir, vence, Drive" />;
}
