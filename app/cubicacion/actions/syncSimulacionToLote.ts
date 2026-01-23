"use server";

import { prisma } from "@/lib/prisma";

export async function syncSimulacionToLote(params: { simulacionId: number }) {
  const { simulacionId } = params;

  return prisma.$transaction(async (tx) => {
    const sim = await tx.cubicacionSimulacion.findUnique({
      where: { id: simulacionId },
      select: { id: true, empresa_id: true, lote_id: true },
    });
    if (!sim) throw new Error("Simulación no encontrada.");

    if (!sim.lote_id) throw new Error("La simulación no tiene lote asociado.");

    const loteId = sim.lote_id;

    const productos = await tx.cubicacionProductoPlan.findMany({
      where: { simulacion_id: simulacionId },
      select: {
        codigo: true,
        cantidad_unidades: true,
        tipo_producto_id: true,
        // si guardás dim_unidad en producto_plan, incluilo aquí:
        dim_unidad_mm: true,
        peso_unidad_kg: true,
      } as any,
      orderBy: { id: "asc" },
    });

    if (!productos.length) {
      throw new Error("No hay productos cargados para materializar el lote.");
    }

    // (A) Vaciar items actuales del lote (modelo simple y consistente)
    await tx.cubicacionLoteItem.deleteMany({ where: { lote_id: loteId } });

    // (B) Crear items del lote a partir del plan de productos
    // Nota: ajustá nombres de campos según tu modelo CubicacionLoteItem real
    await tx.cubicacionLoteItem.createMany({
      data: productos.map((p: any) => ({
        lote_id: loteId,
        tipo_producto_id: p.tipo_producto_id ?? null,
        codigo: p.codigo,
        cantidad_unidades: Number(p.cantidad_unidades ?? 0),
        cantidad_bultos: 0,
        unidades_por_bulto: null,
        volumen_total_m3: 0,
        dim_unidad_mm: p.dim_unidad_mm ?? null,
        peso_unidad_kg: p.peso_unidad_kg ?? null,
      })),
    });

    // (C) Recalcular totales del lote
    const unidades_totales = productos.reduce(
      (acc: number, p: any) => acc + Number(p.cantidad_unidades ?? 0),
      0,
    );

    await tx.cubicacionLote.update({
      where: { id: loteId },
      data: {
        unidades_totales,
        // bultos_totales lo podés recalcular en BultoPanel y luego persistir con apply snapshot
        bultos_totales: 0,
      },
    });

    return { loteId, unidades_totales, items: productos.length };
  });
}
