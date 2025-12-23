"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type DimMm = { largo: number; ancho: number; alto: number };

type CamionPlacement = {
  palletPlanId: number;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

type CamionPlanResult = {
  palletsTotales: number;
  palletsEnCamion: number;
  camionesRequeridos: number;
  pesoTotalKg: number;
  ocupacionBasePct: number;
  warnings: string[];
  placements: CamionPlacement[];
  camionDimMm: DimMm;
};

type VarianteKey = "A" | "B" | "C";

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapStrategy(k: VarianteKey) {
  if (k === "A") return "ESTABLE";
  if (k === "B") return "OPTIMIZAR";
  return "DESCARGA_RAPIDA";
}

export async function saveCamionPlan(params: {
  empresaId: number; // lo dejamos por consistencia, aunque el save no lo usa
  loteId: number;
  transporteId: number;
  strategy: VarianteKey;
  plan: CamionPlanResult;
}) {
  const { loteId, transporteId, strategy, plan } = params;

  // Validaciones mínimas para evitar guardar basura
  if (!Number.isFinite(loteId) || loteId <= 0)
    throw new Error("loteId inválido.");
  if (!Number.isFinite(transporteId) || transporteId <= 0)
    throw new Error("transporteId inválido.");
  if (!plan || !Array.isArray(plan.placements))
    throw new Error("Plan inválido.");

  // (Opcional) chequear existencia
  const [lote, transporte] = await Promise.all([
    prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      select: { id: true },
    }),
    prisma.transporteClasificacion.findUnique({
      where: { id: transporteId },
      select: { id: true },
    }),
  ]);
  if (!lote) throw new Error("Lote inexistente.");
  if (!transporte) throw new Error("Transporte inexistente.");

  const strategyEnum = mapStrategy(strategy);

  const saved = await prisma.cubicacionCamionPlan.upsert({
    where: {
      loteId_transporteId_strategy: {
        loteId,
        transporteId,
        strategy: strategyEnum as any,
      },
    },
    create: {
      loteId,
      transporteId,
      strategy: strategyEnum as any,
      pallets_totales: plan.palletsTotales,
      pallets_en_camion: plan.palletsEnCamion,
      camiones_requeridos: plan.camionesRequeridos,
      peso_total_kg: plan.pesoTotalKg,
      ocupacion_base_pct: new Prisma.Decimal(plan.ocupacionBasePct || 0),
      layout: toInputJsonValue({
        strategy,
        ...plan,
      }),
    },
    update: {
      pallets_totales: plan.palletsTotales,
      pallets_en_camion: plan.palletsEnCamion,
      camiones_requeridos: plan.camionesRequeridos,
      peso_total_kg: plan.pesoTotalKg,
      ocupacion_base_pct: new Prisma.Decimal(plan.ocupacionBasePct || 0),
      layout: toInputJsonValue({
        strategy,
        ...plan,
      }),
    },
    select: { id: true },
  });

  console.log("SAVE_CAMION :: resumen", {
    loteId,
    transporteId,
    strategy,
    camionPlanId: saved.id,
    palletsEnCamion: plan.palletsEnCamion,
    camiones: plan.camionesRequeridos,
    ocupBase: Number(Number(plan.ocupacionBasePct || 0).toFixed(2)),
    placements: plan.placements.length,
  });

  return { camionPlanId: saved.id };
}
