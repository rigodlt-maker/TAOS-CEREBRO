// Service worker: permite instalar la app en el celular y recibe las notificaciones push.
// No guarda nada sin conexión: cada vez se piden los datos frescos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Bandeja de avisos (la campana 🔔 de la app): se guardan los últimos 30 en este celular, sin servidor
const BANDEJA = "bandeja-avisos";
async function guardarAviso(aviso) {
  try {
    const c = await caches.open(BANDEJA);
    const r = await c.match("/__avisos");
    const lista = r ? await r.json() : [];
    lista.unshift({ titulo: aviso.titulo || "", cuerpo: aviso.cuerpo || "", url: aviso.url || "/", fecha: Date.now() });
    await c.put("/__avisos", new Response(JSON.stringify(lista.slice(0, 30)), { headers: { "Content-Type": "application/json" } }));
    for (const v of await self.clients.matchAll({ type: "window" })) v.postMessage({ tipo: "taos-aviso" });
  } catch {}
}

// Llega un aviso del servidor: { titulo, cuerpo, url, etiqueta }
self.addEventListener("push", (evento) => {
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { cuerpo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(guardarAviso(aviso));
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || "Cerebro", {
      body: aviso.cuerpo || "",
      icon: "/icono-192.png",
      badge: "/icono-192.png",
      tag: aviso.etiqueta || undefined,
      renotify: !!aviso.etiqueta,
      data: { url: aviso.url || "/" },
    }),
  );
});

// Al tocar la notificación se abre la app en la pantalla del aviso (o se reutiliza la ventana abierta)
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.startsWith(self.location.origin));
      if (abierta) return abierta.focus().then((v) => v.navigate(destino)).catch(() => self.clients.openWindow(destino));
      return self.clients.openWindow(destino);
    }),
  );
});

// El navegador renovó la suscripción por su cuenta: se avisa al servidor para no perder los avisos
self.addEventListener("pushsubscriptionchange", (evento) => {
  const anterior = evento.oldSubscription;
  evento.waitUntil(
    (evento.newSubscription
      ? Promise.resolve(evento.newSubscription)
      : self.registration.pushManager.subscribe(anterior.options)
    ).then((nueva) =>
      fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anterior: anterior && anterior.endpoint, suscripcion: nueva.toJSON() }),
      }),
    ),
  );
});
