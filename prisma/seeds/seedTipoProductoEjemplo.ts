import { PrismaClient } from "@prisma/client";

/* =========================
   Helpers (constantes)
========================= */

function mm3ToM3(mm3: number) {
  return mm3 / 1_000_000_000;
}

function calcVolumenPorBultoM3(
  largoMm: number,
  anchoMm: number,
  altoMm: number
) {
  return mm3ToM3(largoMm * anchoMm * altoMm);
}

// Prisma Decimal acepta string
function divStr(a: number, b: number) {
  return (a / b).toFixed(6);
}

/* =========================
   Seed
========================= */

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
    unidades_por_unidad_entrega: 1,

    // Defaults “robustos”
    apilable: true,
    max_carga_superior_por_unidad_kg: "10.000",
    factor_seguridad_compresion: "0.850",

    // Se completan por producto
    peso_por_unidad_venta: null,
    peso_por_unidad_entrega: null,
    volumen_por_unidad_entrega: null,
    volumen_por_bulto: null,
  } as const;

  /* =========================
     Volúmenes calculados
  ========================= */

  const cmVolM3 = calcVolumenPorBultoM3(840, 765, 870);
  const gVolM3 = calcVolumenPorBultoM3(400, 300, 300);
  const cVolM3 = calcVolumenPorBultoM3(300, 250, 260);
  const aVolM3 = calcVolumenPorBultoM3(600, 400, 180);

  /* =========================
     1) CM0916BM
  ========================= */

  await prisma.tipoProducto.upsert({
    where: { codigo: "CM0916BM" },
    update: {
      unidades_por_unidad_entrega: 12,
      unidad_entra_por_bulto: 1,

      alto_por_bulto: 870,
      ancho_por_bulto: 765,
      largo_por_bulto: 840,

      peso_por_bulto: "6.8645",
      peso_por_unidad_venta: "6.8645",
      peso_por_unidad_entrega: "6.8645",

      volumen_por_bulto: cmVolM3.toFixed(6),
      volumen_por_unidad_entrega: cmVolM3.toFixed(6),

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
      unidad_entra_por_bulto: 1,

      alto_por_bulto: 870,
      ancho_por_bulto: 765,
      largo_por_bulto: 840,

      peso_por_bulto: "6.8645",
      peso_por_unidad_venta: "6.8645",
      peso_por_unidad_entrega: "6.8645",

      volumen_por_bulto: cmVolM3.toFixed(6),
      volumen_por_unidad_entrega: cmVolM3.toFixed(6),

      max_carga_superior_por_unidad_kg: "12.000",
    },
  });

  /* =========================
     2) GALLETAS-TEST-CAJA12
  ========================= */

  await prisma.tipoProducto.upsert({
    where: { codigo: "GALLETAS-TEST-CAJA12" },
    update: {
      unidad_entra_por_bulto: 12,
      unidades_por_unidad_entrega: 12,

      largo_por_bulto: 400,
      ancho_por_bulto: 300,
      alto_por_bulto: 300,

      peso_por_bulto: "3.6",
      peso_por_unidad_venta: divStr(3.6, 12),
      peso_por_unidad_entrega: divStr(3.6, 12),

      volumen_por_bulto: gVolM3.toFixed(6),
      volumen_por_unidad_entrega: (gVolM3 / 12).toFixed(6),

      max_carga_superior_por_unidad_kg: "15.000",
      factor_seguridad_compresion: "0.850",

      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "GALLETAS-TEST-CAJA12",
      descripcion: "Caja de galletas test x12",

      unidad_entra_por_bulto: 12,
      unidades_por_unidad_entrega: 12,

      largo_por_bulto: 400,
      ancho_por_bulto: 300,
      alto_por_bulto: 300,

      peso_por_bulto: "3.6",
      peso_por_unidad_venta: divStr(3.6, 12),
      peso_por_unidad_entrega: divStr(3.6, 12),

      volumen_por_bulto: gVolM3.toFixed(6),
      volumen_por_unidad_entrega: (gVolM3 / 12).toFixed(6),

      max_carga_superior_por_unidad_kg: "15.000",
    },
  });

  /* =========================
     3) CAFE-TEST-CAJA6
  ========================= */

  await prisma.tipoProducto.upsert({
    where: { codigo: "CAFE-TEST-CAJA6" },
    update: {
      unidad_entra_por_bulto: 6,
      unidades_por_unidad_entrega: 6,

      largo_por_bulto: 300,
      ancho_por_bulto: 250,
      alto_por_bulto: 260,

      peso_por_bulto: "4.2",
      peso_por_unidad_venta: divStr(4.2, 6),
      peso_por_unidad_entrega: divStr(4.2, 6),

      volumen_por_bulto: cVolM3.toFixed(6),
      volumen_por_unidad_entrega: (cVolM3 / 6).toFixed(6),

      max_carga_superior_por_unidad_kg: "6.000",
      factor_seguridad_compresion: "0.850",

      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "CAFE-TEST-CAJA6",
      descripcion: "Caja de café test x6 frascos",

      unidad_entra_por_bulto: 6,
      unidades_por_unidad_entrega: 6,

      largo_por_bulto: 300,
      ancho_por_bulto: 250,
      alto_por_bulto: 260,

      peso_por_bulto: "4.2",
      peso_por_unidad_venta: divStr(4.2, 6),
      peso_por_unidad_entrega: divStr(4.2, 6),

      volumen_por_bulto: cVolM3.toFixed(6),
      volumen_por_unidad_entrega: (cVolM3 / 6).toFixed(6),

      max_carga_superior_por_unidad_kg: "6.000",
    },
  });

  /* =========================
     4) ARROZ-TEST-BOLSA10
  ========================= */

  await prisma.tipoProducto.upsert({
    where: { codigo: "ARROZ-TEST-BOLSA10" },
    update: {
      unidad_entra_por_bulto: 1,
      unidades_por_unidad_entrega: 1,

      largo_por_bulto: 600,
      ancho_por_bulto: 400,
      alto_por_bulto: 180,

      peso_por_bulto: "10.000",
      peso_por_unidad_venta: "10.000",
      peso_por_unidad_entrega: "10.000",

      volumen_por_bulto: aVolM3.toFixed(6),
      volumen_por_unidad_entrega: aVolM3.toFixed(6),

      max_carga_superior_por_unidad_kg: "40.000",
      factor_seguridad_compresion: "0.850",

      updated_at: new Date(),
      updated_by: "seed",
    },
    create: {
      ...baseCreate,
      codigo: "ARROZ-TEST-BOLSA10",
      descripcion: "Bolsa de arroz test 10kg",

      unidad_entra_por_bulto: 1,
      unidades_por_unidad_entrega: 1,

      largo_por_bulto: 600,
      ancho_por_bulto: 400,
      alto_por_bulto: 180,

      peso_por_bulto: "10.000",
      peso_por_unidad_venta: "10.000",
      peso_por_unidad_entrega: "10.000",

      volumen_por_bulto: aVolM3.toFixed(6),
      volumen_por_unidad_entrega: aVolM3.toFixed(6),

      max_carga_superior_por_unidad_kg: "40.000",
    },
  });

  console.log("✅ Productos demo listos (con pesos y volúmenes completos).");
}
