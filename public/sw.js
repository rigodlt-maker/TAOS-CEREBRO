// Service worker: permite instalar la app en el celular y recibe las notificaciones push.
// No guarda nada sin conexión: cada vez se piden los datos frescos.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// Bandeja de avisos (la campana 🔔 de la app): se guardan los últimos 30 en este celular, sin servidor
const BANDEJA = "bandeja-avisos";
// vigente(): la sesión sigue siendo la misma que cuando llegó el aviso. Si deja de serlo, no se escribe nada y lo
// que alcanzó a escribirse se borra (un cierre de sesión pudo borrar la bandeja justo antes de esta escritura).
// Abrir una caché la crea: si la sesión cambió y quedó «fuera», se borra lo que se haya creado o escrito.
async function soltarBandeja() {
  if (await sinSesion()) await caches.delete(BANDEJA);
  return false;
}
async function guardarAviso(aviso, vigente = () => true) {
  try {
    if (!vigente()) return false;
    const c = await caches.open(BANDEJA);
    if (!vigente()) return soltarBandeja();
    const r = await c.match("/__avisos");
    const lista = r ? await r.json() : [];
    lista.unshift({ titulo: aviso.titulo || "", cuerpo: aviso.cuerpo || "", url: aviso.url || "/", fecha: Date.now() });
    if (!vigente()) return soltarBandeja();
    await c.put("/__avisos", new Response(JSON.stringify(lista.slice(0, 30)), { headers: { "Content-Type": "application/json" } }));
    if (!vigente()) return soltarBandeja();
    for (const v of await self.clients.matchAll({ type: "window" })) v.postMessage({ tipo: "taos-aviso" });
    return true;
  } catch {
    return false;
  }
}

// Sin sesión (pantalla de entrada o cierre de sesión): se borra la bandeja, se cierran las notificaciones a la vista
// y queda anotado "sin sesión": un aviso que llegue así NO se guarda y se muestra sin contenido (S15-P).
const ESTADO = "estado-sesion";
async function anotarSesion(dentro) {
  try {
    await (await caches.open(ESTADO)).put("/__sesion", new Response(dentro ? "dentro" : "fuera"));
  } catch {}
}
async function sinSesion() {
  try {
    const r = await (await caches.open(ESTADO)).match("/__sesion");
    return r ? (await r.text()) === "fuera" : false;
  } catch {
    return true;
  }
}
async function limpiarSinSesion() {
  await anotarSesion(false);
  await caches.delete(BANDEJA);
  try {
    for (const n of await self.registration.getNotifications()) n.close();
  } catch {}
  for (const v of await self.clients.matchAll({ type: "window" })) v.postMessage({ tipo: "taos-aviso" });
}
// S15-P (carrera): «vuelta» cambia EN EL MISMO INSTANTE en que llega el aviso de entrar o salir, antes de cualquier espera.
// Un push que empezó antes guarda su vuelta y la revisa antes y después de cada paso: si cambió, no escribe la bandeja
// (y si alcanzó a escribirla, la borra) ni deja a la vista su notificación con contenido.
let vuelta = 0;
self.addEventListener("message", (evento) => {
  if (evento.data && evento.data.tipo === "taos-sin-sesion") {
    vuelta++;
    evento.waitUntil(limpiarSinSesion());
  }
  if (evento.data && evento.data.tipo === "taos-con-sesion") {
    vuelta++;
    evento.waitUntil(anotarSesion(true));
  }
});

// Llega un aviso del servidor: { titulo, cuerpo, url, etiqueta }
self.addEventListener("push", (evento) => {
  const mia = vuelta; // se toma al instante, antes de cualquier espera
  const vigente = () => vuelta === mia;
  let aviso = {};
  try {
    aviso = evento.data ? evento.data.json() : {};
  } catch {
    aviso = { cuerpo: evento.data ? evento.data.text() : "" };
  }
  const generico = () =>
    self.registration.showNotification("Cerebro", { body: "Tienes un aviso nuevo. Entra a tu app para verlo.", icon: "/icono-192.png", badge: "/icono-192.png", tag: "taos-sin-sesion", data: { url: "/" } });
  evento.waitUntil(
    sinSesion().then(async (fuera) => {
      // Sin sesión, o la sesión cambió mientras tanto: aviso genérico, sin guardarlo ni mostrar de qué se trata (S15-P)
      if (fuera || !vigente()) return generico();
      await guardarAviso(aviso, vigente);
      if (!vigente()) return generico();
      await self.registration.showNotification(aviso.titulo || "Cerebro", {
        body: aviso.cuerpo || "",
        icon: "/icono-192.png",
        badge: "/icono-192.png",
        tag: aviso.etiqueta || undefined,
        renotify: !!aviso.etiqueta,
        data: { url: aviso.url || "/", vuelta: mia },
      });
      // Si se cerró sesión mientras se mostraba, se quita: no queda nada privado a la vista
      if (!vigente()) {
        try {
          for (const n of await self.registration.getNotifications()) if (n.data && n.data.vuelta === mia) n.close();
        } catch {}
        return generico();
      }
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
