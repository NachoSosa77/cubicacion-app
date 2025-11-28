// prisma/seeds/seedTipoContenedor.ts
import { PrismaClient } from "@prisma/client";

export async function seedTipoContenedor(prisma: PrismaClient) {
  console.log("🏭 Creando tipos de contenedor...");

  const tiposContenedor = [
    {
      codigo: "CISTERNA",
      descripcion: "CISTERNA",
      largo_mts: null,
      ancho_mts: null,
      alto_mts: null,
      peso_pallet_kg: null,
      peso_max_kg: null,
      peso_max_lts: 35000,
    },
    {
      codigo: "PALLET-AMERICANO",
      descripcion: "Pallet Americano",
      largo_mts: 1,
      ancho_mts: 1.2,
      alto_mts: 2.8,
      peso_pallet_kg: 25,
      peso_max_kg: 2085,
      peso_max_lts: null,
    },
    {
      codigo: "PALLET-ARLOG",
      descripcion: "Pallet Arlog",
      largo_mts: 1,
      ancho_mts: 1.1,
      alto_mts: 2.8,
      peso_pallet_kg: 25,
      peso_max_kg: 1200,
      peso_max_lts: null,
    },
    {
      codigo: "PALET-EUROPALETA",
      descripcion: "Pallet Europaleta",
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
        update: {},
        create: {
          codigo: tipo.codigo,
          descripcion: tipo.descripcion,
          habilitado: true,
          created_at: new Date(),
          created_by: "system",
          largo_mts: tipo.largo_mts ?? 0,
          ancho_mts: tipo.ancho_mts ?? 0,
          alto_mts: tipo.alto_mts ?? 0,
          peso_pallet_kg: tipo.peso_pallet_kg ?? 0,
          peso_max_kg: tipo.peso_max_kg ?? 0,
          peso_max_lts: tipo.peso_max_lts ?? 0,
        },
      })
    )
  );

  console.log("✅ Tipos de contenedor creados o actualizados");
}
