"use server";

import { prisma } from "@/lib/prisma";
import { PreviewResponse, VarianteKey } from "../types/types";

/**
 * IMPORTANTE:
 * - Acá llamás a TU lógica real de cálculo de camión.
 * - Yo dejo el esqueleto y dónde enchufarla.
 */

// Si tenés ya una función en lib, importala:
// import { calcularCamionPlans } from "../lib/camion";

export async function previewCamionPlanAction(params: {
  loteId: number;
  transporteId: number;
}): Promise<PreviewResponse> {
  const { loteId, transporteId } = params;

  if (!Number.isFinite(loteId) || loteId <= 0)
    throw new Error("loteId inválido");
  if (!Number.isFinite(transporteId) || transporteId <= 0)
    throw new Error("transporteId inválido");

  // 1) Validar que existan pallets guardados para este lote
  const palletsCount = await prisma.cubicacionPalletPlan.count({
    where: { loteId: loteId },
  });

  if (palletsCount <= 0) {
    throw new Error(
      "Este lote no tiene planes de pallet guardados. Primero evaluá y guardá pallets.",
    );
  }

  // 2) Traer transporte
  const transporte = await prisma.transporteClasificacion.findUnique({
    where: { id: transporteId },
  });

  if (!transporte) throw new Error("Transporte no encontrado.");

  // 3) Traer pallets guardados (si tu cálculo necesita layout/peso/alto/etc.)
  const pallets = await prisma.cubicacionPalletPlan.findMany({
    where: { loteId: loteId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      peso_total_kg: true,
      altura_utilizada_mm: true,
      layout: true,
      // lo que necesites...
    },
  });

  // 4) Calcular (reemplazá con tu algoritmo real)
  // const res = calcularCamionPlans({ transporte, pallets });

  // Placeholder para que compile si todavía no lo enchufaste:
  const res: PreviewResponse = {
    recommended: "ESTABLE",
    plans: {
      ESTABLE: {
        palletsTotales: pallets.length,
        palletsEnCamion: pallets.length,
        camionesRequeridos: 1,
        pesoTotalKg: pallets.reduce(
          (a, p) => a + Number(p.peso_total_kg ?? 0),
          0,
        ),
        ocupacionBasePct: 0,
        warnings: [],
        placements: [],
        camionDimMm: { largo: 0, ancho: 0, alto: 0 },
      },
      OPTIMIZAR: {
        palletsTotales: pallets.length,
        palletsEnCamion: pallets.length,
        camionesRequeridos: 1,
        pesoTotalKg: pallets.reduce(
          (a, p) => a + Number(p.peso_total_kg ?? 0),
          0,
        ),
        ocupacionBasePct: 0,
        warnings: [],
        placements: [],
        camionDimMm: { largo: 0, ancho: 0, alto: 0 },
      },
      DESCARGA_RAPIDA: {
        palletsTotales: pallets.length,
        palletsEnCamion: pallets.length,
        camionesRequeridos: 1,
        pesoTotalKg: pallets.reduce(
          (a, p) => a + Number(p.peso_total_kg ?? 0),
          0,
        ),
        ocupacionBasePct: 0,
        warnings: [],
        placements: [],
        camionDimMm: { largo: 0, ancho: 0, alto: 0 },
      },
    },
  };

  return res;
}

/**
 * Guardado profesional:
 * - NO confíes en el "plan" que viene del cliente.
 * - Recalculá en servidor y guardá SOLO la variante elegida.
 */
export async function guardarCamionPlanAction(params: {
  loteId: number;
  transporteId: number;
  strategy: VarianteKey;
}): Promise<{ camionPlanId: number }> {
  const { loteId, transporteId, strategy } = params;

  const preview = await previewCamionPlanAction({ loteId, transporteId });
  const plan = preview.plans[strategy];

  if (!plan) throw new Error("Plan inválido.");

  // Persistí según tu modelo real (ajustá nombres)
  const saved = await prisma.cubicacionCamionPlan.create({
    data: {
      loteId: loteId,
      transporteId: transporteId,
      strategy: strategy,
      pallets_totales: plan.palletsTotales,
      pallets_en_camion: plan.palletsEnCamion,
      camiones_requeridos: plan.camionesRequeridos,
      peso_total_kg: plan.pesoTotalKg,
      ocupacion_base_pct: plan.ocupacionBasePct,
      layout: plan as any, // ideal: JSON column
    },
    select: { id: true },
  });

  return { camionPlanId: saved.id };
}
