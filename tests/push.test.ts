// Notificaciones push: llaves VAPID, textos de los avisos y suscripciones en modo demostración
import assert from "node:assert/strict";
import { test } from "node:test";
import webpush from "web-push";
import { repoMemoria } from "../lib/datos/memoria";
import { avisoDocumentoNuevo, avisosDeVencimiento, enviarPush, llavesDesde } from "../lib/push";
import type { Documento } from "../lib/tipos";

test("las llaves VAPID se derivan igual que en Finanzas y sirven para web-push", () => {
  const a = llavesDesde("sb_secret_inventada_123");
  assert.deepEqual(a, llavesDesde("sb_secret_inventada_123"));
  assert.equal(Buffer.from(a.publica, "base64url").length, 65);
  assert.doesNotThrow(() => webpush.setVapidDetails("mailto:prueba@example.com", a.publica, a.privada));
});

test("textos de los avisos", () => {
  const doc = { id: "d1", nombre: "Póliza auto", tipo_documento: "Póliza de seguro", ficha: { fecha_vencimiento: "2026-11-04" } } as unknown as Documento;
  const [aviso] = avisosDeVencimiento([{ doc, dias: 7 }], () => "Renueva la póliza.");
  assert.equal(aviso.titulo, "⏰ Póliza de seguro vence en 7 días");
  assert.match(aviso.cuerpo, /Renueva la póliza\./);
  assert.equal(aviso.url, "/documentos/d1");
  assert.equal(avisoDocumentoNuevo("d2", "INE frente.pdf", "Identificación oficial").titulo, "📄 Nuevo en tu cerebro: Identificación oficial");
  assert.match(avisoDocumentoNuevo("d3", "scan.pdf", "Documento").cuerpo, /Revisa su categoría/);
});

test("suscripciones en modo demostración y envío sin llaves", async () => {
  const repo = repoMemoria();
  const sub = { endpoint: "https://push.example.com/abc", p256dh: "x", auth: "y", dispositivo: null };
  await repo.guardarSuscripcionPush(sub);
  await repo.guardarSuscripcionPush({ ...sub, auth: "z" });
  assert.deepEqual((await repo.suscripcionesPush()).map((s) => s.auth), ["z"]);
  const antes = { ...process.env };
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  assert.deepEqual(await enviarPush(repo, { titulo: "x", cuerpo: "y" }), { enviados: 0, fallidos: 0 });
  Object.assign(process.env, antes);
  await repo.borrarSuscripcionPush(sub.endpoint);
  assert.equal((await repo.suscripcionesPush()).length, 0);
});
