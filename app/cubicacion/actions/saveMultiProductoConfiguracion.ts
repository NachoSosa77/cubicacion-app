// src/app/cubicacion/actions/saveMultiProductoConfiguracion.ts
"use server";

import { prisma } from "@/lib/prisma";
import type { PackingPolicy } from "../lib/packing-policy";

export interface MultiProductoConfiguracionItemInput {
  tipoProductoId: number;
  cantidadUnidades: number;
  cantidadBultos: number; // hoy no se persiste en lote_item (tu modelo no lo tiene)
  volumenTotalM3: number;
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

export async function saveMultiProductoConfiguracion(
  input: MultiProductoConfiguracionInput
): Promise<SaveMultiProductoConfiguracionResult> {
  if (!input.items?.length) throw new Error("No hay ítems para guardar.");

  // Profesional: validar mínimamente
  for (const [idx, it] of input.items.entries()) {
    if (!Number.isInteger(it.tipoProductoId) || it.tipoProductoId <= 0) {
      throw new Error(`Item ${idx + 1}: tipoProductoId inválido.`);
    }
    if (!Number.isFinite(it.cantidadUnidades) || it.cantidadUnidades <= 0) {
      throw new Error(`Item ${idx + 1}: cantidadUnidades inválida.`);
    }
    if (!Number.isFinite(it.volumenTotalM3) || it.volumenTotalM3 <= 0) {
      throw new Error(`Item ${idx + 1}: volumenTotalM3 inválido.`);
    }
  }

  const empresaId = 1; // TODO: derivar desde usuario logueado

  const res = await prisma.$transaction(async (tx) => {
    // 1) lote
    const lote = await tx.cubicacionLote.create({
      data: {
        empresaId,
        descripcion: input.descripcion ?? null,
        packing_policy: input.packingPolicy as any,
        tipo_bulto: input.tipoBulto as any,
        bulto_empresa_id: input.bultoEmpresaId ?? null,
      },
      select: { id: true },
    });

    // 2) items
    await tx.cubicacionLoteItem.createMany({
      data: input.items.map((it) => ({
        loteId: lote.id,
        tipoProductoId: it.tipoProductoId,
        cantidad_unidades: it.cantidadUnidades,
        volumen_total_m3: it.volumenTotalM3,
        // dim_unidad_mm / peso_unidad_kg: si después querés persistirlo, se agrega acá
      })),
    });

    return { loteId: lote.id };
  });

  return res;
}
