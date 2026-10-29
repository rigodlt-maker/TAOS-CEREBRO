import { preguntar } from "@/lib/preguntar";
import { obtenerRepo } from "@/lib/sesion";

export const dynamic = "force-dynamic";

// Responde una pregunta en streaming (texto plano que se va escribiendo)
export async function POST(req: Request) {
  const { pregunta } = (await req.json().catch(() => ({}))) as { pregunta?: string };
  const limpia = String(pregunta ?? "").trim().slice(0, 500);
  if (!limpia) return new Response("Escribe una pregunta.", { status: 400 });
  const repo = await obtenerRepo();
  const codificador = new TextEncoder();
  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      try {
        for await (const parte of preguntar(repo, limpia)) control.enqueue(codificador.encode(parte));
      } catch (e) {
        control.enqueue(codificador.encode(`\n\nOcurrió un error: ${(e as Error).message}`));
      }
      control.close();
    },
  });
  return new Response(cuerpo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
