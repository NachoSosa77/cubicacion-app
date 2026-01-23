"use server";

import { prisma } from "@/lib/prisma";
import { calcularLayoutBulto3D } from "../lib/packing-bulto-3d";
import type { BultoSimSnapshot, DimMm } from "../types/types";

function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function tryDimMm(v: any): DimMm | null {
  if (!v) return null;
  const largo = safeInt(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = safeInt(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = safeInt(v.alto ?? v.alto_mm ?? v.h, 0);
  if (largo > 0 && ancho > 0 && alto > 0) return { largo, ancho, alto };
  return null;
}

export async function previewBultoLayout3D(params: {
  loteId?: number | null;
  simulacionId?: number | null;
  snap: BultoSimSnapshot;

  // override opcional (si elegís bulto empresa)
  bultoOverrideMm?: DimMm | null;
}) {
  // =========================
  // 1) bulto interno desde snapshot u override
  // =========================
  const snapFirstWithDim = params.snap.items.find(
    (x) => x.dim_bulto_mm && x.dim_bulto_mm.largo > 0
  );

  const bultoInternoMm =
    params.bultoOverrideMm ?? snapFirstWithDim?.dim_bulto_mm ?? null;

  if (!bultoInternoMm) {
    return {
      layout: {
        bulto: { dimInternaMm: { largo: 0, ancho: 0, alto: 0 } },
        contenido: [],
        placements: [],
        warnings: [
          "No hay dim_bulto_mm en el snapshot (no se puede armar visor 3D).",
        ],
      },
    };
  }

  // =========================
  // 2) Fuente de unidades:
  // - si hay simulacionId: cubicacion_producto_plan
  // - si no: lote (legacy)
  // =========================
  let itemsForPacking: Array<{
    tipo_producto_id: number;
    codigo: string;
    unidades: number;
    dimUnidadMm: DimMm;
  }> = [];

  const warnings: string[] = [];

  if (params.simulacionId) {
    const rows = await prisma.cubicacionProductoPlan.findMany({
      where: { simulacion_id: params.simulacionId },
      orderBy: { id: "asc" },
    });

    const planByTipo = new Map<number, any>();
    for (const r of rows) {
      if (r.tipo_producto_id != null) planByTipo.set(r.tipo_producto_id, r);
    }

    itemsForPacking = params.snap.items
      .map((s) => {
        const plan = planByTipo.get(s.tipo_producto_id);
        if (!plan) {
          warnings.push(
            `${s.codigo}: no existe en producto_plan de la simulación.`
          );
          return null;
        }

        const dimUnidad = tryDimMm(plan.dim_unidad_mm);
        if (!dimUnidad) {
          warnings.push(`${s.codigo}: falta dim_unidad_mm en producto_plan.`);
          return null;
        }

        const uPlan = Math.max(0, safeInt(s.unidades_planificadas, 0));
        const uPorBulto = Math.max(0, safeInt(s.unidades_por_bulto, 0));
        const unidadesEnEsteBulto =
          uPorBulto > 0 ? Math.min(uPorBulto, uPlan) : uPlan;

        return {
          tipo_producto_id: s.tipo_producto_id,
          codigo: s.codigo,
          unidades: unidadesEnEsteBulto,
          dimUnidadMm: dimUnidad,
        };
      })
      .filter(Boolean) as any;
  } else {
    // legacy: usa lote
    const loteId = params.loteId ?? null;
    if (!loteId) throw new Error("Falta loteId o simulacionId.");

    const lote = await prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      include: {
        items: { include: { tipo_producto: true }, orderBy: { id: "asc" } },
      },
    });

    if (!lote) throw new Error("Lote inexistente.");

    const loteItemsByTipo = new Map(
      lote.items.map((it) => [it.tipo_producto_id, it])
    );

    itemsForPacking = params.snap.items
      .map((s) => {
        const it = loteItemsByTipo.get(s.tipo_producto_id);
        if (!it) {
          warnings.push(`${s.codigo}: no existe en lote.items.`);
          return null;
        }

        const dimUnidad = tryDimMm(it.dim_unidad_mm);
        if (!dimUnidad) {
          warnings.push(
            `${s.codigo}: falta dim_unidad_mm (no se puede dibujar 3D).`
          );
          return null;
        }

        const uPlan = Math.max(0, safeInt(s.unidades_planificadas, 0));
        const uPorBulto = Math.max(0, safeInt(s.unidades_por_bulto, 0));
        const unidadesEnEsteBulto =
          uPorBulto > 0 ? Math.min(uPorBulto, uPlan) : uPlan;

        return {
          tipo_producto_id: s.tipo_producto_id,
          codigo: s.codigo,
          unidades: unidadesEnEsteBulto,
          dimUnidadMm: dimUnidad,
        };
      })
      .filter(Boolean) as any;
  }

  const res = calcularLayoutBulto3D({
    bultoInternoMm,
    items: itemsForPacking,
    maxUnidades: 800,
  });

  const contenido = itemsForPacking.map((it) => ({
    productoId: it.tipo_producto_id,
    codigo: it.codigo,
    unidades: it.unidades,
    dimUnidadMm: it.dimUnidadMm,
  }));

  return {
    layout: {
      bulto: { dimInternaMm: bultoInternoMm },
      contenido,
      placements: res.placements,
      warnings: [...warnings, ...res.warnings],
    },
  };
}
