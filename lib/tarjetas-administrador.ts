// "¿Cuándo corta mi tarjeta Plata?": Segundo Cerebro también sabe de tus tarjetas, porque las registraste
// en Administrador Tao (mismo Supabase, misma cuenta). Solo las lee; los montos y pagos siguen en Administrador Tao.
import type { TarjetaAdministrador } from "./datos/repo";
import { plano } from "./extraer";
import { fechaLarga } from "./fechas";
import { conOpciones } from "./opciones";

const PIDE = /\b(corta|corte|cortan|fecha limite|limite de pago|cuando (pago|tengo que pagar|se paga|hay que pagar)|dia de pago)\b/;

// Próxima fecha (hoy o después) que cae en ese día del mes; si el mes es más corto, el último día del mes
export function proximoDia(dia: number, hoy: string): string {
  const [a, m, d] = hoy.split("-").map(Number);
  const fecha = (anio: number, mes: number) => {
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    return `${anio}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
  };
  const esteMes = fecha(a, m);
  if (Number(esteMes.slice(8)) >= d) return esteMes;
  return m === 12 ? fecha(a + 1, 1) : fecha(a, m + 1);
}

export function respuestaTarjetas(pregunta: string, tarjetas: TarjetaAdministrador[], hoy: string): string | null {
  const p = plano(pregunta);
  if (!tarjetas.length || !PIDE.test(p)) return null;
  const mencionadas = tarjetas.filter((t) => {
    const n = plano(t.nombre);
    return n.length >= 2 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(p);
  });
  // Una tarjeta sin nombre ("mi tarjeta") se contesta con tu estado de cuenta; "mis tarjetas" las lista todas
  const habla = /\btarjetas\b/.test(p);
  if (!mencionadas.length && !habla) return null;

  const linea = (t: TarjetaAdministrador) => {
    const corte = t.dia_corte ? `corta el día **${t.dia_corte}** (próximo: ${fechaLarga(proximoDia(t.dia_corte, hoy))})` : "no tiene día de corte registrado";
    const pago = t.dia_limite_pago ? `y la fecha límite de pago es el día **${t.dia_limite_pago}** (próxima: ${fechaLarga(proximoDia(t.dia_limite_pago, hoy))})` : "";
    return `- **${t.nombre}** ${corte} ${pago}`.trim();
  };
  const lista = mencionadas.length ? mencionadas : tarjetas;
  const texto = `${lista.map(linea).join("\n")}\n\nDato de tu Administrador Tao. Para saber **cuánto** pagar, pregúntale ahí a Tao.`;
  // Si no dijiste cuál, te ofrezco cada tarjeta como botón
  return mencionadas.length ? texto : conOpciones(texto, tarjetas.slice(0, 4).map((t) => `¿Cuándo corta mi ${t.nombre}?`));
}
