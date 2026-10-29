import { NextResponse } from "next/server";
import { enviarCorreo, escapar, plantilla, urlDeLaApp } from "@/lib/correo";
import { cronAutorizado, repoDelDueno } from "@/lib/cron";
import { enCuanto, fechaLarga, hoyEnMexico } from "@/lib/fechas";
import { avisosDeVencimiento, enviarPush } from "@/lib/push";
import type { Documento } from "@/lib/tipos";
import { accionSugerida, avisosPendientes, vencenEn } from "@/lib/vencimientos";

export const dynamic = "force-dynamic";

// Diario a las 8:00 am (Ciudad de México): avisos a 30 y 7 días; el día 1, lo que vence en 60 días.
// ?prueba=1 manda el resumen aunque no sea día 1 (solo con CRON_SECRET).
export async function GET(req: Request) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const hoy = hoyEnMexico();
  const prueba = new URL(req.url).searchParams.has("prueba");
  const repo = await repoDelDueno();
  const docs = (await repo.documentos()).filter((d) => d.ficha?.fecha_vencimiento);
  const app = urlDeLaApp();
  const enlace = (d: Documento) => (app ? `<a href="${app}/documentos/${d.id}" style="color:#18181b">${escapar(d.nombre)}</a>` : escapar(d.nombre));
  const enviados: string[] = [];

  const avisos = avisosPendientes(docs, hoy);
  if (avisos.length) {
    const bloques = avisos.map(
      ({ doc, dias }) => `<strong>${escapar(doc.tipo_documento ?? doc.nombre)}</strong> ${dias === 0 ? "vence hoy" : `vence en ${dias} días`} (${fechaLarga(doc.ficha!.fecha_vencimiento!)})<br>
${enlace(doc)}<br><span style="color:#52525b">Qué hacer: ${escapar(accionSugerida(doc))}</span>`,
    );
    const asunto = avisos.length === 1 ? `⏰ ${avisos[0].doc.tipo_documento ?? avisos[0].doc.nombre} ${avisos[0].dias <= 7 ? "vence en menos de una semana" : "vence en un mes"}` : `⏰ ${avisos.length} documentos están por vencer`;
    await enviarCorreo(asunto, plantilla("Documentos por vencer", bloques, app));
    // Notificación en el celular además del correo
    const push = await enviarPush(repo, avisosDeVencimiento(avisos, accionSugerida));
    enviados.push(`push: ${push.enviados}`);
    for (const { doc, clave } of avisos) await repo.marcarAvisos(doc.id, [...(doc.avisos_enviados ?? []), clave]);
    enviados.push(`avisos: ${avisos.length}`);
  }

  if (hoy.endsWith("-01") || prueba) {
    const proximos = vencenEn(docs, hoy, 60);
    const bloque = proximos.length
      ? `<ul style="padding-left:18px;margin:0">${proximos
          .map((d) => `<li><strong>${fechaLarga(d.ficha!.fecha_vencimiento!)}</strong> (${enCuanto(d.ficha!.fecha_vencimiento!, hoy)}): ${enlace(d)} · ${escapar(accionSugerida(d))}</li>`)
          .join("")}</ul>`
      : "Nada de tus documentos vence en los próximos 60 días. 🎉";
    await enviarCorreo("📅 Lo que vence en los próximos 60 días", plantilla("Resumen del mes", [bloque], app));
    enviados.push(`resumen: ${proximos.length}`);
  }
  return NextResponse.json({ ok: true, hoy, enviados });
}
