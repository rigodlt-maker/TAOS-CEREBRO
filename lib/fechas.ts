// Fechas en español de México: 15/03/2027, 15-mar-2027, 15 de marzo de 2027, 2027-03-15

export const ZONA = "America/Mexico_City";

const MESES: Record<string, number> = {
  enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6,
  julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sept: 9, sep: 9, set: 9, octubre: 10, oct: 10,
  noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};
const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const MES = "(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic)";
const PATRONES = [
  new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?${MES}\\.?\\s*(?:de(?:l)?\\s+)?(\\d{4})\\b`, "gi"),
  new RegExp(`\\b(\\d{1,2})[/\\-.]${MES}[/\\-.](\\d{2,4})\\b`, "gi"),
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g,
  // Recibos: "30 SEP 26"
  new RegExp(`\\b(\\d{1,2})\\s+${MES}\\.?\\s+(\\d{2})\\b`, "gi"),
];

export type FechaEncontrada = { fecha: string; inicio: number; fin: number };

function armar(a: number, m: number, d: number): string | null {
  if (a < 100) a += 2000;
  if (a < 1900 || a > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCMonth() !== m - 1) return null;
  return f.toISOString().slice(0, 10);
}

// Todas las fechas de un texto, en orden de aparición
export function buscarFechas(texto: string): FechaEncontrada[] {
  const encontradas: FechaEncontrada[] = [];
  PATRONES.forEach((patron, i) => {
    for (const m of texto.matchAll(patron)) {
      const fecha =
        i === 2
          ? armar(+m[1], +m[2], +m[3])
          : i === 3
            ? armar(+m[3], +m[2], +m[1])
            : armar(+m[3], MESES[m[2].toLowerCase()], +m[1]);
      const inicio = m.index ?? 0;
      const fin = inicio + m[0].length;
      if (fecha && !encontradas.some((e) => inicio < e.fin && fin > e.inicio)) encontradas.push({ fecha, inicio, fin });
    }
  });
  return encontradas.sort((a, b) => a.inicio - b.inicio);
}

export function hoyEnMexico(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}

export function sumarMeses(fecha: string, meses: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1 + meses, d));
  return f.toISOString().slice(0, 10);
}

export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} de ${NOMBRES_MES[m - 1]} de ${a}`;
}

export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return `${d} ${NOMBRES_MES[m - 1].slice(0, 3)} ${a}`;
}

// "vence en 12 días", "venció hace 3 días", "vence hoy"
export function enCuanto(fecha: string, hoy: string): string {
  const dias = diasEntre(hoy, fecha);
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias > 0) return `vence en ${dias} días`;
  return dias === -1 ? "venció ayer" : `venció hace ${-dias} días`;
}
