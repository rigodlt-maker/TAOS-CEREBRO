// Extracción de datos clave con reglas (sin IA). Regla de oro: si un dato no aparece, queda como
// "no especificado" (null). Nunca se completa con suposiciones.
import { enmascarar, ultimos4 } from "./enmascarar";
import { buscarFechas, sumarMeses } from "./fechas";
import type { Categoria, Ficha, Pagina } from "./tipos";

// Minúsculas y sin acentos, con la misma longitud que el original (para recortar del texto original)
export function plano(texto: string): string {
  return texto
    .normalize("NFC")
    .split("")
    .map((c) => c.normalize("NFD").replace(/[̀-ͯ]/g, "") || c)
    .join("")
    .toLowerCase();
}

type Regla = { patron: RegExp; categoria: Categoria; tipo: string | ((t: string) => string) };

const tipoDePoliza = (t: string) =>
  /automovil|\bauto\b|vehiculo|placas|camioneta/.test(t)
    ? "Póliza de seguro de auto"
    : /gastos medicos|\bgmm\b/.test(t)
      ? "Póliza de gastos médicos"
      : /enfermedades graves|cancer|padecimientos graves/.test(t)
        ? "Póliza de enfermedades graves"
      : /apoyo hospitalario|indemnizacion diaria|hospitalizacion/.test(t)
        ? "Póliza de apoyo hospitalario"
      : /viaje|travel|asistencia en viaje/.test(t)
        ? "Seguro de viaje"
      : /seguro de vida|\bvida\b/.test(t)
        ? "Póliza de seguro de vida"
        : /hogar|casa habitacion|danos a la vivienda/.test(t)
          ? "Póliza de seguro de hogar"
          : "Póliza de seguro";

// El orden importa: gana la primera regla que coincide
const REGLAS: Regla[] = [
  { patron: /constancia de situacion fiscal|cedula de identificacion fiscal/, categoria: "Finanzas e impuestos", tipo: "Constancia de situación fiscal" },
  { patron: /(servicio|mantenimiento|afinacion|verificacion).{0,40}(nissan|versa|toyota|honda|mazda|volkswagen|chevrolet|kia|hyundai|ford)|serie de unidad|inspeccion (complementaria )?multi.?puntos/, categoria: "Vehículos", tipo: "Servicio del auto" },
  { patron: /\btitulo\b.{0,200}(licenciatura|universidad|otorgad)|aprobo por unanimidad la evaluacion/, categoria: "Identidad y trámites", tipo: (t) => (/cedula profesional/.test(t) ? "" : "Título profesional") },
  { patron: /constancia de vigencia de derechos|vigencia de derechos/, categoria: "Salud", tipo: "Constancia de vigencia de derechos (IMSS)" },
  { patron: /travel protection|seguro de viaje|asistencia en viaje/, categoria: "Seguros", tipo: (t) => (/condiciones generales/.test(t) ? "Condiciones generales del seguro" : "Seguro de viaje") },
  { patron: /precalificacion|precalificado|\bpreca\b|credito hipotecario|infonavit|fovissste|fovisste/, categoria: "Finanzas e impuestos", tipo: "Precalificación de crédito" },
  { patron: /acta de nacimiento/, categoria: "Identidad y trámites", tipo: "Acta de nacimiento" },
  { patron: /asignacion o localizacion de numero de seguridad social|tarjeta de numero de seguridad social|^nss\b/, categoria: "Identidad y trámites", tipo: "Número de Seguridad Social (NSS)" },
  { patron: /visa de no inmigrante|nonimmigrant|\bvnusa|^visa\b|\bvisa (eua|usa|americana|estadounidense|de estados unidos)/, categoria: "Identidad y trámites", tipo: "Visa" },
  { patron: /certificado (total )?de estudios|historial academico|kardex/, categoria: "Identidad y trámites", tipo: "Certificado de estudios" },
  { patron: /expide el (presente )?titulo|otorga el titulo|confiere el titulo|titulo de (licenciad|ingenier|maestr)/, categoria: "Identidad y trámites", tipo: "Título profesional" },
  { patron: /orden de (servicio|reparacion)|servicio de mantenimiento|mantenimiento preventivo|kilometraje/, categoria: "Vehículos", tipo: "Servicio del auto" },
  { patron: /infonavit|fovissste/, categoria: "Finanzas e impuestos", tipo: "Precalificación de crédito" },
  { patron: /certificado de vacunacion|comprobante de vacunacion|vacuna/, categoria: "Salud", tipo: "Comprobante de vacunación" },
  { patron: /informe medico|nota medica|resumen clinico|historia clinica/, categoria: "Salud", tipo: "Informe médico" },
  { patron: /condiciones generales/, categoria: "Seguros", tipo: "Condiciones generales del seguro" },
  { patron: /calendario (de actividades|escolar|academico)/, categoria: "Identidad y trámites", tipo: "Calendario de actividades" },
  { patron: /tarjeta de circulacion/, categoria: "Vehículos", tipo: "Tarjeta de circulación" },
  { patron: /verificacion vehicular|holograma|centro de verificacion/, categoria: "Vehículos", tipo: "Verificación vehicular" },
  { patron: /tenencia|refrendo vehicular|control vehicular/, categoria: "Vehículos", tipo: "Tenencia o refrendo" },
  { patron: /licencia de (conducir|manejo|chofer|automovilista)/, categoria: "Vehículos", tipo: "Licencia de conducir" },
  { patron: /poliza de garantia|certificado de garantia|garantia (limitada|del producto|de fabrica)|tiempo de garantia/, categoria: "Hogar", tipo: "Garantía" },
  { patron: /poliza|aseguradora|suma asegurada|prima (neta|total)|condiciones generales del seguro/, categoria: "Seguros", tipo: tipoDePoliza },
  { patron: /factura/, categoria: "Vehículos", tipo: (t) => (/numero de (serie|motor)|\bvin\b|modelo \d{4}/.test(t) ? "Factura del auto" : "") },
  { patron: /contrato de (arrendamiento|renta)|arrendador|arrendatario/, categoria: "Contratos", tipo: "Contrato de renta" },
  { patron: /contrato de (prestacion de )?servicios/, categoria: "Contratos", tipo: "Contrato de servicios" },
  { patron: /contrato/, categoria: "Contratos", tipo: "Contrato" },
  { patron: /credencial para votar|instituto nacional electoral/, categoria: "Identidad y trámites", tipo: "INE" },
  { patron: /pasaporte/, categoria: "Identidad y trámites", tipo: "Pasaporte" },
  { patron: /clave unica de registro de poblacion|\bcurp\b/, categoria: "Identidad y trámites", tipo: "CURP" },
  { patron: /acta de nacimiento/, categoria: "Identidad y trámites", tipo: "Acta de nacimiento" },
  { patron: /acta de matrimonio/, categoria: "Identidad y trámites", tipo: "Acta de matrimonio" },
  { patron: /cedula profesional|titulo profesional/, categoria: "Identidad y trámites", tipo: "Cédula o título profesional" },
  { patron: /constancia de situacion fiscal/, categoria: "Finanzas e impuestos", tipo: "Constancia de situación fiscal" },
  { patron: /receta|diagnostico|laboratorio|analisis clinico|hospital|clinica|vacuna|consulta medica/, categoria: "Salud", tipo: "Documento médico" },
  { patron: /predial/, categoria: "Hogar", tipo: "Predial" },
  { patron: /escritura publica|escrituras/, categoria: "Hogar", tipo: "Escrituras" },
  { patron: /comision federal de electricidad|\bcfe\b/, categoria: "Hogar", tipo: "Recibo de luz" },
  { patron: /agua potable|servicio de agua/, categoria: "Hogar", tipo: "Recibo de agua" },
  { patron: /comprobante de domicilio/, categoria: "Identidad y trámites", tipo: "Comprobante de domicilio" },
  { patron: /declaracion anual|\bsat\b|servicio de administracion tributaria|\bcfdi\b|factura/, categoria: "Finanzas e impuestos", tipo: "Documento fiscal" },
  { patron: /estado de cuenta/, categoria: "Finanzas e impuestos", tipo: "Estado de cuenta" },
];

const GENERICOS = new Set(["Contrato", "Documento médico", "Documento fiscal", "Póliza de seguro", "Documento"]);

function primeraRegla(t: string): { categoria: Categoria; tipo_documento: string } | null {
  for (const r of REGLAS) {
    if (!r.patron.test(t)) continue;
    const tipo = typeof r.tipo === "string" ? r.tipo : r.tipo(t);
    if (tipo) return { categoria: r.categoria, tipo_documento: tipo };
  }
  return null;
}

// Solo por el nombre del archivo ("Acta de nacimiento.pdf"): null si el nombre no dice qué es
export function clasificarPorNombre(nombre: string): { categoria: Categoria; tipo_documento: string } | null {
  const n = plano(nombre).replace(/\.(pdf|jpe?g|png|heic|docx?|txt)$/, "").replace(/[_-]+/g, " ").trim();
  const r = n ? primeraRegla(n) : null;
  // Un nombre que solo dice algo genérico ("contrato", "factura") no decide: mejor el contenido
  return r && !GENERICOS.has(r.tipo_documento) ? r : null;
}

// Primero el nombre del archivo (suele ser lo más claro); si no dice qué es, el contenido
export function clasificar(texto: string, nombre = ""): { categoria: Categoria; tipo_documento: string } {
  return clasificarPorNombre(nombre) ?? primeraRegla(plano(`${nombre}\n${texto.slice(0, 6000)}`)) ?? { categoria: "Notas personales", tipo_documento: "Documento" };
}

// Primera fecha que aparece poco después de alguna etiqueta
function fechaTrasEtiqueta(texto: string, p: string, etiqueta: RegExp, alcance = 70): string | null {
  for (const m of p.matchAll(new RegExp(etiqueta.source, "g"))) {
    const desde = (m.index ?? 0) + m[0].length;
    const f = buscarFechas(texto.slice(desde, desde + alcance))[0];
    if (f) return f.fecha;
  }
  return null;
}

const ETIQUETAS_INICIO = /inicio de (la )?vigencia|vigencia desde|a partir del?|desde el|desde las \d{1,2}(:\d{2})? ?(hrs?|horas)? del|fecha de inicio|fecha de emision|fecha de expedicion|expedid[oa] el|fecha de compra|fecha de nacimiento|celebrado el|firmado el/;
const ETIQUETAS_FIN = /fin de (la )?vigencia|vigencia hasta|vigente hasta|vigente:|valid[oa] hasta|vence|vencimiento|expira|caduca|caducidad|expiration date|expiry|expires|valid until|hasta el|hasta las \d{1,2}(:\d{2})? ?(hrs?|horas)? del|fecha de termino|termina el|concluye el|fecha limite/;

function fechas(texto: string, p: string, condiciones: string[]) {
  let inicio = fechaTrasEtiqueta(texto, p, ETIQUETAS_INICIO);
  let fin = fechaTrasEtiqueta(texto, p, ETIQUETAS_FIN);
  // "Vigencia: del 01/01/2026 al 01/01/2027"
  if (!inicio || !fin) {
    for (const m of p.matchAll(/vigencia|periodo (de cobertura|del contrato)|plazo/g)) {
      const desde = m.index ?? 0;
      const dos = buscarFechas(texto.slice(desde, desde + 140));
      if (dos.length >= 2) {
        inicio ??= dos[0].fecha;
        fin ??= dos[1].fecha;
        break;
      }
    }
  }
  // Garantía por meses o años desde la compra: el vencimiento se calcula con datos del propio documento
  if (inicio && !fin) {
    const g = p.match(/garantia (de|por) (\d{1,2}) (mes|meses|ano|anos)/);
    if (g) {
      const meses = +g[2] * (g[3].startsWith("a") ? 12 : 1);
      fin = sumarMeses(inicio, meses);
      condiciones.push(`Garantía de ${g[2]} ${g[3].replace("an", "añ")} desde el ${inicio} (vencimiento calculado).`);
    }
  }
  if (inicio && fin && fin < inicio) [inicio, fin] = [fin, inicio];
  return { inicio, fin };
}

const ETIQUETA_REFERENCIA =
  /(no\.?|numero|num\.?|n°|#)?\s*(de\s+)?(poliza|contrato|folio|serie|cuenta|cliente|credito|expediente|certificado)\s*(no\.?|numero|num\.?|n°|#)?\s*[:#]?\s*/g;

function referencia(texto: string, p: string): string | null {
  for (const m of p.matchAll(ETIQUETA_REFERENCIA)) {
    const desde = (m.index ?? 0) + m[0].length;
    const token = texto.slice(desde, desde + 40).match(/^[A-Za-z0-9][A-Za-z0-9\-/]{3,30}/)?.[0];
    if (token && /\d/.test(token) && token.replace(/\D/g, "").length >= 4) return ultimos4(token);
  }
  return null;
}

const ETIQUETAS_MONTO: [RegExp, string][] = [
  [/prima total|importe total a pagar|total a pagar/, "Prima total"],
  [/prima neta/, "Prima neta"],
  [/suma asegurada/, "Suma asegurada"],
  [/deducible/, "Deducible"],
  [/renta mensual|(la|una) renta de|importe de la renta/, "Renta mensual"],
  [/deposito en garantia|deposito/, "Depósito"],
  [/mensualidad|pago mensual/, "Pago mensual"],
  [/coaseguro/, "Coaseguro"],
  [/precio|costo|importe|monto/, "Monto"],
];
const DINERO = /^[^\n$\d]{0,30}?(\$|mxn|m\.n\.)?\s?((\d{1,3}(,\d{3})+|\d+)(\.\d{2})?)\s?(mxn|m\.n\.|pesos)?/i;

function montos(texto: string, p: string): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const [etiqueta, nombre] of ETIQUETAS_MONTO) {
    if (salida[nombre] !== undefined) continue;
    for (const m of p.matchAll(new RegExp(etiqueta.source, "g"))) {
      const desde = (m.index ?? 0) + m[0].length;
      const d = texto.slice(desde, desde + 60).match(DINERO);
      // Debe parecer dinero: con signo de pesos, "pesos"/"MXN", comas de miles o centavos
      if (!d || !(d[1] || d[6] || d[4] || d[5])) continue;
      const valor = Number(d[2].replace(/,/g, ""));
      if (valor > 0) {
        salida[nombre] = valor;
        break;
      }
    }
    if (Object.keys(salida).length >= 6) break;
  }
  return salida;
}

const ETIQUETAS_PARTES: [RegExp, string][] = [
  [/asegurado\s*:/, "Asegurado"],
  [/contratante\s*:/, "Contratante"],
  [/titular\s*:/, "Titular"],
  [/arrendador\s*:|el arrendador,?\s/, "Arrendador"],
  [/arrendatario\s*:|el arrendatario,?\s/, "Arrendatario"],
  [/proveedor\s*:|prestador del servicio\s*:/, "Proveedor"],
  [/cliente\s*:|nombre del cliente\s*:/, "Cliente"],
  [/beneficiario\s*:/, "Beneficiario"],
];
const ASEGURADORAS = ["qualitas", "gnp", "axa", "mapfre", "chubb", "hdi", "zurich", "metlife", "allianz", "banorte", "inbursa", "seguros atlas", "ana seguros", "afirme", "sura", "bupa", "seguros monterrey", "plan seguro", "potosi"];

function partes(texto: string, p: string): string | null {
  const encontradas: string[] = [];
  for (const [etiqueta, nombre] of ETIQUETAS_PARTES) {
    const m = p.match(etiqueta);
    if (!m) continue;
    const desde = (m.index ?? 0) + m[0].length;
    const valor = texto
      .slice(desde, desde + 80)
      .split(/\n|\s{3,}|[,;]|\b(?:RFC|CURP|Domicilio|Direcci[oó]n|Tel[eé]fono)\b/i)[0]
      .trim();
    if (valor.length >= 3 && /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}/.test(valor)) encontradas.push(`${nombre}: ${enmascarar(valor)}`);
  }
  const aseguradora = ASEGURADORAS.find((a) => new RegExp(`\\b${a}\\b`).test(p));
  if (aseguradora) encontradas.push(`Aseguradora: ${aseguradora.replace(/\b\w/g, (l) => l.toUpperCase())}`);
  return encontradas.length ? [...new Set(encontradas)].slice(0, 4).join(" · ") : null;
}

const TELEFONO = /(?:\+?52[\s-]?)?(?:01[\s-]?)?(?:800|\(?\d{2,3}\)?)[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g;
const CORREO = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;

function contacto(texto: string, p: string): string | null {
  const telefonos: string[] = [];
  for (const m of texto.matchAll(TELEFONO)) {
    const antes = p.slice(Math.max(0, (m.index ?? 0) - 50), m.index);
    const digitos = m[0].replace(/\D/g, "");
    // Solo números que el documento presenta como teléfono
    if ((/tel|llam|marca|cabina|siniestro|atencion|whats|lada|contacto|cel/.test(antes) || digitos.startsWith("800")) && !telefonos.includes(m[0].trim())) {
      telefonos.push(m[0].trim());
    }
  }
  const correos = [...new Set([...texto.matchAll(CORREO)].map((m) => m[0]))];
  const todo = [...telefonos.slice(0, 2), ...correos.slice(0, 1)];
  return todo.length ? todo.join(" · ") : null;
}

const CLAVES_CONDICION = /aviso|anticipacion|exclu|no cubre|no ampara|penalizacion|pena convencional|cancelacion|renovacion automatica|se renovara|terminacion anticipada|incremento|se incrementara|plazo de|dias naturales|dias habiles|intereses moratorios/;

function condiciones(texto: string): string[] {
  const frases = texto
    .split(/\n+|(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter((f) => f.length >= 25 && f.length <= 280 && CLAVES_CONDICION.test(plano(f)));
  return [...new Set(frases)].slice(0, 3).map(enmascarar);
}

export function extraerFicha(paginas: Pagina[]): Ficha {
  const texto = paginas.map((p) => p.contenido).join("\n").normalize("NFC");
  const p = plano(texto);
  const conds: string[] = [];
  const { inicio, fin } = fechas(texto, p, conds);
  const ficha: Ficha = {
    partes: partes(texto, p),
    numero_referencia: referencia(texto, p),
    fecha_inicio: inicio,
    fecha_vencimiento: fin,
    montos: montos(texto, p),
    condiciones_clave: [...conds, ...condiciones(texto)].slice(0, 3),
    contacto: contacto(texto, p),
    campos_no_especificados: [],
  };
  ficha.campos_no_especificados = camposVacios(ficha);
  return ficha;
}

export function camposVacios(f: Ficha): string[] {
  const vacios: string[] = [];
  for (const campo of ["partes", "numero_referencia", "fecha_inicio", "fecha_vencimiento", "contacto"] as const) {
    if (!f[campo]) vacios.push(campo);
  }
  if (Object.keys(f.montos).length === 0) vacios.push("montos");
  if (f.condiciones_clave.length === 0) vacios.push("condiciones_clave");
  return vacios;
}

// Divide el texto por página (las páginas muy largas se parten en trozos de ~1500 caracteres)
export function trocear(paginas: Pagina[]): Pagina[] {
  const trozos: Pagina[] = [];
  for (const { pagina, contenido } of paginas) {
    const limpio = contenido.replace(/[ \t]+/g, " ").trim();
    if (!limpio) continue;
    for (let i = 0; i < limpio.length; i += 1500) trozos.push({ pagina, contenido: limpio.slice(i, i + 1600) });
  }
  return trozos;
}
