"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PackingPolicy } from "../lib/packing-policy";

export interface MultiProductoConfiguracionItemInput {
  tipoProductoId: number;
  cantidadUnidades: number;

  // ✅ ahora SÍ se persisten en lote_item
  cantidadBultos: number;
  unidadesPorBulto: number;

  volumenTotalM3: number;

  // ✅ snapshot reproducible (opcional pero recomendado)
  dimUnidadMm?: { largo: number; ancho: number; alto: number } | null;
  pesoUnidadKg?: number | null;
}

export interface MultiProductoConfiguracionInput {
  descripcion?: string | null;
  packingPolicy: PackingPolicy;
  tipoBulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bultoEmpresaId?: number | null;
  items: MultiProductoConfiguracionItemInput[];
}

export type SaveMultiProductoConfiguracionResult = {
  loteId: number;
};

function assertValidInput(input: MultiProductoConfiguracionInput) {
  if (!input.items?.length) throw new Error("No hay ítems para guardar.");

  for (const [idx, it] of input.items.entries()) {
    if (!Number.isInteger(it.tipoProductoId) || it.tipoProductoId <= 0) {
      throw new Error(`Item ${idx + 1}: tipoProductoId inválido.`);
    }
    if (!Number.isFinite(it.cantidadUnidades) || it.cantidadUnidades <= 0) {
      throw new Error(`Item ${idx + 1}: cantidadUnidades inválida.`);
    }

    // ✅ NUEVO: validamos snapshot del pack elegido
    if (!Number.isFinite(it.unidadesPorBulto) || it.unidadesPorBulto <= 0) {
      throw new Error(`Item ${idx + 1}: unidadesPorBulto inválido.`);
    }
    if (!Number.isFinite(it.cantidadBultos) || it.cantidadBultos <= 0) {
      throw new Error(`Item ${idx + 1}: cantidadBultos inválida.`);
    }

    if (!Number.isFinite(it.volumenTotalM3) || it.volumenTotalM3 <= 0) {
      throw new Error(`Item ${idx + 1}: volumenTotalM3 inválido.`);
    }
  }

  if (input.tipoBulto === "EMPRESA_BULTO") {
    if (
      input.bultoEmpresaId == null ||
      !Number.isInteger(input.bultoEmpresaId) ||
      input.bultoEmpresaId <= 0
    ) {
      throw new Error("bultoEmpresaId inválido para tipoBulto EMPRESA_BULTO.");
    }
  }
}

export async function saveMultiProductoConfiguracion(
  input: MultiProductoConfiguracionInput
): Promise<SaveMultiProductoConfiguracionResult> {
  assertValidInput(input);

  const empresa_id = 1; // TODO: derivar desde usuario logueado

  const itemsData = input.items.map((it) => ({
    tipo_producto_id: it.tipoProductoId,
    cantidad_unidades: it.cantidadUnidades,
    cantidad_bultos: it.cantidadBultos,
    unidades_por_bulto: it.unidadesPorBulto,
    volumen_total_m3: it.volumenTotalM3,
    dim_unidad_mm: it.dimUnidadMm
      ? (it.dimUnidadMm as Prisma.InputJsonValue)
      : Prisma.DbNull,
    peso_unidad_kg: it.pesoUnidadKg ?? null,
  }));

  const res = await prisma.$transaction(
    async (tx) => {
      const lote = await tx.cubicacionLote.create({
        data: {
          empresa: { connect: { id: empresa_id } },
          descripcion: input.descripcion ?? null,
          packing_policy: input.packingPolicy as any,
          tipo_bulto: input.tipoBulto as any,
          ...(input.tipoBulto === "EMPRESA_BULTO"
            ? { bulto_empresa: { connect: { id: input.bultoEmpresaId! } } }
            : {}),
        },
        select: { id: true },
      });

      await tx.cubicacionLoteItem.createMany({
        data: itemsData.map((d) => ({
          lote_id: lote.id,
          ...d,
        })),
      });

      // ✅ opcional: setear totales del lote desde input (consistencia)
      const unidades_totales = input.items.reduce(
        (acc, it) => acc + it.cantidadUnidades,
        0
      );
      const bultos_totales = input.items.reduce(
        (acc, it) => acc + it.cantidadBultos,
        0
      );

      await tx.cubicacionLote.update({
        where: { id: lote.id },
        data: { unidades_totales, bultos_totales },
      });

      return { loteId: lote.id };
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  return res;
}
