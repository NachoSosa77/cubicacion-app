// app/cubicacion/actions/cubicacionProductoBultoActions.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getCubicacionProductoBulto(tipoProductoId: number) {
  const cfg = await prisma.cubicacionProductoBulto.findUnique({
    where: { tipo_producto_id: tipoProductoId },
    include: {
      items: {
        include: {
          tipoProducto: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
            },
          },
        },
      },
    },
  });

  return cfg; // o null
}
