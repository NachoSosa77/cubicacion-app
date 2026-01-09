"use server";

import { prisma } from "@/lib/prisma";

export type CreateLoteInput = {
  empresa_id: number;
  descripcion?: string | null;

  items: Array<{
    tipo_producto_id: number;
    cantidad_unidades: number;
    volumen_total_m3: number;

    // snapshot reproducible
    dim_unidad_mm?: { largo: number; ancho: number; alto: number } | undefined;
    peso_unidad_kg?: number | undefined;

    // consistencia (si viene del UI o lo derivamos)
    unidades_por_bulto?: number | undefined;
    cantidad_bultos?: number | undefined;
  }>;
};

const ceilDiv = (a: number, b: number) => (b <= 0 ? 0 : Math.ceil(a / b));

export async function createLoteFromBulto(input: CreateLoteInput) {
  if (!input.items?.length) throw new Error("Sin ítems.");

  // Validación mínima defensiva
  for (const [idx, it] of input.items.entries()) {
    if (!Number.isFinite(it.tipo_producto_id) || it.tipo_producto_id <= 0) {
      throw new Error(`Item ${idx + 1}: tipo_producto_id inválido.`);
    }
    if (!Number.isFinite(it.cantidad_unidades) || it.cantidad_unidades <= 0) {
      throw new Error(`Item ${idx + 1}: cantidad_unidades inválida.`);
    }
    if (!Number.isFinite(it.volumen_total_m3) || it.volumen_total_m3 < 0) {
      throw new Error(`Item ${idx + 1}: volumen_total_m3 inválido.`);
    }
    if (it.unidades_por_bulto !== undefined) {
      const upb = Number(it.unidades_por_bulto);
      if (!Number.isFinite(upb) || upb <= 0) {
        throw new Error(`Item ${idx + 1}: unidades_por_bulto inválida.`);
      }
    }
    if (it.cantidad_bultos !== undefined) {
      const cb = Number(it.cantidad_bultos);
      if (!Number.isFinite(cb) || cb <= 0) {
        throw new Error(`Item ${idx + 1}: cantidad_bultos inválida.`);
      }
    }
  }

  // Totales lote (snapshot)
  const unidades_totales = input.items.reduce(
    (acc, it) => acc + it.cantidad_unidades,
    0
  );

  // Derivación: si no viene cantidad_bultos pero sí unidades_por_bulto -> ceilDiv
  const itemsDerived = input.items.map((it) => {
    const unidades_por_bulto =
      it.unidades_por_bulto !== undefined
        ? Number(it.unidades_por_bulto)
        : null;

    const cantidad_bultos =
      it.cantidad_bultos !== undefined
        ? Number(it.cantidad_bultos)
        : unidades_por_bulto && unidades_por_bulto > 0
        ? ceilDiv(it.cantidad_unidades, unidades_por_bulto)
        : 1; // default del modelo

    return { ...it, unidades_por_bulto, cantidad_bultos };
  });

  const bultos_totales = itemsDerived.reduce(
    (acc, it) => acc + (it.cantidad_bultos ?? 1),
    0
  );

  return prisma.$transaction(async (tx) => {
    const lote = await tx.cubicacionLote.create({
      data: {
        empresa_id: input.empresa_id,
        descripcion: input.descripcion ?? null,
        unidades_totales,
        bultos_totales,
      },
      select: { id: true },
    });

    await tx.cubicacionLoteItem.createMany({
      data: itemsDerived.map((it) => {
        const base: {
          lote_id: number;
          tipo_producto_id: number;
          cantidad_unidades: number;
          cantidad_bultos: number;
          unidades_por_bulto?: number | null;
          volumen_total_m3: number;
          dim_unidad_mm?: any;
          peso_unidad_kg?: number;
        } = {
          lote_id: lote.id,
          tipo_producto_id: it.tipo_producto_id,
          cantidad_unidades: it.cantidad_unidades,
          cantidad_bultos: it.cantidad_bultos ?? 1,
          volumen_total_m3: it.volumen_total_m3,
        };

        // opcionales
        if (
          it.unidades_por_bulto !== null &&
          it.unidades_por_bulto !== undefined
        )
          base.unidades_por_bulto = it.unidades_por_bulto;

        if (it.dim_unidad_mm !== undefined)
          base.dim_unidad_mm = it.dim_unidad_mm;
        if (it.peso_unidad_kg !== undefined)
          base.peso_unidad_kg = it.peso_unidad_kg;

        return base;
      }),
    });

    return { loteId: lote.id };
  });
}
