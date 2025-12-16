"use server";

import { prisma } from "@/lib/prisma";

export type CreateLoteInput = {
  empresaId: number;
  descripcion?: string | null;
  // cada item representa un SKU y cuántos bultos/cajas resultaron
  items: Array<{
    tipoProductoId: number;
    cantidadBultos: number;

    // dimensiones del bulto (mm)
    bultoLargoMm: number;
    bultoAnchoMm: number;
    bultoAltoMm: number;

    // peso del bulto (kg)
    pesoBultoKg: number;
  }>;
};

export async function createLoteFromBulto(input: CreateLoteInput) {
  if (!input.items?.length) throw new Error("Sin ítems.");

  return prisma.$transaction(async (tx) => {
    const lote = await tx.cubicacionLote.create({
      data: {
        empresa_id: input.empresaId,
        descripcion: input.descripcion ?? null,
      },
      select: { id: true },
    });

    await tx.cubicacionLoteItem.createMany({
      data: input.items.map((it) => ({
        lote_id: lote.id,
        tipo_producto_id: it.tipoProductoId,
        cantidad_bultos: it.cantidadBultos,
        bulto_largo_mm: it.bultoLargoMm,
        bulto_ancho_mm: it.bultoAnchoMm,
        bulto_alto_mm: it.bultoAltoMm,
        peso_bulto_kg: it.pesoBultoKg,
      })),
    });

    return lote;
  });
}
