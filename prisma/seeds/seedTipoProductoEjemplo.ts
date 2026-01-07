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

    // pesos/volúmenes opcionales
    peso_por_unidad_venta: null,
    peso_por_unidad_entrega: null, // ✅ corregido
    volumen_por_unidad_entrega: null,
    volumen_por_bulto: null,

    // ✅ A2 (defaults “profesionales”)
    apilable: true,
    // Si no está definido, podrías dejar NULL; para demo lo seteamos conservador.
    max_carga_superior_por_unidad_kg: "10.000",
    factor_seguridad_compresion: "0.850",
  } as const;

  // 1) CM0916BM
  await prisma.tipoProducto.upsert({
    where: { codigo: "CM0916BM" },
    update: {
      unidades_por_unidad_entrega: 12,
      alto_por_bulto: 870,
      ancho_por_bulto: 765,
      largo_por_bulto: 840,
      peso_por_bulto: "6.8645",
      volumen_por_bulto: null,

      // A2
      apilable: true,
      max_carga_superior_por_unidad_kg: "12.000",
      factor_seguridad_compresion: "0.850",

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

      // A2 (override)
      max_carga_superior_por_unidad_kg: "12.000",
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

      // A2
      apilable: true,
      max_carga_superior_por_unidad_kg: "15.000",
      factor_seguridad_compresion: "0.850",

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

      // A2 (override)
      max_carga_superior_por_unidad_kg: "15.000",
    },
  });

  // 3) CAFE-TEST-CAJA6 (recomiendo ASCII en códigos)
  await prisma.tipoProducto.upsert({
    where: { codigo: "CAFE-TEST-CAJA6" },
    update: {
      unidades_por_unidad_entrega: 6,
      largo_por_bulto: 300,
      ancho_por_bulto: 250,
      alto_por_bulto: 260,
      peso_por_bulto: "4.2",

      // A2 (más frágil)
      apilable: true,
      max_carga_superior_por_unidad_kg: "6.000",
      factor_seguridad_compresion: "0.850",

      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "CAFE-TEST-CAJA6",
      descripcion: "Caja de café test x6 frascos",
      unidades_por_unidad_entrega: 6,
      largo_por_bulto: 300,
      ancho_por_bulto: 250,
      alto_por_bulto: 260,
      peso_por_bulto: "4.2",

      // A2
      max_carga_superior_por_unidad_kg: "6.000",
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

      // A2 (robusto)
      apilable: true,
      max_carga_superior_por_unidad_kg: "40.000",
      factor_seguridad_compresion: "0.850",

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

      // A2
      max_carga_superior_por_unidad_kg: "40.000",
    },
  });

  console.log("✅ Productos demo listos.");
}
