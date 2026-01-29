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
  modo?: "GUARDADO" | "SIMULACION_CAMION_PCT";
  cargaPct?: number;
}) {
  const { loteId, transporteId } = params;
  const modo = params.modo ?? "GUARDADO";
  const cargaPct = params.cargaPct ?? 100;

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

  const basePalletPlan = palletPlans[0];
  const basePalletDimMm = extractPalletDimMm(basePalletPlan.layout);
  const basePalletTemplate = {
    palletPlanId: basePalletPlan.id,
    dimPalletMm: basePalletDimMm,
    alturaUtilizadaMm: toNumber(basePalletPlan.altura_utilizada_mm, 0),
    pesoTotalKg: toNumber(basePalletPlan.peso_total_kg, 0),
  };

  const extractPalletResumen = (layout: Prisma.JsonValue) => {
    const obj = layout as any;
    const pallet1 = obj?.pallet1 ?? {};

    const cajasTotales = toNumber(
      pallet1?.cajasTotales ?? pallet1?.unidadesColocadas ?? 0,
      0,
    );
    const placements = Array.isArray(pallet1?.placements)
      ? pallet1.placements
      : [];

    const conteo = new Map<number, { codigo: string; bultos: number }>();
    for (const pl of placements) {
      const id = toNumber(pl?.tipoProductoId, 0);
      if (!id) continue;
      const codigo = String(pl?.codigo ?? `PROD-${id}`).trim() || `PROD-${id}`;
      const current = conteo.get(id) ?? { codigo, bultos: 0 };
      current.bultos += 1;
      conteo.set(id, current);
    }

    const productos = Array.from(conteo.entries()).map(([id, data]) => ({
      tipoProductoId: id,
      codigo: data.codigo,
      bultos: data.bultos,
    }));

    const bultosPorPallet =
      cajasTotales > 0
        ? cajasTotales
        : placements.length > 0
          ? placements.length
          : 0;

    return { bultosPorPallet, productos };
  };

  const resumenPalletBase = extractPalletResumen(basePalletPlan.layout);

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

  const mk = (strategy: CamionStrategy, pallets: typeof palletsInput) =>
    calcularCamionPlan({ ...baseInput, pallets }, strategy, {
      clearanceMm: 40,
      puertaEnX: "TRASERA",
    });

  const buildPallets = (count: number) =>
    Array.from({ length: count }, () => ({ ...basePalletTemplate }));

  const palletsMaxPorStrategy: Record<CamionStrategy, number> = {
    ESTABLE: 0,
    OPTIMIZAR: 0,
    DESCARGA_RAPIDA: 0,
  };
  const palletsSimuladosPorStrategy: Record<CamionStrategy, number> = {
    ESTABLE: 0,
    OPTIMIZAR: 0,
    DESCARGA_RAPIDA: 0,
  };
  const bultosSimuladosPorStrategy: Record<CamionStrategy, number> = {
    ESTABLE: 0,
    OPTIMIZAR: 0,
    DESCARGA_RAPIDA: 0,
  };
  const productosSimuladosPorStrategy: Record<
    CamionStrategy,
    Array<{ tipoProductoId: number; codigo: string; bultos: number }>
  > = {
    ESTABLE: [],
    OPTIMIZAR: [],
    DESCARGA_RAPIDA: [],
  };

  const plans_by_strategy = Object.fromEntries(
    STRATEGIES.map((s) => {
      if (modo === "SIMULACION_CAMION_PCT") {
        const probePlan = mk(s, buildPallets(400));
        const maxPallets = Math.max(0, probePlan.palletsEnCamion ?? 0);
        palletsMaxPorStrategy[s] = maxPallets;

        const pct = Math.max(1, Math.min(100, Number(cargaPct)));
        const palletsSimulados = Math.max(
          1,
          Math.floor((maxPallets * pct) / 100),
        );

        palletsSimuladosPorStrategy[s] = palletsSimulados;
        bultosSimuladosPorStrategy[s] =
          resumenPalletBase.bultosPorPallet * palletsSimulados;

        productosSimuladosPorStrategy[s] = resumenPalletBase.productos.map(
          (p) => ({
            ...p,
            bultos: p.bultos * palletsSimulados,
          }),
        );

        const plan = mk(s, buildPallets(palletsSimulados));
        return [s, plan];
      }

      return [s, mk(s, palletsInput)];
    }),
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
    simulacion:
      modo === "SIMULACION_CAMION_PCT"
        ? {
            modo,
            cargaPct: Math.max(1, Math.min(100, Number(cargaPct))),
            palletsMaxPorStrategy,
            palletsSimuladosPorStrategy,
            bultosSimuladosPorStrategy,
            productosSimuladosPorStrategy,
          }
        : null,
  };
}
