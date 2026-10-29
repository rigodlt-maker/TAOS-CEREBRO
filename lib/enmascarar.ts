// Nunca se muestran números completos de identificación, cuentas o tarjetas: solo los últimos 4.

export function ultimos4(valor: string): string {
  const limpio = valor.replace(/[^A-Za-z0-9]/g, "");
  return limpio.length <= 4 ? limpio : `•••• ${limpio.slice(-4)}`;
}

const CURP = /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/g;
const RFC = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/g;
// 10 dígitos o más (cuentas, tarjetas, CLABE, pólizas largas), con o sin espacios y guiones
const NUMERO_LARGO = /(?<![\dA-Za-z])\d(?:[ -]?\d){9,}(?![\dA-Za-z])/g;
// Los teléfonos sí se muestran completos: son para llamar
const ANTES_DE_TELEFONO = /(tel[eé]fono|tel\.?|llam[ae]|marca|whats ?app|cabina|lada|cel(ular)?|contacto|atenci[oó]n)[^\n]{0,25}$/i;

export function enmascarar(texto: string): string {
  return texto
    .replace(CURP, (c) => ultimos4(c))
    .replace(RFC, (r) => ultimos4(r))
    .replace(NUMERO_LARGO, (n, pos: number, todo: string) => {
      const digitos = n.replace(/\D/g, "");
      const esTelefono = digitos.length <= 12 && (ANTES_DE_TELEFONO.test(todo.slice(Math.max(0, pos - 40), pos)) || /^(800|01800|52)/.test(digitos));
      return esTelefono ? n : ultimos4(digitos);
    });
}
