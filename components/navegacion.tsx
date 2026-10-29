"use client";

import { CalendarClock, Home, Library, NotebookPen, Plus, UserRound } from "lucide-react";
import { BarraInferior, BotonFlotante } from "./taos/shell";

export function Navegacion() {
  return (
    <>
      <BotonFlotante href="/subir" etiqueta="Subir" icono={Plus} ocultarEn={["/cuenta"]} />
      <BarraInferior
        secciones={[
          { ruta: "/", nombre: "Inicio", icono: Home },
          { ruta: "/biblioteca", nombre: "Biblioteca", icono: Library, tambien: ["/documentos"] },
          { ruta: "/indice", nombre: "Vence", icono: CalendarClock },
          { ruta: "/notas", nombre: "Notas", icono: NotebookPen },
          { ruta: "/cuenta", nombre: "Cuenta", icono: UserRound },
        ]}
      />
    </>
  );
}
