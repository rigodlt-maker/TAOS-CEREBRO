import { QueMeFalta } from "@/components/que-me-falta";
import { Subir } from "@/components/subir";
import { Titulo } from "@/components/taos/encabezado";
import { Card } from "@/components/ui/card";

export default function PaginaSubir() {
  return (
    <div className="grid gap-4">
      <Titulo detalle="PDF, fotos o archivos de texto. Puedes elegir varios a la vez.">Subir documentos</Titulo>
      <Subir />
      <Card>
        <QueMeFalta />
      </Card>
    </div>
  );
}
