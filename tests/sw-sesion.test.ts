import assert from "node:assert/strict";
import test from "node:test";
import { swDePrueba } from "./ayuda/sw";

test("S15-P: después de cerrar sesión, un aviso nuevo no se guarda en la bandeja ni muestra su contenido", async () => {
  const sw = swDePrueba();
  await sw.mensaje("taos-con-sesion");
  await sw.push({ titulo: "Documento nuevo", cuerpo: "INE leída" });
  assert.equal(sw.bandeja().length, 1);
  // Cierra sesión: se borra la bandeja y se cierran las notificaciones a la vista
  await sw.mensaje("taos-sin-sesion");
  assert.equal(sw.almacen.has("bandeja-avisos"), false);
  assert.ok(sw.mostradas.every((n) => n.cerrada));
  // Llega otro aviso sin sesión: genérico y la bandeja NO se vuelve a crear
  await sw.push({ titulo: "Pasaporte por vencer", cuerpo: "Tu pasaporte vence el 3 dic" });
  assert.equal(sw.almacen.has("bandeja-avisos"), false);
  const ultima = sw.mostradas.at(-1)!;
  assert.equal(ultima.titulo, "Cerebro");
  assert.doesNotMatch(ultima.opciones.body ?? "", /pasaporte|vence/i);
  // Vuelve a entrar: los avisos se guardan otra vez
  await sw.mensaje("taos-con-sesion");
  await sw.push({ titulo: "Cobro", cuerpo: "Juan te debe $500.00" });
  assert.equal(sw.bandeja().length, 1);
});

test("S15-P: si el celular no sabe si hay sesión (instalación vieja, sin anotar), se comporta como antes", async () => {
  const sw = swDePrueba();
  await sw.push({ titulo: "Pago", cuerpo: "x" });
  assert.equal(sw.bandeja().length, 1);
});
