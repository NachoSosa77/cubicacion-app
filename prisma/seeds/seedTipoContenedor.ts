// prisma/seeds/seedTipoContenedor.ts
import { PrismaClient } from "@prisma/client";

export async function seedTipoContenedor(prisma: PrismaClient) {
  console.log("🏭 Creando tipos de contenedor...");

  const tiposContenedor = [
    {
      codigo: "CISTERNA",
      descripcion: "Cisterna (líquidos)",
      largo_mts: null,
      ancho_mts: null,
      alto_mts: null,
      peso_pallet_kg: null,
      peso_max_kg: null,
      peso_max_lts: 35000,
    },
    {
      codigo: "PALLET-AMERICANO",
      descripcion: "Pallet Americano (1.00 × 1.20 m)",
      largo_mts: 1.0,
      ancho_mts: 1.2,
      alto_mts: 2.8, // altura máx de apilado (configurable por regla)
      peso_pallet_kg: 25,
      peso_max_kg: 2085,
      peso_max_lts: null,
    },
    {
      codigo: "PALLET-ARLOG",
      descripcion: "Pallet Arlog (1.00 × 1.10 m)",
      largo_mts: 1.0,
      ancho_mts: 1.1,
      alto_mts: 2.8,
      peso_pallet_kg: 25,
      peso_max_kg: 1200,
      peso_max_lts: null,
    },
    {
      codigo: "PALLET-EUROPALETA",
      descripcion: "Pallet Europaleta (0.80 × 1.20 m)",
      largo_mts: 0.8,
      ancho_mts: 1.2,
      alto_mts: 2.8,
      peso_pallet_kg: 25,
      peso_max_kg: 1500,
      peso_max_lts: null,
    },
  ];

  await prisma.$transaction(
    tiposContenedor.map((tipo) =>
      prisma.tipoContenedor.upsert({
        where: { codigo: tipo.codigo },
        update: {
          descripcion: tipo.descripcion,
          habilitado: true,
          updated_at: new Date(),
          updated_by: "system",
          // si dejás schema NO-null, cambiá estos nulls por 0
          largo_mts: tipo.largo_mts as any,
          ancho_mts: tipo.ancho_mts as any,
          alto_mts: tipo.alto_mts as any,
          peso_pallet_kg: tipo.peso_pallet_kg as any,
          peso_max_kg: tipo.peso_max_kg as any,
          peso_max_lts: tipo.peso_max_lts as any,
          deleted_at: null,
        },
        create: {
          codigo: tipo.codigo,
          descripcion: tipo.descripcion,
          habilitado: true,
          created_at: new Date(),
          created_by: "system",
          largo_mts: tipo.largo_mts as any,
          ancho_mts: tipo.ancho_mts as any,
          alto_mts: tipo.alto_mts as any,
          peso_pallet_kg: tipo.peso_pallet_kg as any,
          peso_max_kg: tipo.peso_max_kg as any,
          peso_max_lts: tipo.peso_max_lts as any,
        },
      })
    )
  );

  console.log("✅ Tipos de contenedor creados o actualizados");
}
