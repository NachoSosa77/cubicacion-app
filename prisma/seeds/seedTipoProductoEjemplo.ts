// prisma/seeds/seedTipoProductoEjemplo.ts
import { PrismaClient } from "@prisma/client";

export async function seedTipoProductoEjemplo(prisma: PrismaClient) {
  console.log("🧱 Creando/actualizando productos de ejemplo...");

  const divisionSolido = await prisma.divisionServicio.findFirst({
    where: { codigo: "SOLIDO" },
  });

  const unidadCajaVenta = await prisma.tipoUnidadMedidaVenta.findFirst({
    where: { codigo: "box" },
  });

  const unidadCajaEntrega = await prisma.tipoUnidadMedidaEntrega.findFirst({
    where: { codigo: "box" },
  });

  if (!divisionSolido || !unidadCajaVenta || !unidadCajaEntrega) {
    throw new Error(
      "❌ Faltan división o unidades de medida para crear los productos de ejemplo"
    );
  }

  const baseCreate = {
    division_servicio_id: divisionSolido.id,
    dadora_id: 1,
    un_venta_id: unidadCajaVenta.id,
    un_entrega_id: unidadCajaEntrega.id,
    created_at: new Date(),
    habilitado: true,
    unidad_entra_por_bulto: 1,

    // opcionales pero “pro” dejar nulos si no están definidos:
    peso_por_unidad_venta: null,
    peso_por_uniad_entrega: null,
    volumen_por_unidad_entrega: null,
    volumen_por_bulto: null,
  } as const;

  // 1) CM0916BM
  await prisma.tipoProducto.upsert({
    where: { codigo: "CM0916BM" },
    update: {
      unidades_por_unidad_entrega: 12,
      alto_por_bulto: 870,
      ancho_por_bulto: 765,
      largo_por_bulto: 840,
      peso_por_bulto: "6.8645", // Decimal as string (Prisma Decimal)
      volumen_por_bulto: null,
      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "CM0916BM",
      descripcion: "CAFETERA 12 VASO CON SWITCH",
      unidades_por_unidad_entrega: 12,
      alto_por_bulto: 870,
      ancho_por_bulto: 765,
      largo_por_bulto: 840,
      peso_por_bulto: "6.8645",
    },
  });

  // 2) GALLETAS-TEST-CAJA12
  await prisma.tipoProducto.upsert({
    where: { codigo: "GALLETAS-TEST-CAJA12" },
    update: {
      unidades_por_unidad_entrega: 12,
      largo_por_bulto: 400,
      ancho_por_bulto: 300,
      alto_por_bulto: 300,
      peso_por_bulto: "3.6",
      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "GALLETAS-TEST-CAJA12",
      descripcion: "Caja de galletas test x12",
      unidades_por_unidad_entrega: 12,
      largo_por_bulto: 400,
      ancho_por_bulto: 300,
      alto_por_bulto: 300,
      peso_por_bulto: "3.6",
    },
  });

  // 3) CAFÉ-TEST-CAJA6
  // Nota: si tu DB/colación se pone quisquillosa con tildes en códigos, lo ideal es normalizar a ASCII.
  await prisma.tipoProducto.upsert({
    where: { codigo: "CAFÉ-TEST-CAJA6" },
    update: {
      unidades_por_unidad_entrega: 6,
      largo_por_bulto: 300,
      ancho_por_bulto: 250,
      alto_por_bulto: 260,
      peso_por_bulto: "4.2",
      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "CAFÉ-TEST-CAJA6",
      descripcion: "Caja de café test x6 frascos",
      unidades_por_unidad_entrega: 6,
      largo_por_bulto: 300,
      ancho_por_bulto: 250,
      alto_por_bulto: 260,
      peso_por_bulto: "4.2",
    },
  });

  // 4) ARROZ-TEST-BOLSA10
  await prisma.tipoProducto.upsert({
    where: { codigo: "ARROZ-TEST-BOLSA10" },
    update: {
      unidades_por_unidad_entrega: 1,
      largo_por_bulto: 600,
      ancho_por_bulto: 400,
      alto_por_bulto: 180,
      peso_por_bulto: "10",
      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "ARROZ-TEST-BOLSA10",
      descripcion: "Bolsa de arroz test 10kg",
      unidades_por_unidad_entrega: 1,
      largo_por_bulto: 600,
      ancho_por_bulto: 400,
      alto_por_bulto: 180,
      peso_por_bulto: "10",
    },
  });

  console.log("✅ Productos demo listos.");
}
