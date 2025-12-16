// app/cubicacion/actions/reglasActions.ts
"use server";
import { prisma } from "@/lib/prisma";

export async function getReglaPallet(
  empresaId: number,
  tipoContenedorId: number
) {
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId,
    },
    orderBy: { id: "desc" },
  });

  const reglaGlobal = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: null,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  const r = regla ?? reglaGlobal;

  return {
    permitirMezcla: r?.permitirMezcla ?? true,
    maxCodigosPorPallet: r?.maxCodigosPorPallet ?? null,
    maxAlturaM: r?.maxAlturaM ? Number(r.maxAlturaM) : null,
  };
}
