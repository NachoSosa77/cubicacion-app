"use server";

import { prisma } from "@/lib/prisma";

// 👇 Definimos un tipo liviano solo con lo que usamos en la vista
export interface ITipoContenedor {
  id: number;
  codigo: string;
  descripcion: string;
  largo_mts: number;
  ancho_mts: number;
  alto_mts: number;
  // si después usás más campos, los agregamos acá
}

export async function getTipoContenedores(): Promise<ITipoContenedor[]> {
  const contenedores = await prisma.tipoContenedor.findMany({
    where: {
      habilitado: true,
      deleted_at: null,
    },
    orderBy: { codigo: "asc" },
  });

  // Prisma devuelve algo compatible con ITipoContenedor (tiene esas props),
  // así que esto es totalmente válido para TS.
  return contenedores;
}
