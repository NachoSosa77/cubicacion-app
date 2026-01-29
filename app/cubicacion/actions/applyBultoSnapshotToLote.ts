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

function mapFuente(candidateKey: "A" | "B" | "C" | "D") {
  // Enum Prisma esperado: BultoFuente { CATALOGO, OPERATIVO, EMPRESA_BULTO }
  if (candidateKey === "A") return "CATALOGO" as const;
  if (candidateKey === "B" || candidateKey === "D")
    return "EMPRESA_BULTO" as const;
  return "OPERATIVO" as const; // C
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

export async function applyBultoSnapshotToLote(params: {
  loteId: number;
  snap: BultoSimSnapshot;
}) {
  const loteId = Number(params.loteId);
  if (!Number.isFinite(loteId) || loteId <= 0) {
    throw new Error("loteId inválido.");
  }

  const snap = params.snap;
  if (!snap?.items?.length) throw new Error("Snapshot vacío.");

  // Confirmamos lote y sus items (para validar que el SKU existe en el lote)
  const lote = await prisma.cubicacionLote.findUnique({
    where: { id: loteId },
    select: {
      id: true,
      items: { select: { id: true, tipo_producto_id: true } },
    },
  });
  if (!lote) throw new Error("Lote inexistente.");

  const itemByTipoProductoId = new Map<number, { id: number }>();
  for (const it of lote.items) {
    itemByTipoProductoId.set(it.tipo_producto_id, { id: it.id });
  }

  const bultoFuente = mapFuente(snap.candidateKey);

  const ops: Prisma.PrismaPromise<any>[] = [];

  for (const s of snap.items) {
    const tipoId = Number(s.tipo_producto_id);
    if (!Number.isFinite(tipoId) || tipoId <= 0) continue;

    const row = itemByTipoProductoId.get(tipoId);
    if (!row) continue;

    const unidadesPlan = toPosInt(s.unidades_planificadas, 0);
    const cap = toPosInt(s.unidades_por_bulto, 0);
    const bultos = toPosInt(s.cantidad_bultos, 0);

    const { sobrante, ultimo } = calcUsoReal(unidadesPlan, cap, bultos);

    const dimBultoMm = toDimMmJson(s.dim_bulto_mm);

    const bultoEmpresaId =
      snap.candidateKey === "B" || snap.candidateKey === "D"
        ? Number(s.audit?.bultoEmpresaId ?? 0) || null
        : undefined; // <- en vez de null

    ops.push(
      prisma.cubicacionLoteItem.update({
        where: { id: row.id },
        data: {
          cantidad_unidades: unidadesPlan,
          unidades_por_bulto: cap > 0 ? cap : null,
          cantidad_bultos: bultos > 0 ? bultos : 0,
          sobrante_unidades: sobrante,
          unidades_en_ultimo_bulto: ultimo,
          dim_bulto_mm: dimBultoMm ?? undefined,
          bulto_fuente: bultoFuente,
          bulto_empresa_id: bultoEmpresaId,
        },
      }),
    );
  }

  if (ops.length === 0) return { ok: true };
  await prisma.$transaction(ops);

  return { ok: true };
}
