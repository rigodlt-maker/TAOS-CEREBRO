import { createECDH, createHmac } from "node:crypto";
import webpush from "web-push";
import type { Repo } from "./datos/repo";
import { fechaLarga } from "./fechas";
import type { Documento } from "./tipos";

// Lo que aparece en la notificación del celular. "etiqueta" hace que un aviso nuevo reemplace al anterior del mismo tema.
export type AvisoPush = { titulo: string; cuerpo: string; url?: string; etiqueta?: string };

// Llaves VAPID: identifican a la app ante el servicio de notificaciones del celular (Google, Apple o Mozilla).
// Se derivan de SUPABASE_SECRET_KEY para que no haya que configurar nada más en Vercel.
export function llavesVapid(): { publica: string; privada: string } | null {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return { publica: process.env.VAPID_PUBLIC_KEY, privada: process.env.VAPID_PRIVATE_KEY };
  const base = process.env.SUPABASE_SECRET_KEY;
  return base ? llavesDesde(base) : null;
}

export function llavesDesde(base: string): { publica: string; privada: string } {
  // Casi nunca pasa, pero si los 32 bytes no son una llave P-256 válida se prueba con el siguiente número
  for (let i = 0; ; i++) {
    const privada = createHmac("sha256", base).update(`taos:vapid:${i}`).digest();
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(privada);
      return { publica: ecdh.getPublicKey().toString("base64url"), privada: privada.toString("base64url") };
    } catch {
      continue;
    }
  }
}

export const pushDisponible = () => llavesVapid() !== null;

// Manda el aviso a todos los celulares suscritos. Nunca lanza error: si falla, el correo y la sincronización siguen.
export async function enviarPush(repo: Repo, avisos: AvisoPush | AvisoPush[]): Promise<{ enviados: number; fallidos: number }> {
  const lista = (Array.isArray(avisos) ? avisos : [avisos]).slice(0, 6);
  const llaves = llavesVapid();
  const resultado = { enviados: 0, fallidos: 0 };
  if (!llaves || !lista.length) return resultado;
  const suscripciones = await repo.suscripcionesPush().catch((e) => {
    console.error("Push:", e);
    return [];
  });
  const vapidDetails = {
    subject: process.env.ALLOWED_EMAIL ? `mailto:${process.env.ALLOWED_EMAIL}` : "mailto:avisos@example.com",
    publicKey: llaves.publica,
    privateKey: llaves.privada,
  };
  for (const s of suscripciones) {
    for (const aviso of lista) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(aviso), {
          vapidDetails,
          TTL: 24 * 3600,
          urgency: "high",
        });
        resultado.enviados++;
      } catch (e) {
        resultado.fallidos++;
        const codigo = (e as { statusCode?: number }).statusCode;
        // 404 o 410: el celular ya no acepta avisos (desinstalaste la app o quitaste el permiso)
        if (codigo === 404 || codigo === 410) {
          await repo.borrarSuscripcionPush(s.endpoint).catch(() => {});
          break;
        }
        console.error("Push:", codigo, (e as Error).message);
      }
    }
  }
  return resultado;
}

// ---------- Textos de los avisos ----------

const enDias = (dias: number) => (dias === 0 ? "vence hoy" : dias === 1 ? "vence mañana" : `vence en ${dias} días`);

export function avisosDeVencimiento(avisos: { doc: Documento; dias: number }[], accion: (d: Documento) => string): AvisoPush[] {
  return avisos.map(({ doc, dias }) => ({
    titulo: `⏰ ${doc.tipo_documento ?? doc.nombre} ${enDias(dias)}`,
    cuerpo: `${fechaLarga(doc.ficha!.fecha_vencimiento!)}. ${accion(doc)}`,
    url: `/documentos/${doc.id}`,
    etiqueta: `vence-${doc.id}`,
  }));
}

export function avisoDocumentoNuevo(id: string, nombre: string, tipo: string | undefined): AvisoPush {
  const conocido = tipo && tipo !== "Documento";
  return {
    titulo: conocido ? `📄 Nuevo en tu cerebro: ${tipo}` : "📄 Nuevo documento en tu cerebro",
    cuerpo: `${nombre} ya se leyó desde Google Drive.${conocido ? "" : " Revisa su categoría."}`,
    url: `/documentos/${id}`,
    etiqueta: `doc-${id}`,
  };
}
