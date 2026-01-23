"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { BultoSimSnapshot } from "../simulacion/types/types";

function toPosInt(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

function toDimMmJson(v: any): Prisma.InputJsonValue | undefined {
  if (!v) return undefined;

  const largo = toPosInt(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = toPosInt(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = toPosInt(v.alto ?? v.alto_mm ?? v.h, 0);

  if (largo <= 0 || ancho <= 0 || alto <= 0) return undefined;
  return { largo, ancho, alto } as Prisma.InputJsonValue;
}

/**
 * “Uso real” operativo:
 * - Si bultos <= 1: no hay parcial; el último bulto tiene todas las unidades.
 * - Si bultos > 1: parcial si unidades % cap != 0.
 */
function calcUsoReal(
  unidadesPlan: number,
  capacidadPorBulto: number,
  bultos: number,
) {
  const unidades = Math.max(0, Math.trunc(unidadesPlan || 0));
  const cap = Math.max(0, Math.trunc(capacidadPorBulto || 0));
  const cb = Math.max(0, Math.trunc(bultos || 0));

  if (cap <= 0) return { sobrante: 0, ultimo: 0 };

  // 0 o 1 bulto: operativamente no marcamos sobrante
  if (cb <= 1) {
    return { sobrante: 0, ultimo: unidades };
  }

  const rem = unidades % cap;
  if (rem === 0) return { sobrante: 0, ultimo: cap };
  return { sobrante: rem, ultimo: rem };
}

export async function applyBultoSnapshotToSimulacion(params: {
  simulacionId: number;
  snap: BultoSimSnapshot;
}) {
  const simulacionId = Number(params.simulacionId);
  if (!Number.isFinite(simulacionId) || simulacionId <= 0) {
    throw new Error("simulacionId inválido.");
  }

  const snap = params.snap;
  if (!snap?.items?.length) throw new Error("Snapshot vacío.");

  await prisma.$transaction(
    snap.items.map((it) => {
      const unidadesPlan = toPosInt(it.unidades_planificadas, 0);
      const cap = toPosInt(it.unidades_por_bulto, 0);
      const bultos = toPosInt(it.cantidad_bultos, 0);

      const { sobrante, ultimo } = calcUsoReal(unidadesPlan, cap, bultos);

      const dimBultoMm = toDimMmJson(it.dim_bulto_mm);

      return prisma.cubicacionProductoPlan.updateMany({
        where: {
          simulacion_id: simulacionId,
          tipo_producto_id: it.tipo_producto_id,
        },
        data: {
          // Persistencia de “plan”
          cantidad_unidades: unidadesPlan,
          cantidad_bultos: bultos,
          unidades_por_bulto: cap > 0 ? cap : null,

          // “uso real”
          sobrante_unidades: sobrante,
          unidades_en_ultimo_bulto: ultimo,

          // JSON: undefined => no tocar
          dim_bulto_mm: dimBultoMm ?? undefined,
        },
      });
    }),
  );

  return { ok: true };
}
