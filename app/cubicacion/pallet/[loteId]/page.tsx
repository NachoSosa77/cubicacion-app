import { prisma } from "@/lib/prisma";
import { evaluarPallet } from "../../actions/evaluarPallet";
import { PalletClient } from "./PalletClient";

export default async function PalletPage({
  params,
}: {
  params: { loteId: string };
}) {
  const loteId = Number(params.loteId);

  const contenedores = await prisma.tipoContenedor.findMany({
    where: { habilitado: true },
    orderBy: { descripcion: "asc" },
  });

  const lote = await prisma.cubicacionLote.findUnique({
    where: { id: loteId },
    include: { items: { include: { tipoProducto: true } } },
  });

  if (!lote) return <div className="p-6">Lote no encontrado.</div>;

  const empresaId = lote.empresa_id;

  async function onEvaluar(form: {
    tipoContenedorId: number;
    mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
    objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  }) {
    "use server";
    return evaluarPallet({
      empresaId,
      loteId,
      tipoContenedorId: form.tipoContenedorId,
      mixPolicy: form.mixPolicy,
      objective: form.objective,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PalletClient lote={lote as any} contenedores={contenedores as any} onEvaluar={onEvaluar} />
    </div>
  );
}
