"use server";

import { prisma } from "@/lib/prisma";
// 👇 Definimos un tipo liviano solo con lo que usamos en la vista
export interface ICubicacionProductoBultoItem {
  id: number;
  tipo_producto_id: number;
  cantidad: number;
  largo_unidad_mm: number;
  ancho_unidad_mm: number;
  alto_unidad_mm: number;
  unidades_eje_x: number;
  unidades_eje_y: number;
  unidades_eje_z: number;
  orient_largo_mm: number;
  orient_ancho_mm: number;
  orient_alto_mm: number;
  tipoProducto?: {
    id: number;
    codigo: string;
    descripcion: string;
  };
}

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
  cubicacionProductoBulto?: {
    id: number;
    items: ICubicacionProductoBultoItem[];
  } | null;
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
    include: {
      cubicacionProductoBulto: {
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
      },
    },
  });

  return productos;
}
