"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/* =========================
   Types (input)
========================= */

type DimMm = { largo: number; ancho: number; alto: number };

type CamionPlacement = {
  palletPlanId: number;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

export type CamionPlanResult = {
  palletsTotales: number;
  palletsEnCamion: number;
  camionesRequeridos: number;
  pesoTotalKg: number;
  ocupacionBasePct: number;
  warnings: string[];
  placements: CamionPlacement[];
  camionDimMm: DimMm;
};

export type CamionStrategy = "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";
export type CamionPlanStatus = "BORRADOR" | "SELECCIONADO" | "DESCARTADO";

/* =========================
   Helpers
========================= */

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function requirePositiveInt(n: unknown, msg: string) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) throw new Error(msg);
  return v;
}

function safeNumber(n: unknown, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function assertStrategy(s: unknown): asserts s is CamionStrategy {
  if (s !== "ESTABLE" && s !== "OPTIMIZAR" && s !== "DESCARGA_RAPIDA") {
    throw new Error("strategy inválida.");
  }
}

/* =========================
   Action
========================= */

export async function saveCamionPlan(params: {
  empresaId: number;
  loteId: number;
  transporteId: number;
  strategy: CamionStrategy;
  status?: CamionPlanStatus; // default: BORRADOR
  plan: CamionPlanResult;
}) {
  const loteId = requirePositiveInt(params.loteId, "loteId inválido.");
  const transporteId = requirePositiveInt(
    params.transporteId,
    "transporteId inválido.",
  );

  assertStrategy(params.strategy);

  const status: CamionPlanStatus = params.status ?? "BORRADOR";

  const plan = params.plan;
  if (!plan) throw new Error("Plan inválido.");
  if (!Array.isArray(plan.placements))
    throw new Error("Plan inválido: placements.");

  // existencia (recomendado)
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

  const dataCreate = {
    lote_id: loteId,
    transporte_id: transporteId,
    strategy: params.strategy as any,
    status: status as any,

    pallets_totales: safeNumber(plan.palletsTotales, 0),
    pallets_en_camion: safeNumber(plan.palletsEnCamion, 0),
    camiones_requeridos: safeNumber(plan.camionesRequeridos, 0),
    peso_total_kg: safeNumber(plan.pesoTotalKg, 0),

    ocupacion_base_pct: new Prisma.Decimal(
      safeNumber(plan.ocupacionBasePct, 0),
    ),

    layout: toInputJsonValue({
      ...plan,
      meta: {
        schema: "camion_plan_v1",
        created_from: "saveCamionPlan",
      },
    }),
  };

  const saved = await prisma.$transaction(async (tx) => {
    // Si este plan queda SELECCIONADO, deseleccionamos TODO lo previo del mismo scope
    // (lote_id + transporte_id), no solo lo que ya estaba SELECCIONADO.
    if (status === "SELECCIONADO") {
      await tx.cubicacionCamionPlan.updateMany({
        where: {
          lote_id: loteId,
          transporte_id: transporteId,
          // evitamos tocar ya-descartados si querés; opcional
          status: { in: ["BORRADOR", "SELECCIONADO"] as any },
        },
        data: { status: "DESCARTADO" as any },
      });
    }

    // Historial real: siempre CREATE
    return tx.cubicacionCamionPlan.create({
      data: dataCreate as any,
      select: { id: true },
    });
  });

  console.log("SAVE_CAMION :: resumen", {
    loteId,
    transporteId,
    strategy: params.strategy,
    status,
    camionPlanId: saved.id,
    palletsEnCamion: plan.palletsEnCamion,
    camiones: plan.camionesRequeridos,
    ocupBase: Number(safeNumber(plan.ocupacionBasePct, 0).toFixed(2)),
    placements: plan.placements.length,
  });

  return { camionPlanId: saved.id };
}
