"use server";

import { prisma } from "@/lib/prisma";
import { calcularPalletPlan } from "../lib/packing-pallet";

export async function evaluarPallet(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;
  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
  objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
}) {
  const { empresaId, loteId, tipoContenedorId } = params;

  const [contenedor, lote] = await Promise.all([
    prisma.tipoContenedor.findUnique({ where: { id: tipoContenedorId } }),
    prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      include: {
        items: { include: { tipoProducto: true } },
      },
    }),
  ]);

  if (!contenedor) throw new Error("Contenedor inexistente.");
  if (!lote) throw new Error("Lote inexistente.");

  // regla más específica que puedas resolver:
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  const plan = calcularPalletPlan({
    contenedor: {
      id: contenedor.id,
      codigo: contenedor.codigo,
      largo_mts: contenedor.largo_mts,
      ancho_mts: contenedor.ancho_mts,
      alto_mts: contenedor.alto_mts,
      peso_pallet_kg: contenedor.peso_pallet_kg,
      peso_max_kg: contenedor.peso_max_kg,
    },
    reglas: regla
      ? {
          maxAlturaM: regla.maxAlturaM ? Number(regla.maxAlturaM) : null,
          maxCodigosPorPallet: regla.maxCodigosPorPallet ?? null,
          permitirMezcla: regla.permitirMezcla,
        }
      : null,
    mixPolicy: params.mixPolicy,
    objective: params.objective,
    items: lote.items.map((it) => ({
      tipoProductoId: it.tipo_producto_id,
      codigo: (it.tipoProducto as any).codigo ?? `PROD-${it.tipo_producto_id}`,
      descripcion: (it.tipoProducto as any).descripcion ?? "",
      cantidadBultos: it.cantidad_bultos,
      dimBultoMm: {
        largo: it.bulto_largo_mm,
        ancho: it.bulto_ancho_mm,
        alto: it.bulto_alto_mm,
      },
      pesoBultoKg: Number(it.peso_bulto_kg),
    })),
  });

  // persistimos PalletPlan (solo resumen + items)
  const saved = await prisma.$transaction(async (tx) => {
    await tx.palletPlanItem.deleteMany({
      where: {
        plan: { lote_id: loteId, tipo_contenedor_id: tipoContenedorId },
      },
    });
    await tx.palletPlan.deleteMany({
      where: { lote_id: loteId, tipo_contenedor_id: tipoContenedorId },
    });

    const p = await tx.palletPlan.create({
      data: {
        lote_id: loteId,
        tipo_contenedor_id: tipoContenedorId,
        mix_policy: params.mixPolicy,
        objective: params.objective,

        pallets_requeridos: plan.palletsRequeridos,
        cajas_en_pallet1: plan.pallet1.cajasTotales,
        capas_pallet1: plan.pallet1.capas,
        cajas_por_capa_pallet1: plan.pallet1.cajasPorCapa,

        ocupacion_base_pct: plan.pallet1.ocupacionBasePct,
        ocupacion_volumen_pct: plan.pallet1.ocupacionVolumenPct,

        peso_total_pallet1_kg: plan.pallet1.pesoTotalKg,
        altura_total_pallet1_m: plan.pallet1.alturaTotalM,

        warnings: plan.pallet1.warnings as any,
      },
      select: { id: true },
    });

    if (plan.pallet1.items.length) {
      await tx.palletPlanItem.createMany({
        data: plan.pallet1.items.map((x) => ({
          pallet_plan_id: p.id,
          tipo_producto_id: x.tipoProductoId,
          bultos_en_pallet1: x.bultosEnPallet1,
          por_capa: x.porCapa,
        })),
      });
    }

    return p;
  });

  return {
    plan,
    palletPlanId: saved.id,
  };
}
