const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function dinero(n: number): string {
  return pesos.format(n);
}
