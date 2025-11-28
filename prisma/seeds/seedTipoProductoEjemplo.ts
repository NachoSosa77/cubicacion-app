// prisma/seeds/seedTipoProductoEjemplo.ts
import { PrismaClient } from "@prisma/client";

export async function seedTipoProductoEjemplo(prisma: PrismaClient) {
  console.log("🧱 Creando/actualizando producto de ejemplo CM0916BM...");

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
      "Faltan división o unidades de medida para crear el producto de ejemplo"
    );
  }

  await prisma.tipoProducto.upsert({
    where: { codigo: "CM0916BM" }, // ⚠️ usamos upsert para no duplicar
    update: {
      // Actualizamos medidas según "Case (DE)"
      unidades_por_unidad_entrega: 12, // <-- poné acá la cantidad real de uds por caja
      alto_por_bulto: 870, // mm
      ancho_por_bulto: 765, // mm
      largo_por_bulto: 840, // mm
      peso_por_bulto: 6.8645, // kg (peso bruto por bulto)
      volumen_por_bulto: 0, // lo podemos calcular en la app luego
    },
    create: {
      division_servicio_id: divisionSolido.id,
      dadora_id: 1, // por ahora fijo, más adelante lo ligamos a una dadora real
      un_venta_id: unidadCajaVenta.id,
      un_entrega_id: unidadCajaEntrega.id,
      created_at: new Date(),
      codigo: "CM0916BM",
      descripcion: "CAFETERA 12 VASO CON SWITCH",
      unidades_por_unidad_entrega: 12, // ajustar al valor real
      peso_por_unidad_venta: 0,
      peso_por_uniad_entrega: 0,
      volumen_por_unidad_entrega: 0,
      unidad_entra_por_bulto: 1,
      alto_por_bulto: 870,
      ancho_por_bulto: 765,
      largo_por_bulto: 840,
      peso_por_bulto: 6.8645,
      volumen_por_bulto: 0,
      habilitado: true,
    },
  });

  console.log("✅ Producto CM0916BM listo con medidas del PDF.");
}
