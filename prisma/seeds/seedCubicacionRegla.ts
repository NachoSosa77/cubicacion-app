// prisma/seeds/seedCubicacionRegla.ts
import { PrismaClient } from "@prisma/client";

export async function seedCubicacionRegla(prisma: PrismaClient) {
  console.log("📏 Creando reglas de cubicación (pro)...");

  // Empresa demo
  const empresa = await prisma.empresa.findFirst({
    where: { habilitado: true, deleted_at: null },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!empresa) throw new Error("No hay empresa habilitada.");

  const pallets = await prisma.tipoContenedor.findMany({
    where: {
      habilitado: true,
      deleted_at: null,
      codigo: { in: ["PALLET-AMERICANO", "PALLET-ARLOG", "PALLET-EUROPALETA"] },
    },
    select: { id: true, codigo: true },
  });

  const byPallet = new Map(pallets.map((p) => [p.codigo, p.id]));

  const must = (codigo: string) => {
    const id = byPallet.get(codigo);
    if (!id) throw new Error(`No existe contenedor ${codigo}`);
    return id;
  };

  // Regla base por pallet (empresa + pallet)
  // - maxAltura: 2.0m operativo (mejor para estabilidad/daño)
  // - permitirMezcla: true por defecto (se puede customizar por producto)
  // - maxCodigos: 3 por pallet (orden y picking)
  const base = [
    {
      tipoContenedorId: must("PALLET-EUROPALETA"),
      maxAlturaM: "2.00",
      permitirMezcla: true,
      maxCodigosPorPallet: 3,
      orientacionForzada: null,
      observaciones: "Base Europaleta: estabilidad + picking.",
    },
    {
      tipoContenedorId: must("PALLET-ARLOG"),
      maxAlturaM: "2.00",
      permitirMezcla: true,
      maxCodigosPorPallet: 3,
      orientacionForzada: null,
      observaciones: "Base Arlog: estabilidad + picking.",
    },
    {
      tipoContenedorId: must("PALLET-AMERICANO"),
      maxAlturaM: "2.20",
      permitirMezcla: true,
      maxCodigosPorPallet: 4,
      orientacionForzada: null,
      observaciones: "Americano admite algo más de altura.",
    },
  ] as const;

  for (const r of base) {
    await prisma.cubicacionRegla.create({
      data: {
        empresaId: empresa.id,
        tipoContenedorId: r.tipoContenedorId,

        maxAlturaM: r.maxAlturaM,
        permitirMezcla: r.permitirMezcla,
        maxCodigosPorPallet: r.maxCodigosPorPallet,
        orientacionForzada: r.orientacionForzada as any,
        observaciones: r.observaciones,
      },
    });
  }

  console.log("✅ Reglas de cubicación creadas.");
}
