// app/cubicacion/pallet/[loteId]/page.tsx (ajustá ruta si difiere)

import { prisma } from "@/lib/prisma";
import { previewPalletPlan } from "../../actions/previewPalletPlan";
import { savePalletPlan } from "../../actions/savePalletPlan";
import { toPlain } from "../../lib/toPlain";
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
    include: { items: { include: { tipoProducto: true } }, bultoEmpresa: true },
  });

  if (!lote) return <div className="p-6">Lote no encontrado.</div>;

  const empresaId = lote.empresaId;

  // ✅ 1) Preview: NO guarda, solo calcula y devuelve el plan
  async function onPreview(form: {
    tipoContenedorId: number;
    mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
    objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  }) {
    "use server";
    return previewPalletPlan({
      empresaId,
      loteId,
      tipoContenedorId: form.tipoContenedorId,
      mixPolicy: form.mixPolicy,
      objective: form.objective,
    });
  }

  // ✅ 2) Guardar: persiste el plan que el usuario ya vio
  async function onGuardar(input: {
    tipoContenedorId: number;
    mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
    objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
    plan: unknown; // viene del client; lo tipamos a JSON en el action
  }) {
    "use server";
    return savePalletPlan({
      empresaId,
      loteId,
      tipoContenedorId: input.tipoContenedorId,
      mixPolicy: input.mixPolicy,
      objective: input.objective,
    });
  }

  return (
    <div className="p-6 space-y-6">
      <PalletClient
        lote={toPlain(lote)}
        contenedores={toPlain(contenedores)}
        onPreview={onPreview}
        onGuardar={onGuardar}
      />
    </div>
  );
}
