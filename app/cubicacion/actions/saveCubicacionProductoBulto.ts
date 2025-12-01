"use server";

import { prisma } from "@/lib/prisma";

export interface SaveCubicacionProductoBultoInput {
  tipoProductoId: number;
  // dimensiones originales de la unidad en mm
  largoUnidadMm: number;
  anchoUnidadMm: number;
  altoUnidadMm: number;
  // grosor de pared de la caja en mm
  grosorParedMm: number;
  // grid óptimo dentro del bulto
  unidadesEjeX: number;
  unidadesEjeY: number;
  unidadesEjeZ: number;
  // ocupación interna en %
  ocupacionInterna: number;
  // orientación final de la unidad dentro del bulto (en mm)
  orientLargoMm: number;
  orientAnchoMm: number;
  orientAltoMm: number;
}

export async function saveCubicacionProductoBulto(
  input: SaveCubicacionProductoBultoInput
) {
  const {
    tipoProductoId,
    largoUnidadMm,
    anchoUnidadMm,
    altoUnidadMm,
    grosorParedMm,
    unidadesEjeX,
    unidadesEjeY,
    unidadesEjeZ,
    ocupacionInterna,
    orientLargoMm,
    orientAnchoMm,
    orientAltoMm,
  } = input;

  if (!tipoProductoId) {
    throw new Error("tipoProductoId es requerido");
  }

  const record = await prisma.cubicacionProductoBulto.upsert({
    where: { tipo_producto_id: tipoProductoId },
    update: {
      largo_unidad_mm: largoUnidadMm,
      ancho_unidad_mm: anchoUnidadMm,
      alto_unidad_mm: altoUnidadMm,
      grosor_pared_mm: grosorParedMm,
      unidades_eje_x: unidadesEjeX,
      unidades_eje_y: unidadesEjeY,
      unidades_eje_z: unidadesEjeZ,
      ocupacion_interna: ocupacionInterna,
      orient_largo_mm: orientLargoMm,
      orient_ancho_mm: orientAnchoMm,
      orient_alto_mm: orientAltoMm,
    },
    create: {
      tipo_producto_id: tipoProductoId,
      largo_unidad_mm: largoUnidadMm,
      ancho_unidad_mm: anchoUnidadMm,
      alto_unidad_mm: altoUnidadMm,
      grosor_pared_mm: grosorParedMm,
      unidades_eje_x: unidadesEjeX,
      unidades_eje_y: unidadesEjeY,
      unidades_eje_z: unidadesEjeZ,
      ocupacion_interna: ocupacionInterna,
      orient_largo_mm: orientLargoMm,
      orient_ancho_mm: orientAnchoMm,
      orient_alto_mm: orientAltoMm,
    },
  });

  return record;
}
