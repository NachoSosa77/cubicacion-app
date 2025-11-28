"use server";

import { prisma } from "@/lib/prisma";
// 👇 Definimos un tipo liviano solo con lo que usamos en la vista
export interface ITipoProducto {
  id: number;
  codigo: string;
  descripcion: string;
  unidades_por_unidad_entrega: number;
  peso_por_unidad_venta: number;
  volumen_por_unidad_entrega: number;
  unidad_entra_por_bulto: number;
  alto_por_bulto: number;
  ancho_por_bulto: number;
  largo_por_bulto: number;
  peso_por_bulto: number;
  volumen_por_bulto: number;
}

export async function getTipoProductos(): Promise<ITipoProducto[]> {
  const productos = await prisma.tipoProducto.findMany({
    where: {
      deleted_at: null,
      habilitado: true,
    },
    orderBy: {
      descripcion: "asc",
    },
  });

  return productos;
}
