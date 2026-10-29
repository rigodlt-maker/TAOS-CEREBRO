import { Trash2 } from "lucide-react";
import { BotonAccion, Desplegable, Formulario } from "@/components/formulario";
import { Titulo } from "@/components/taos/encabezado";
import { CardDescription } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/campos";
import { borrarNota, guardarNota } from "@/lib/acciones";
import { obtenerRepo } from "@/lib/sesion";
import { CATEGORIAS, type Nota } from "@/lib/tipos";

function CamposNota({ nota }: { nota?: Nota }) {
  return (
    <>
      {nota && <input type="hidden" name="id" value={nota.id} />}
      <Label>
        Título
        <Input name="titulo" defaultValue={nota?.titulo} required placeholder="Ej. Dónde guardé las escrituras" />
      </Label>
      <Label>
        Nota
        <textarea name="contenido" rows={4} defaultValue={nota?.contenido} className="w-full rounded-xl border bg-card px-4 py-3 text-base" />
      </Label>
      <Label>
        Categoría
        <Select name="categoria" defaultValue={nota?.categoria ?? "Notas personales"}>
          {CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Label>
    </>
  );
}

export default async function Notas() {
  const notas = await (await obtenerRepo()).notas();
  return (
    <div className="grid gap-3">
      <Titulo detalle="También se buscan cuando haces preguntas.">Notas</Titulo>
      <Desplegable titulo={<span className="text-primary">+ Nueva nota</span>}>
        <Formulario accion={guardarNota} boton="Guardar nota" limpiar>
          <CamposNota />
        </Formulario>
      </Desplegable>
      {notas.length === 0 && <CardDescription>Todavía no tienes notas.</CardDescription>}
      {notas.map((n) => (
        <div key={n.id} id={n.id} className="scroll-mt-20">
          <Desplegable titulo={<span className="truncate">{n.titulo}</span>}>
            <p className="mb-3 text-sm whitespace-pre-wrap text-muted-foreground">{n.contenido}</p>
            <Formulario accion={guardarNota} boton="Guardar cambios">
              <CamposNota nota={n} />
            </Formulario>
            <div className="mt-3">
              <BotonAccion accion={borrarNota.bind(null, n.id)} confirmar="¿Borrar esta nota?" variant="destructive">
                <Trash2 className="size-4" /> Borrar
              </BotonAccion>
            </div>
          </Desplegable>
        </div>
      ))}
    </div>
  );
}
