// prisma/seeds/seedEmpresaBulto.ts
import { PrismaClient } from "@prisma/client";

export async function seedEmpresaBulto(prisma: PrismaClient) {
  // Tomamos una empresa existente
  const empresa = await prisma.empresa.findFirst({
    where: { habilitado: true },
    orderBy: { id: "asc" },
  });

  if (!empresa) {
    throw new Error("No existe ninguna empresa para asociar bultos.");
  }

  const bultos = [
    {
      codigo: "CAJA-30x20x15",
      descripcion: "Caja chica (repuestos pequeños)",
      largo_mm: 300,
      ancho_mm: 200,
      alto_mm: 150,
      espesor_pared_mm: 3,
      tara_kg: 0.25,
      max_peso_kg: 8,
      es_preferido: false,
      habilitado: true,
    },
    {
      codigo: "CAJA-40x30x25",
      descripcion: "Caja estándar ecommerce",
      largo_mm: 400,
      ancho_mm: 300,
      alto_mm: 250,
      espesor_pared_mm: 4,
      tara_kg: 0.45,
      max_peso_kg: 15,
      es_preferido: true,
      habilitado: true,
    },
    {
      codigo: "CAJA-60x40x40",
      descripcion: "Caja grande (voluminosos livianos)",
      largo_mm: 600,
      ancho_mm: 400,
      alto_mm: 400,
      espesor_pared_mm: 5,
      tara_kg: 0.9,
      max_peso_kg: 20,
      es_preferido: false,
      habilitado: true,
    },
  ];

  for (const b of bultos) {
    await prisma.empresaBulto.upsert({
      where: {
        empresa_id_codigo: {
          empresa_id: empresa.id,
          codigo: b.codigo,
        },
      },
      update: {
        ...b,
      },
      create: {
        empresa_id: empresa.id,
        ...b,
      },
    });
  }

  console.log(
    `Seed EmpresaBulto OK → ${bultos.length} bultos para empresa ${empresa.razon_social}`
  );
}
