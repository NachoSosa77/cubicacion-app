// app/cubicacion/actions/cubicacionProductoBultoActions.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getCubicacionProductoBulto(tipoProductoId: number) {
  const cfg = await prisma.cubicacionProductoBulto.findUnique({
    where: { tipo_producto_id: tipoProductoId },
  });

  return cfg; // o null
}
