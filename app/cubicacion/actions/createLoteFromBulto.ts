"use server";

import { prisma } from "@/lib/prisma";

export type CreateLoteInput = {
  empresaId: number;
  descripcion?: string | null;
  items: Array<{
    tipoProductoId: number;
    cantidadUnidades: number;
    volumenTotalM3: number;
    dimUnidadMm?: { largo: number; ancho: number; alto: number } | undefined;
    pesoUnidadKg?: number | undefined;
  }>;
};

export async function createLoteFromBulto(input: CreateLoteInput) {
  if (!input.items?.length) throw new Error("Sin ítems.");

  return prisma.$transaction(async (tx) => {
    const lote = await tx.cubicacionLote.create({
      data: {
        empresaId: input.empresaId,
        descripcion: input.descripcion ?? null,
      },
      select: { id: true },
    });

    await tx.cubicacionLoteItem.createMany({
      data: input.items.map((it) => {
        const base = {
          loteId: lote.id,
          tipoProductoId: it.tipoProductoId,
          cantidad_unidades: it.cantidadUnidades,
          volumen_total_m3: it.volumenTotalM3,
        };

        // JSON: no pasar null; solo incluir si hay valor
        const withDim =
          it.dimUnidadMm !== undefined
            ? { ...base, dim_unidad_mm: it.dimUnidadMm }
            : base;

        // Float?: null sí es aceptable, pero mantengámoslo consistente: solo incluir si hay valor
        const withPeso =
          it.pesoUnidadKg !== undefined
            ? { ...withDim, peso_unidad_kg: it.pesoUnidadKg }
            : withDim;

        return withPeso;
      }),
    });

    return { loteId: lote.id };
  });
}
