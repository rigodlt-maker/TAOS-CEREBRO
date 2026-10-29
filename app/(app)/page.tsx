import Link from "next/link";
import { Chat } from "@/components/chat";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Vencimiento } from "@/components/vencimiento";
import { hoyEnMexico } from "@/lib/fechas";
import { obtenerRepo } from "@/lib/sesion";
import { vencenEn } from "@/lib/vencimientos";

export default async function Inicio() {
  const repo = await obtenerRepo();
  const hoy = hoyEnMexico();
  const docs = await repo.documentos();
  const vencidos = docs.filter((d) => d.ficha?.fecha_vencimiento && d.ficha.fecha_vencimiento < hoy);
  const proximos = [...vencidos, ...vencenEn(docs, hoy, 60)].slice(0, 3);

  return (
    <div className="grid gap-4">
      <Card>
        <CardTitle className="text-xl">Pregúntale a Tao</CardTitle>
        <CardDescription className="mt-1 mb-4">Tu asesor TAOS: te responde con el dato exacto y el documento de donde sale.</CardDescription>
        <Chat />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vence pronto</CardTitle>
          <Link href="/indice" className="flex min-h-11 items-center text-sm text-primary">
            Ver todo
          </Link>
        </CardHeader>
        {proximos.length ? (
          <ul className="grid gap-1">
            {proximos.map((d) => (
              <li key={d.id}>
                <Link href={`/documentos/${d.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-2 active:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.tipo_documento ?? d.nombre}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.nombre}</span>
                  </span>
                  <Vencimiento fecha={d.ficha?.fecha_vencimiento} hoy={hoy} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <CardDescription>Nada vence en los próximos 60 días.</CardDescription>
        )}
      </Card>
      <p className="text-center text-sm text-muted-foreground">{docs.length} documentos en tu archivo</p>
    </div>
  );
}
