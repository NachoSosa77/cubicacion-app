"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  calcularCamionPlan,
  CamionPlanResult,
  CamionStrategy,
} from "../lib/packing-camion";

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function requirePositive(n: number, msg: string) {
  if (!Number.isFinite(n) || n <= 0) throw new Error(msg);
  return n;
}

function scorePlan(p: CamionPlanResult) {
  return (
    -p.camionesRequeridos * 1_000_000 +
    p.palletsEnCamion * 10_000 +
    p.ocupacionBasePct * 100 +
    -p.warnings.length * 1000
  );
}

function pickRecommended(
  plans: Record<CamionStrategy, CamionPlanResult>,
): CamionStrategy {
  const entries = Object.entries(plans) as Array<
    [CamionStrategy, CamionPlanResult]
  >;

  entries.sort((a, b) => scorePlan(b[1]) - scorePlan(a[1]));
  return entries[0][0];
}

type DimMm = { largo: number; ancho: number; alto: number };

function extractPalletDimMm(layout: Prisma.JsonValue): DimMm {
  const obj = layout as any;
  const dim = obj?.pallet1?.palletDimMm;

  const largo = toNumber(dim?.largo, 0);
  const ancho = toNumber(dim?.ancho, 0);
  const alto = toNumber(dim?.alto, 0);

  requirePositive(
    largo,
    "layout.pallet1.palletDimMm.largo inválido o faltante.",
  );
  requirePositive(
    ancho,
    "layout.pallet1.palletDimMm.ancho inválido o faltante.",
  );

  return { largo, ancho, alto: Math.max(0, alto) };
}

// arriba de previewCamionPlan (a nivel módulo)
const STRATEGIES: CamionStrategy[] = [
  "ESTABLE",
  "OPTIMIZAR",
  "DESCARGA_RAPIDA",
];

export async function previewCamionPlan(params: {
  empresaId: number;
  loteId: number;
  transporteId: number;
}) {
  const { loteId, transporteId } = params;

  // 1) Transporte
  const transporte = await prisma.transporteClasificacion.findUnique({
    where: { id: transporteId },
  });
  if (!transporte) throw new Error("Transporte inexistente.");

  const largoM = toNumber(transporte.mt_largo_cub, 0);
  const anchoM = toNumber(transporte.mt_ancho_cub, 0);
  const altoM = toNumber(transporte.mt_alto_cub, 0);

  requirePositive(largoM, "El transporte no tiene mt_largo_cub válido.");
  requirePositive(anchoM, "El transporte no tiene mt_ancho_cub válido.");
  requirePositive(altoM, "El transporte no tiene mt_alto_cub válido.");

  const maxPesoKg =
    transporte.max_peso_kg != null ? toNumber(transporte.max_peso_kg, 0) : null;

  // 2) Pallet plans guardados del lote
  const palletPlans = await prisma.cubicacionPalletPlan.findMany({
    where: { loteId: loteId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      layout: true,
      altura_utilizada_mm: true,
      peso_total_kg: true,
      pallets_necesarios: true,
      updatedAt: true,
    },
  });

  if (!palletPlans.length) {
    throw new Error(
      "No hay planes de pallet guardados para este lote. Primero guardá la cubicación en pallet.",
    );
  }

  const palletsInput = palletPlans.map((p) => {
    const dimPalletMm = extractPalletDimMm(p.layout);
    return {
      palletPlanId: p.id,
      dimPalletMm,
      alturaUtilizadaMm: toNumber(p.altura_utilizada_mm, 0),
      pesoTotalKg: toNumber(p.peso_total_kg, 0),
    };
  });

  // 3) Base input para el algoritmo
  const baseInput = {
    transporte: {
      id: transporte.id,
      codigo: String(
        transporte.denominacion_de_vehiculo ?? `T-${transporte.id}`,
      ),
      largo_mts: largoM,
      ancho_mts: anchoM,
      alto_mts: altoM,
      max_peso_kg: maxPesoKg,
    },
    pallets: palletsInput,
  };

  const mk = (strategy: CamionStrategy) =>
    calcularCamionPlan(baseInput, strategy, {
      clearanceMm: 40,
      puertaEnX: "TRASERA",
    });

  const plans_by_strategy = Object.fromEntries(
    STRATEGIES.map((s) => [s, mk(s)]),
  ) as Record<CamionStrategy, CamionPlanResult>;

  const recommended_strategy = pickRecommended(plans_by_strategy);

  console.log("PREVIEW_CAMION :: resumen", {
    loteId,
    transporteId,
    palletsTotales: plans_by_strategy[recommended_strategy].palletsTotales,
    palletsEnCamion: plans_by_strategy[recommended_strategy].palletsEnCamion,
    camionesRequeridos:
      plans_by_strategy[recommended_strategy].camionesRequeridos,
    ocupacionBasePct: Number(
      plans_by_strategy[recommended_strategy].ocupacionBasePct.toFixed(2),
    ),
    pesoTotalKg: Number(
      plans_by_strategy[recommended_strategy].pesoTotalKg.toFixed(2),
    ),
    placementsCount: plans_by_strategy[recommended_strategy].placements.length,
    recommended_strategy,
  });

  return {
    recommended_strategy,
    strategy_order: STRATEGIES,
    plans_by_strategy,
  };
}
