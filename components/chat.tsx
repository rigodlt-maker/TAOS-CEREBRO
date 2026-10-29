"use client";

import { ArrowUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";
import { Button } from "./ui/button";

type Mensaje = { pregunta: string; respuesta: string; listo: boolean };

const EJEMPLOS = ["¿Qué vence pronto?", "Pásame mi INE", "¿Qué documentos tengo?", "¿A qué teléfono llamo si choco?", "¿Qué me falta?"];

// Chat de preguntas: busca en tus documentos y responde con el dato exacto y su origen
export function Chat({ autoFocus = false, compacto = false }: { autoFocus?: boolean; compacto?: boolean }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const final = useRef<HTMLDivElement>(null);

  // Llaves: en Chrome nuevo scrollIntoView devuelve una promesa y React la trataría como función de limpieza
  useEffect(() => {
    final.current?.scrollIntoView({ block: "nearest" });
  }, [mensajes]);

  async function enviar(pregunta: string) {
    pregunta = pregunta.trim();
    if (!pregunta || ocupado) return;
    setTexto("");
    setOcupado(true);
    setMensajes((m) => [...m, { pregunta, respuesta: "", listo: false }]);
    const poner = (cambio: (r: string) => string, listo = false) =>
      setMensajes((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, respuesta: cambio(x.respuesta), listo } : x)));
    try {
      const r = await fetch("/api/preguntar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta }) });
      if (!r.ok || !r.body) throw new Error(await r.text());
      const lector = r.body.getReader();
      const decodificador = new TextDecoder();
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        const parte = decodificador.decode(value, { stream: true });
        // "\u0000" = la IA falló y se empieza de nuevo con reglas
        if (parte.includes("\u0000")) poner(() => parte.split("\u0000").pop() ?? "");
        else poner((anterior) => anterior + parte);
      }
      poner((x) => x, true);
    } catch (e) {
      poner(() => `No pude responder: ${(e as Error).message}`, true);
    }
    setOcupado(false);
  }

  return (
    <div className="grid gap-3">
      {mensajes.length === 0 && !compacto && (
        <div className="flex flex-wrap gap-2">
          {EJEMPLOS.map((e) => (
            <button key={e} type="button" onClick={() => enviar(e)} className="min-h-10 rounded-full border px-4 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {e}
            </button>
          ))}
        </div>
      )}
      {mensajes.length > 0 && (
        <div className={cn("grid gap-4 overflow-y-auto", compacto ? "max-h-[55vh]" : "max-h-[60vh]")}>
          {mensajes.map((m, i) => (
            <div key={i} className="grid gap-2">
              <p className="justify-self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.pregunta}</p>
              <div className="rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-sm">
                {m.respuesta ? <Markdown texto={m.respuesta} /> : <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          ))}
          <div ref={final} />
        </div>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus={autoFocus}
          maxLength={500}
          placeholder="Pregúntale a Tao: ¿cuándo vence mi seguro?"
          aria-label="Tu pregunta"
          className="h-12 w-full rounded-full border bg-card px-5 text-base focus-visible:outline-2 focus-visible:outline-primary"
        />
        <Button type="submit" size="icon" className="size-12 shrink-0 rounded-full" disabled={ocupado || !texto.trim()} aria-label="Preguntar">
          {ocupado ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
