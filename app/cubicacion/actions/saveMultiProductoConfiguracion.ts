"use server";

import { prisma } from "@/lib/prisma";

export interface MultiProductoConfiguracionItemInput {
  tipoProductoId: number;
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

  const itemsToSave = input.items.map((item) => {
    if (!item.tipoProductoId || item.cantidadBultos <= 0) {
      throw new Error("Datos de producto inválidos");
    }

    return prisma.cubicacion.create({
      data: {
        descripcion: input.descripcion ?? null,
        tipoProductoId: item.tipoProductoId,
        cantidadBultos: item.cantidadBultos,
        volumenTotalM3: item.volumenTotalM3,
      },
    });
  });

  return prisma.$transaction(itemsToSave);
}
