"use server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function commitProductosYContinuar(simulacionId: number) {
  const { loteId } = await prisma.$transaction(async (tx) => {
    const sim = await tx.cubicacionSimulacion.findUnique({
      where: { id: simulacionId },
    });
    if (!sim) throw new Error("Simulación no encontrada.");

    // asegurar lote
    let loteId = sim.lote_id ?? null;
    if (!loteId) {
      const lote = await tx.cubicacionLote.create({
        data: {
          empresa_id: sim.empresa_id,
          descripcion: sim.titulo ?? "Lote generado por simulación",
          packing_policy: "OPERATIVO_AGRUPADO",
          tipo_bulto: "EMPRESA_BULTO",
          unidades_totales: 0,
          bultos_totales: 0,
        },
      });
      loteId = lote.id;

      await tx.cubicacionSimulacion.update({
        where: { id: simulacionId },
        data: { lote_id: loteId },
      });
    }

    // leer productos
    const productos = await tx.cubicacionProductoPlan.findMany({
      where: { simulacion_id: simulacionId },
      select: {
        codigo: true,
        cantidad_unidades: true,
        tipo_producto_id: true,
        dim_unidad_mm: true,
        peso_unidad_kg: true,
      } as any,
    });
    if (!productos.length) throw new Error("No hay productos cargados.");

    // resync items
    await tx.cubicacionLoteItem.deleteMany({ where: { lote_id: loteId } });

    await tx.cubicacionLoteItem.createMany({
      data: productos.map((p: any) => ({
        lote_id: loteId,
        tipo_producto_id: p.tipo_producto_id ?? null,
        cantidad_unidades: Number(p.cantidad_unidades ?? 0),
        cantidad_bultos: 0,
        unidades_por_bulto: null,
        volumen_total_m3: 0, // o calcVolumenTotalM3(p)
        dim_unidad_mm: p.dim_unidad_mm ?? null,
        peso_unidad_kg: p.peso_unidad_kg ?? null,
      })),
    });

    const unidades_totales = productos.reduce(
      (acc: number, p: any) => acc + Number(p.cantidad_unidades ?? 0),
      0,
    );

    await tx.cubicacionLote.update({
      where: { id: loteId },
      data: { unidades_totales },
    });

    return { loteId };
  });

  redirect(`/cubicacion/simulacion/${simulacionId}?step=1`);
}
