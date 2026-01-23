"use server";

import { prisma } from "@/lib/prisma";

function posInt(v: unknown, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

export async function createLoteFromSimulacion(params: {
  simulacionId: number;
  // opcional: forzar tipo_bulto, packing_policy, etc.
  titulo?: string;
  descripcion?: string;
}) {
  const simulacionId = Number(params.simulacionId);
  if (!Number.isFinite(simulacionId) || simulacionId <= 0) {
    throw new Error("simulacionId inválido.");
  }

  return prisma.$transaction(async (tx) => {
    // 1) Traer simulación + productos plan
    const sim = await tx.cubicacionSimulacion.findUnique({
      where: { id: simulacionId },
      select: {
        id: true,
        empresa_id: true,
        lote_id: true,
        titulo: true,
        descripcion: true,
        status: true,
        productos: {
          select: {
            tipo_producto_id: true,
            codigo: true,
            descripcion: true,
            cantidad_unidades: true,
            cantidad_bultos: true,
            unidades_por_bulto: true,
            dim_unidad_mm: true,
            peso_unidad_kg: true,
            dim_bulto_mm: true,
            // si tenés sobrante/unidades_en_ultimo_bulto también podés copiarlo,
            // pero no es estrictamente necesario para crear el lote
          },
        },
      },
    });

    if (!sim) throw new Error(`No existe simulación #${simulacionId}.`);

    // Si ya tiene lote, devolvés el lote existente (idempotencia)
    if (sim.lote_id) {
      return { loteId: sim.lote_id, alreadyExisted: true };
    }

    if (!sim.productos.length) {
      throw new Error("La simulación no tiene productos planificados.");
    }

    // 2) Crear Lote
    // IMPORTANTE: ajustá estos campos a tu modelo CubicacionLote real.
    // Aquí supongo que tenés empresa_id, descripcion, status, packing_policy, tipo_bulto, etc.
    const lote = await tx.cubicacionLote.create({
      data: {
        empresa_id: sim.empresa_id,
        descripcion:
          params.descripcion ??
          sim.descripcion ??
          sim.titulo ??
          `Lote desde simulación #${sim.id}`,
        status: "BORRADOR",
        unidades_totales: 0,
        bultos_totales: 0,
        // valores default razonables (ajustá a tus enums reales)
        packing_policy: "OPERATIVO_AGRUPADO",
        tipo_bulto: "EMPRESA_BULTO",
        meta: { origen: "SIMULACION", simulacion_id: sim.id },
      } as any,
      select: { id: true },
    });

    // 3) Crear items de lote desde productos plan
    // Ajustá nombres: cubicacionLoteItem y campos exactos.
    await tx.cubicacionLoteItem.createMany({
      data: sim.productos.map((p) => ({
        lote_id: lote.id, // o loteId según tu schema
        tipo_producto_id: p.tipo_producto_id,
        cantidad_unidades: posInt(p.cantidad_unidades, 0),
        cantidad_bultos: posInt(p.cantidad_bultos, 0),
        unidades_por_bulto: p.unidades_por_bulto ?? null,
        dim_unidad_mm: p.dim_unidad_mm ?? null,
        peso_unidad_kg: p.peso_unidad_kg ?? null,
        dim_bulto_mm: p.dim_bulto_mm ?? null,
        // volumen_total_m3 si lo calculás en DB/trigger, dejalo; si es requerido, calculalo acá
      })) as any,
    });

    // 4) Recalcular totales del lote
    const totals = sim.productos.reduce(
      (acc, p) => {
        acc.unidades += posInt(p.cantidad_unidades, 0);
        acc.bultos += posInt(p.cantidad_bultos, 0);
        return acc;
      },
      { unidades: 0, bultos: 0 },
    );

    await tx.cubicacionLote.update({
      where: { id: lote.id },
      data: {
        unidades_totales: totals.unidades,
        bultos_totales: totals.bultos,
      } as any,
    });

    // 5) Asociar lote a simulación
    await tx.cubicacionSimulacion.update({
      where: { id: sim.id },
      data: { lote_id: lote.id },
    });

    return { loteId: lote.id, alreadyExisted: false };
  });
}
