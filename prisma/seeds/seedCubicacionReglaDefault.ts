// prisma/seeds/seedCubicacionReglaDefault.ts
import { PrismaClient } from "@prisma/client";

export async function seedCubicacionReglaDefault(prisma: PrismaClient) {
  const empresa = await prisma.empresa.findFirst({
    where: { habilitado: true },
    orderBy: { id: "asc" },
  });
  if (!empresa) throw new Error("No hay empresa habilitada.");

  // Regla global empresa (sin producto/contenedor específico)
  await prisma.cubicacionRegla.create({
    data: {
      empresaId: empresa.id,
      maxCodigosPorPallet: 3,
      maxAlturaM: 1.8,
      permitirMezcla: true,
      orientacionForzada: null,
      observaciones: "Regla default dev",
    },
  });

  console.log("✅ Seed regla default OK");
}
