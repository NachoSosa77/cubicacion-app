"use server";

import { prisma } from "@/lib/prisma";

export interface SaveCubicacionProductoContenedorInput {
  tipoProductoId: number;
  tipoContenedorId: number;

  // Parámetro que el usuario pudo haber definido
  alturaMaxCargaM?: number | null;

  // Resultado numérico de calcularCubicacionBultosEnPallet
  cajasPorCapa: number;
  capas: number;
  cajasTotales: number;
  productosPorCaja: number;
  productosTotales: number;
  ocupacionVolumenPorcentaje: number; // 0–100
}

export async function saveCubicacionProductoContenedor(
  input: SaveCubicacionProductoContenedorInput
) {
  const {
    tipoProductoId,
    tipoContenedorId,
    alturaMaxCargaM,
    cajasPorCapa,
    capas,
    cajasTotales,
    productosPorCaja,
    productosTotales,
    ocupacionVolumenPorcentaje,
  } = input;

  if (!tipoProductoId || !tipoContenedorId) {
    throw new Error("tipoProductoId y tipoContenedorId son requeridos");
  }

  const record = await prisma.cubicacionProductoContenedor.upsert({
    where: {
      // por el @@unique([tipo_producto_id, tipo_contenedor_id])
      tipo_producto_id_tipo_contenedor_id: {
        tipo_producto_id: tipoProductoId,
        tipo_contenedor_id: tipoContenedorId,
      },
    },
    update: {
      altura_max_carga_m: alturaMaxCargaM ?? null,
      cajas_por_capa: cajasPorCapa,
      capas,
      cajas_totales: cajasTotales,
      productos_por_caja: productosPorCaja,
      productos_totales: productosTotales,
      ocupacion_volumen: ocupacionVolumenPorcentaje,
    },
    create: {
      tipo_producto_id: tipoProductoId,
      tipo_contenedor_id: tipoContenedorId,
      altura_max_carga_m: alturaMaxCargaM ?? null,
      cajas_por_capa: cajasPorCapa,
      capas,
      cajas_totales: cajasTotales,
      productos_por_caja: productosPorCaja,
      productos_totales: productosTotales,
      ocupacion_volumen: ocupacionVolumenPorcentaje,
    },
  });

  return record;
}
