// TAOS funciona sin IA de pago: la clasificación y las respuestas se hacen con reglas (lib/extraer.ts y lib/responder.ts).
// Estas funciones se quedan para que el resto del código no cambie, pero nunca llaman a un servicio externo.
import type { Categoria, Ficha, Pagina } from "./tipos";

const SIN_IA = "Esta función no está disponible: TAOS funciona sin IA de pago.";

export function iaDisponible(): boolean {
  return false;
}

export async function extraerConIA(_paginas: Pagina[], _nombre: string): Promise<{ categoria: Categoria; tipo_documento: string; ficha: Ficha }> {
  throw new Error(SIN_IA);
}

// eslint-disable-next-line require-yield
export async function* responderConIA(_pregunta: string, _contexto: string, _hoy: string): AsyncGenerator<string> {
  throw new Error(SIN_IA);
}
