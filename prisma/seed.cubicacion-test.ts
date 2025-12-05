// prisma/seed.cubicacion-test.ts
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Seed de pruebas de cubicación ===");

  // 1) Division de servicio de prueba
  const division = await prisma.divisionServicio.upsert({
    where: { codigo: "DIST-CUBIC" },
    update: {},
    create: {
      codigo: "DIST-CUBIC",
      descripcion: "Distribución - pruebas de cubicación",
      created_at: new Date(),
      habilitado: true,
    },
  });

  console.log("DivisionServicio:", division.codigo);

  // 2) Tipos de unidad de medida (venta y entrega)
  const umVenta = await prisma.tipoUnidadMedidaVenta.upsert({
    where: { codigo: "UNID" },
    update: {},
    create: {
      codigo: "UNID",
      descripcion: "Unidad",
      created_at: new Date(),
      habilitado: true,
      division_servicio_id: division.id,
    },
  });

  const umEntrega = await prisma.tipoUnidadMedidaEntrega.upsert({
    where: { codigo: "CAJA" },
    update: {},
    create: {
      codigo: "CAJA",
      descripcion: "Caja / Bulto",
      created_at: new Date(),
      habilitado: true,
      division_servicio_id: division.id,
    },
  });

  console.log("UM Venta/Entrega:", umVenta.codigo, umEntrega.codigo);

  // 3) Producto de prueba (bulto 400 x 300 x 300 mm)
  const producto = await prisma.tipoProducto.upsert({
    where: { codigo: "GALLETAS-TEST-CAJA12" },
    update: {},
    create: {
      division_servicio_id: division.id,
      dadora_id: 1, // valor dummy, en este esquema "lite" no hay relación
      un_venta_id: umVenta.id,
      un_entrega_id: umEntrega.id,
      created_at: new Date(),
      habilitado: true,
      created_by: "seed:cubicacion-test",

      codigo: "GALLETAS-TEST-CAJA12",
      descripcion: "Caja test x12 unidades (cubicación controlada)",

      // Campos "de negocio" (pueden ajustarse si querés)
      unidades_por_unidad_entrega: 12, // 12 unidades por caja
      peso_por_unidad_venta: 250, // 250g por unidad (valor arbitrario)
      peso_por_uniad_entrega: 3000, // 3kg por caja
      volumen_por_unidad_entrega: 1680000, // 120*100*140 mm³ aprox
      unidad_entra_por_bulto: 12,

      // Dimensiones del bulto (caja) EXTERNAS en mm
      largo_por_bulto: 400,
      ancho_por_bulto: 300,
      alto_por_bulto: 300,

      peso_por_bulto: 3000, // 3kg
      volumen_por_bulto: 36000000, // 400*300*300 mm³
    },
  });

  console.log("TipoProducto:", producto.codigo);

  // 4) Configuración del producto DENTRO del bulto
  //    Unidad: 120 x 100 x 140 mm, grosor caja 2mm
  //    Unidades por eje: 3 x 2 x 2 = 12
  //    Ocupación interna ~ 58.1%
  const ocupacionInterna = new Prisma.Decimal("58.1");

  const cubicacionBulto = await prisma.cubicacionProductoBulto.upsert({
    where: { tipo_producto_id: producto.id },
    update: {
      largo_unidad_mm: 120,
      ancho_unidad_mm: 100,
      alto_unidad_mm: 140,
      grosor_pared_mm: 2,
      unidades_eje_x: 3,
      unidades_eje_y: 2,
      unidades_eje_z: 2,
      ocupacion_interna: ocupacionInterna,
      orient_largo_mm: 120,
      orient_ancho_mm: 100,
      orient_alto_mm: 140,
    },
    create: {
      tipo_producto_id: producto.id,
      largo_unidad_mm: 120,
      ancho_unidad_mm: 100,
      alto_unidad_mm: 140,
      grosor_pared_mm: 2,
      unidades_eje_x: 3,
      unidades_eje_y: 2,
      unidades_eje_z: 2,
      ocupacion_interna: ocupacionInterna,
      orient_largo_mm: 120,
      orient_ancho_mm: 100,
      orient_alto_mm: 140,
    },
  });

  console.log("CubicacionProductoBulto creado para producto:", producto.codigo);

  // 5) Contenedor / Pallet de prueba
  const pallet = await prisma.tipoContenedor.upsert({
    where: { codigo: "PAL-EU-1200x800-1.80" },
    update: {},
    create: {
      created_at: new Date(),
      habilitado: true,
      created_by: "seed:cubicacion-test",

      codigo: "PAL-EU-1200x800-1.80",
      descripcion: "Pallet europeo 1200x800 x 1.80m (test cubicación)",

      largo_mts: 1.2,
      ancho_mts: 0.8,
      alto_mts: 1.8,

      peso_pallet_kg: 25,
      peso_max_kg: 1000,
      peso_max_lts: 0,
    },
  });

  console.log("TipoContenedor:", pallet.codigo);

  // 6) Clase de transporte y clasificación (Tráiler 48 pies - test)
  const claseTrailer = await prisma.transporteClase.upsert({
    where: { codigo: "TRAILER-TEST" },
    update: {},
    create: {
      codigo: "TRAILER-TEST",
      descripcion: "Clases de trailers para pruebas de cubicación",
    },
  });

  console.log("TransporteClase:", claseTrailer.codigo);

  // Como TransporteClasificacion NO tiene campo único,
  // hacemos un findFirst para no duplicar en cada corrida
  const existingTrailer48 = await prisma.transporteClasificacion.findFirst({
    where: {
      denominacion_de_vehiculo: "Tráiler 48 pies (test)",
    },
  });

  let trailer48;
  if (existingTrailer48) {
    trailer48 = existingTrailer48;
    console.log(
      "TransporteClasificacion ya existente (Tráiler 48 pies - test)"
    );
  } else {
    trailer48 = await prisma.transporteClasificacion.create({
      data: {
        clase_transporte_id: claseTrailer.id,
        division_servicio_id: division.id,
        denominacion_de_vehiculo: "Tráiler 48 pies (test)",

        // Dimensiones aproximadas (en metros, redondeadas a enteros)
        mt_largo_cub: 15, // aprox 14.63m
        mt_ancho_cub: 3,
        mt_alto_cub: 3,
        mt_total_cub: 135, // 15*3*3 aprox

        max_peso_kg: 22000,
        max_peso_lt: 0,
        max_peso_xmt3: 163, // 22000 / 135 aprox

        pallet_europaleta_total: 33, // valor razonable para pruebas
        pallet_ariog_total: "0",
        pallet_americano_total: "0",
      },
    });

    console.log(
      "TransporteClasificacion creado:",
      trailer48.denominacion_de_vehiculo
    );
  }

  console.log("=== Seed de pruebas de cubicación COMPLETADO ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
