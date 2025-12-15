// src/app/cubicacion/actions/saveMultiProductoConfiguracion.ts
"use server";

import { prisma } from "@/lib/prisma";
import type { PackingPolicy } from "../lib/packing-policy";

export interface MultiProductoConfiguracionItemInput {
  tipoProductoId: number;
  cantidadUnidades: number;
  cantidadBultos: number;
  volumenTotalM3: number;
}

export interface MultiProductoConfiguracionInput {
  descripcion?: string | null;
  packingPolicy: PackingPolicy;
  tipoBulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bultoEmpresaId?: number | null;
  items: MultiProductoConfiguracionItemInput[];
}

export async function saveMultiProductoConfiguracion(
  input: MultiProductoConfiguracionInput
) {
  if (!input.items?.length) {
    throw new Error("No hay ítems para guardar");
  }

  return prisma.$transaction(
    input.items.map((item) =>
      prisma.cubicacion.create({
        data: {
          descripcion: input.descripcion ?? null,

          // 🔑 decisiones operativas
          packing_policy: input.packingPolicy,
          tipo_bulto: input.tipoBulto,
          bulto_empresa_id: input.bultoEmpresaId ?? null,

          // 🔢 datos de cálculo
          tipoProductoId: item.tipoProductoId,
          cantidad_unidades: item.cantidadUnidades,
          cantidadBultos: item.cantidadBultos,
          volumenTotalM3: item.volumenTotalM3,
        },
      })
    )
  );
}
