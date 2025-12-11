"use server";

import { prisma } from "@/lib/prisma";

export interface SaveCubicacionProductoBultoItemInput {
  tipoProductoId: number;
  cantidad: number;
  largoUnidadMm: number;
  anchoUnidadMm: number;
  altoUnidadMm: number;
  unidadesEjeX: number;
  unidadesEjeY: number;
  unidadesEjeZ: number;
  orientLargoMm: number;
  orientAnchoMm: number;
  orientAltoMm: number;
}

export interface SaveCubicacionProductoBultoInput {
  tipoProductoId: number;
  // grosor de pared de la caja en mm
  grosorParedMm: number;
  // ocupación interna en %
  ocupacionInterna: number;
  productos: SaveCubicacionProductoBultoItemInput[];
}

function validatePositiveInt(value: number, field: string) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} debe ser un entero positivo`);
  }
}

function validateNonNegativeNumber(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} debe ser mayor o igual a 0`);
  }
}

export async function saveCubicacionProductoBulto(
  input: SaveCubicacionProductoBultoInput
) {
  const { tipoProductoId, grosorParedMm, ocupacionInterna, productos } = input;

  if (!tipoProductoId) {
    throw new Error("tipoProductoId es requerido");
  }

  if (!Array.isArray(productos) || productos.length === 0) {
    throw new Error("Se requiere al menos un producto para configurar el bulto");
  }

  validateNonNegativeNumber(grosorParedMm, "grosorParedMm");
  if (!Number.isFinite(ocupacionInterna) || ocupacionInterna < 0 || ocupacionInterna > 100) {
    throw new Error("ocupacionInterna debe estar entre 0 y 100");
  }

  const sanitizedProductos = productos.map((prod, index) => {
    const {
      tipoProductoId: prodId,
      cantidad,
      largoUnidadMm,
      anchoUnidadMm,
      altoUnidadMm,
      unidadesEjeX,
      unidadesEjeY,
      unidadesEjeZ,
      orientLargoMm,
      orientAnchoMm,
      orientAltoMm,
    } = prod;

    validatePositiveInt(prodId, `productos[${index}].tipoProductoId`);
    validatePositiveInt(cantidad, `productos[${index}].cantidad`);
    validatePositiveInt(largoUnidadMm, `productos[${index}].largoUnidadMm`);
    validatePositiveInt(anchoUnidadMm, `productos[${index}].anchoUnidadMm`);
    validatePositiveInt(altoUnidadMm, `productos[${index}].altoUnidadMm`);
    validatePositiveInt(unidadesEjeX, `productos[${index}].unidadesEjeX`);
    validatePositiveInt(unidadesEjeY, `productos[${index}].unidadesEjeY`);
    validatePositiveInt(unidadesEjeZ, `productos[${index}].unidadesEjeZ`);
    validatePositiveInt(orientLargoMm, `productos[${index}].orientLargoMm`);
    validatePositiveInt(orientAnchoMm, `productos[${index}].orientAnchoMm`);
    validatePositiveInt(orientAltoMm, `productos[${index}].orientAltoMm`);

    return {
      tipoProductoId: prodId,
      cantidad,
      largoUnidadMm,
      anchoUnidadMm,
      altoUnidadMm,
      unidadesEjeX,
      unidadesEjeY,
      unidadesEjeZ,
      orientLargoMm,
      orientAnchoMm,
      orientAltoMm,
    };
  });

  const firstProducto = sanitizedProductos[0];

  const record = await prisma.$transaction(async (tx) => {
    const bulto = await tx.cubicacionProductoBulto.upsert({
      where: { tipo_producto_id: tipoProductoId },
      update: {
        largo_unidad_mm: firstProducto.largoUnidadMm,
        ancho_unidad_mm: firstProducto.anchoUnidadMm,
        alto_unidad_mm: firstProducto.altoUnidadMm,
        grosor_pared_mm: grosorParedMm,
        unidades_eje_x: firstProducto.unidadesEjeX,
        unidades_eje_y: firstProducto.unidadesEjeY,
        unidades_eje_z: firstProducto.unidadesEjeZ,
        ocupacion_interna: ocupacionInterna,
        orient_largo_mm: firstProducto.orientLargoMm,
        orient_ancho_mm: firstProducto.orientAnchoMm,
        orient_alto_mm: firstProducto.orientAltoMm,
      },
      create: {
        tipo_producto_id: tipoProductoId,
        largo_unidad_mm: firstProducto.largoUnidadMm,
        ancho_unidad_mm: firstProducto.anchoUnidadMm,
        alto_unidad_mm: firstProducto.altoUnidadMm,
        grosor_pared_mm: grosorParedMm,
        unidades_eje_x: firstProducto.unidadesEjeX,
        unidades_eje_y: firstProducto.unidadesEjeY,
        unidades_eje_z: firstProducto.unidadesEjeZ,
        ocupacion_interna: ocupacionInterna,
        orient_largo_mm: firstProducto.orientLargoMm,
        orient_ancho_mm: firstProducto.orientAnchoMm,
        orient_alto_mm: firstProducto.orientAltoMm,
      },
    });

    await tx.cubicacionProductoBultoItem.deleteMany({
      where: { cubicacion_producto_bulto_id: bulto.id },
    });

    await tx.cubicacionProductoBultoItem.createMany({
      data: sanitizedProductos.map((prod) => ({
        cubicacion_producto_bulto_id: bulto.id,
        tipo_producto_id: prod.tipoProductoId,
        cantidad: prod.cantidad,
        largo_unidad_mm: prod.largoUnidadMm,
        ancho_unidad_mm: prod.anchoUnidadMm,
        alto_unidad_mm: prod.altoUnidadMm,
        unidades_eje_x: prod.unidadesEjeX,
        unidades_eje_y: prod.unidadesEjeY,
        unidades_eje_z: prod.unidadesEjeZ,
        orient_largo_mm: prod.orientLargoMm,
        orient_ancho_mm: prod.orientAnchoMm,
        orient_alto_mm: prod.orientAltoMm,
      })),
    });

    return tx.cubicacionProductoBulto.findUnique({
      where: { id: bulto.id },
      include: {
        items: true,
      },
    });
  });

  return record;
}
