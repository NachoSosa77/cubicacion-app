import { prisma } from "@/lib/prisma";
import { evaluarPallet } from "../../actions/evaluarPallet";
import { toPlain } from "../../lib/toPlain"; // ajustá ruta si cambia
import { PalletClient } from "./PalletClient";

export default async function PalletPage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId: loteIdRaw } = await params;
  const loteId = Number(loteIdRaw);

  if (!Number.isFinite(loteId) || loteId <= 0) {
    return <div className="p-6">loteId inválido: {String(loteIdRaw)}</div>;
  }

  const contenedores = await prisma.tipoContenedor.findMany({
    where: { habilitado: true },
    orderBy: { descripcion: "asc" },
  });

  const lote = await prisma.cubicacionLote.findUnique({
    where: { id: loteId },
    include: { items: { include: { tipoProducto: true } } },
  });

  if (!lote) return <div className="p-6">Lote no encontrado.</div>;

  const empresaId = lote.empresaId;

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
      <PalletClient
        lote={toPlain(lote)}
        contenedores={toPlain(contenedores)}
        onEvaluar={onEvaluar}
      />
    </div>
  );
}
