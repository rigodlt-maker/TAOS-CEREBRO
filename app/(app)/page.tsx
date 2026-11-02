import Link from "next/link";
import { Chat } from "@/components/chat";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Vencimiento } from "@/components/vencimiento";
import { hoyEnMexico } from "@/lib/fechas";
import { evaluar, resumen } from "@/lib/mis-documentos";
import { obtenerRepo } from "@/lib/sesion";
import { vencenEn } from "@/lib/vencimientos";

export default async function Inicio() {
  const repo = await obtenerRepo();
  const hoy = hoyEnMexico();
  const [docs, notas, marcas] = await Promise.all([repo.documentos(), repo.notas(), repo.marcasDocumentos()]);
  const lista = resumen(evaluar(docs, notas, marcas));
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
      <Link href="/mis-documentos" className="block rounded-2xl border bg-card p-4 active:bg-muted">
        <span className="flex items-baseline justify-between">
          <span className="font-semibold">Mis documentos</span>
          <span className="text-sm text-primary">
            {lista.listos} de {lista.total} listos →
          </span>
        </span>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${lista.total ? Math.round((lista.listos / lista.total) * 100) : 0}%` }} />
        </span>
        {lista.basicosFaltan.length > 0 && <span className="mt-2 block text-sm text-muted-foreground">Te faltan básicos: {lista.basicosFaltan.map((i) => i.nombre).join(", ")}</span>}
      </Link>
      <p className="text-center text-sm text-muted-foreground">{docs.length} documentos en tu archivo</p>
    </div>
  );
}
