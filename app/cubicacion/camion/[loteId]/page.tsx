import { prisma } from "@/lib/prisma";
import { previewCamionPlan } from "../../actions/previewCamionPlan";
import { saveCamionPlan } from "../../actions/saveCamionPlan";
import { toPlain } from "../../lib/toPlain";
import { CamionClient } from "./CamionClient";

export default async function CamionPage({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId: loteIdRaw } = await params;
  const loteId = Number(loteIdRaw);

  if (!Number.isFinite(loteId) || loteId <= 0) {
    return <div className="p-6">loteId inválido: {String(loteIdRaw)}</div>;
  }

  // Para esta vista no necesitamos items; traemos lo mínimo.
  const lote = await prisma.cubicacionLote.findUnique({
  where: { id: loteId },
  select: {
    id: true,
    empresa_id: true,
    descripcion: true,
    tipo_bulto: true,
    unidades_totales: true,
    bultos_totales: true,
    packing_policy: true,
    bulto_empresa_id: true,
    created_at: true,
    updated_at: true,
  },
})

  if (!lote) return <div className="p-6">Lote no encontrado.</div>;

  // Capturamos valores “seguros” fuera del closure
  const empresaId = lote.empresa_id;
  const loteIdSafe = lote.id;

  const transportes = await prisma.transporteClasificacion.findMany({
    orderBy: { denominacion_de_vehiculo: "asc" },
  });

  async function onPreview(form: { transporteId: number }) {
    "use server";
    return previewCamionPlan({
      empresaId,
      loteId: loteIdSafe,
      transporteId: form.transporteId,
    });
  }

  async function onGuardar(payload: {
  transporteId: number;
  strategy: "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";
  plan: any;
}) {
  "use server";
  return saveCamionPlan({
    empresaId,
    loteId: loteIdSafe,
    transporteId: payload.transporteId,
    strategy: payload.strategy,
    plan: payload.plan,
  });
}

  // Resumen de pallets guardados (para poblar la tarjeta)
  // OJO: si tu modelo NO tiene updatedAt (camelCase) sino updated_at, cambiá aquí.
  const palletPlans = await prisma.cubicacionPalletPlan.findMany({
    where: { loteId: loteIdSafe },
    select: {
      id: true,
      peso_total_kg: true, // si en tu Prisma es pesoTotalKg, cambiá aquí
      updatedAt: true,     // si en tu Prisma es updated_at, cambiá aquí
    },
    orderBy: { updatedAt: "desc" }, // idem: updated_at si corresponde
  });

  const palletsGuardados = palletPlans.length;

  const pesoEstimadoKg = palletPlans.reduce(
    (acc, p) => acc + Number(p.peso_total_kg ?? 0),
    0
  );

  const lastUpdatedAt = palletPlans[0]?.updatedAt ?? null;

  const palletSummary = {
    palletsGuardados,
    pesoEstimadoKg,
    lastUpdatedAt: lastUpdatedAt ? lastUpdatedAt.toISOString() : null,
  };

  // Mapear a lo que espera CamionClient (tipoBulto opcional)
  const loteClient = {
    id: lote.id,
    empresaId: lote.empresa_id,
    descripcion: lote.descripcion ?? null,
    // si tu campo real es tipo_bulto y querés mostrarlo:
    tipoBulto: (lote as any).tipo_bulto ?? undefined,
  };

  return (
    <div className="p-6 space-y-6">
      <CamionClient
        lote={toPlain(loteClient)}
        transportes={toPlain(transportes)}
        palletSummary={palletSummary}
        onPreview={onPreview}
        onGuardar={onGuardar}
      />
    </div>
  );
}
