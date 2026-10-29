import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Input, Label, Select } from "@/components/ui/campos";
import { Vencimiento } from "@/components/vencimiento";
import { borrarDocumento, guardarFicha } from "@/lib/acciones";
import { enmascarar } from "@/lib/enmascarar";
import { dinero } from "@/lib/formato";
import { fechaLarga, hoyEnMexico } from "@/lib/fechas";
import { obtenerRepo } from "@/lib/sesion";
import { CATEGORIAS, NOMBRES_CAMPOS } from "@/lib/tipos";

const NE = "no especificado";

export default async function DetalleDocumento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const { id } = await params;
  const { pagina } = await searchParams;
  const repo = await obtenerRepo();
  const doc = await repo.documento(id);
  if (!doc) notFound();
  const hoy = hoyEnMexico();
  const f = doc.ficha;
  const pag = Math.max(1, Number(pagina) || 1);
  // URL firmada de 10 minutos: el archivo nunca es público
  const url = doc.ruta_storage ? await repo.urlFirmada(doc.ruta_storage, 600) : null;
  // Documentos de tu carpeta de Google Drive: se abren en Drive
  const enDrive = await repo.enlaceExterno(doc.id);
  const paginas = url ? [] : ((await repo.paginasDe([doc.id]))[doc.id] ?? []);
  const esPdf = doc.tipo_archivo === "application/pdf" || doc.nombre.toLowerCase().endsWith(".pdf");
  const montos = f ? Object.entries(f.montos) : [];
  // Ficha en modo lectura: solo lo que sí se encontró
  const datos: [string, string][] = f
    ? ([
        [NOMBRES_CAMPOS.fecha_vencimiento, f.fecha_vencimiento ? fechaLarga(f.fecha_vencimiento) : null],
        [NOMBRES_CAMPOS.fecha_inicio, f.fecha_inicio ? fechaLarga(f.fecha_inicio) : null],
        [NOMBRES_CAMPOS.partes, f.partes],
        [NOMBRES_CAMPOS.numero_referencia, f.numero_referencia],
        [NOMBRES_CAMPOS.montos, montos.length ? montos.map(([k, v]) => `${k}: ${dinero(v)}`).join("\n") : null],
        [NOMBRES_CAMPOS.contacto, f.contacto],
      ].filter(([, v]) => v) as [string, string][])
    : [];
  const esImagen = doc.tipo_archivo?.startsWith("image/");

  return (
    <div className="grid gap-4">
      <Link href="/biblioteca" className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-5" /> Biblioteca
      </Link>
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{doc.tipo_documento ?? "Documento"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{doc.categoria}</Badge>
          {f?.fecha_vencimiento && <Vencimiento fecha={f.fecha_vencimiento} hoy={hoy} />}
        </div>
      </div>
      {doc.estado_procesamiento === "error" && (
        <p className="rounded-xl border border-destructive px-4 py-3 text-sm text-destructive">No se pudo leer: {doc.error_procesamiento}</p>
      )}

      {url && (
        <a
          href={esPdf ? `${url}#page=${pag}` : url}
          target="_blank"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground active:scale-[0.98]"
        >
          <ExternalLink className="size-5" /> Abrir documento{esPdf && pag > 1 ? ` en la pág. ${pag}` : ""}
        </a>
      )}
      {!url && enDrive && (
        <a
          href={enDrive}
          target="_blank"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground active:scale-[0.98]"
        >
          <ExternalLink className="size-5" /> Abrir en Google Drive
        </a>
      )}
      {url && esImagen && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={doc.nombre} className="w-full rounded-2xl border" />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ficha</CardTitle>
          {f && f.campos_no_especificados.length > 0 && <span className="text-xs text-muted-foreground">{f.campos_no_especificados.length} sin especificar</span>}
        </CardHeader>
        {datos.length ? (
          <dl className="grid gap-3">
            {datos.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <CardDescription>No se encontraron datos clave. Puedes agregarlos en “Editar ficha”.</CardDescription>
        )}
        {f && f.condiciones_clave.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">{NOMBRES_CAMPOS.condiciones_clave}</p>
            <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm">
              {f.condiciones_clave.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Desplegable titulo="Editar ficha">
          <Formulario accion={guardarFicha} boton="Guardar ficha">
            <input type="hidden" name="id" value={doc.id} />
            <Label>
              Nombre
              <Input name="nombre" defaultValue={doc.nombre} />
            </Label>
            <div className="grid gap-3">
              <Label>
                Categoría
                <Select name="categoria" defaultValue={doc.categoria}>
                  {CATEGORIAS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Label>
              <Label>
                Tipo
                <Input name="tipo_documento" defaultValue={doc.tipo_documento ?? ""} />
              </Label>
            </div>
            <Label>
              {NOMBRES_CAMPOS.partes}
              <Input name="partes" defaultValue={f?.partes ?? ""} placeholder={NE} />
            </Label>
            <Label>
              {NOMBRES_CAMPOS.numero_referencia} <span className="font-normal text-muted-foreground">(solo últimos 4)</span>
              <Input name="numero_referencia" defaultValue={f?.numero_referencia ?? ""} placeholder={NE} />
            </Label>
            <div className="grid gap-3">
              <Label>
                {NOMBRES_CAMPOS.fecha_inicio}
                <Input name="fecha_inicio" type="date" defaultValue={f?.fecha_inicio ?? ""} />
              </Label>
              <Label>
                {NOMBRES_CAMPOS.fecha_vencimiento}
                <Input name="fecha_vencimiento" type="date" defaultValue={f?.fecha_vencimiento ?? ""} />
              </Label>
            </div>
            <Label>
              {NOMBRES_CAMPOS.montos} <span className="font-normal text-muted-foreground">(uno por línea: concepto: monto)</span>
              <textarea
                name="montos"
                rows={3}
                defaultValue={f ? Object.entries(f.montos).map(([k, v]) => `${k}: ${v}`).join("\n") : ""}
                placeholder={NE}
                className="w-full rounded-xl border bg-card px-4 py-3 text-base"
              />
            </Label>
            <Label>
              {NOMBRES_CAMPOS.condiciones_clave} <span className="font-normal text-muted-foreground">(hasta 3, una por línea)</span>
              <textarea
                name="condiciones"
                rows={4}
                defaultValue={f?.condiciones_clave.join("\n") ?? ""}
                placeholder={NE}
                className="w-full rounded-xl border bg-card px-4 py-3 text-base"
              />
            </Label>
            <Label>
              {NOMBRES_CAMPOS.contacto}
              <Input name="contacto" defaultValue={f?.contacto ?? ""} placeholder={NE} />
            </Label>
          </Formulario>
      </Desplegable>

      {!url && paginas.length > 0 && (
        <Desplegable titulo="Texto del documento">
          <div className="grid gap-4">
            {paginas.map((p, i) => (
              <section key={i} id={`pagina-${p.pagina}`}>
                <h3 className="mb-1 text-xs font-medium text-muted-foreground">Página {p.pagina}</h3>
                <pre className="font-sans text-sm whitespace-pre-wrap">{enmascarar(p.contenido)}</pre>
              </section>
            ))}
          </div>
        </Desplegable>
      )}

      <BotonAccion accion={borrarDocumento.bind(null, doc.id)} confirmar={`¿Borrar "${doc.nombre}" y su archivo? No se puede deshacer.`} variant="destructive">
        <Trash2 className="size-4" /> Borrar documento
      </BotonAccion>
      <p className="text-xs text-muted-foreground">La app resume lo que dice el documento, pero no da interpretaciones legales.</p>
    </div>
  );
}
