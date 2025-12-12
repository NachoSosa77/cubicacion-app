// src/app/cubicacion/actions/saveMultiProductoConfiguracion.ts
"use server";

import { prisma } from "@/lib/prisma";

export interface MultiProductoConfiguracionItemInput {
  tipoProductoId: number;
  cantidadUnidades: number;
  cantidadBultos: number;
  volumenTotalM3: number;
}

export interface MultiProductoConfiguracionInput {
  descripcion?: string | null;
  items: MultiProductoConfiguracionItemInput[];
}

export async function saveMultiProductoConfiguracion(
  input: MultiProductoConfiguracionInput
) {
  if (!input.items?.length) {
    throw new Error("No hay ítems para guardar");
  }

  const itemsToSave = input.items.map((item) =>
    prisma.cubicacion.create({
      data: {
        descripcion: input.descripcion ?? null,
        tipoProductoId: item.tipoProductoId,
        cantidad_unidades: item.cantidadUnidades,
        cantidadBultos: item.cantidadBultos,
        volumenTotalM3: item.volumenTotalM3,
      },
    })
  );

  return prisma.$transaction(itemsToSave);
}
