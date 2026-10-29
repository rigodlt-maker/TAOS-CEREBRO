// Volver a leer documentos ya guardados con las reglas nuevas, sin perder lo que corregiste a mano:
// solo se rellenan los datos que la ficha tenía vacíos.
import { camposVacios, clasificar, extraerFicha } from "./extraer";
import type { Categoria, Documento, Ficha, Pagina } from "./tipos";

const TIPOS_DUDOSOS = new Set(["Contrato", "Documento médico", "Documento fiscal", "Póliza de seguro", "Documento", "Cédula o título profesional"]);

export function fichaCompletada(vieja: Ficha | null, nueva: Ficha): Ficha {
  if (!vieja) return nueva;
  const f: Ficha = {
    partes: vieja.partes ?? nueva.partes,
    numero_referencia: vieja.numero_referencia ?? nueva.numero_referencia,
    fecha_inicio: vieja.fecha_inicio ?? nueva.fecha_inicio,
    fecha_vencimiento: vieja.fecha_vencimiento ?? nueva.fecha_vencimiento,
    montos: { ...nueva.montos, ...vieja.montos },
    condiciones_clave: vieja.condiciones_clave.length ? vieja.condiciones_clave : nueva.condiciones_clave,
    contacto: vieja.contacto ?? nueva.contacto,
    campos_no_especificados: [],
  };
  f.campos_no_especificados = camposVacios(f);
  return f;
}

// Qué cambiaría al volver a leer un documento (null si nada)
export function releer(doc: Documento, paginas: Pagina[]): { categoria: Categoria; tipo_documento: string; ficha: Ficha } | null {
  if (!paginas.length) return null;
  const ficha = fichaCompletada(doc.ficha, extraerFicha(paginas));
  const nueva = clasificar(paginas.map((p) => p.contenido).join("\n"), doc.nombre);
  // La categoría solo cambia si la anterior era genérica o dudosa (la que pusiste tú se respeta)
  const reclasificar = (TIPOS_DUDOSOS.has(doc.tipo_documento ?? "Documento") || doc.categoria === "Notas personales") && nueva.tipo_documento !== doc.tipo_documento;
  const categoria = reclasificar ? nueva.categoria : doc.categoria;
  const tipo_documento = reclasificar ? nueva.tipo_documento : (doc.tipo_documento ?? nueva.tipo_documento);
  const igual = JSON.stringify(ficha) === JSON.stringify(doc.ficha) && categoria === doc.categoria && tipo_documento === doc.tipo_documento;
  return igual ? null : { categoria, tipo_documento, ficha };
}
