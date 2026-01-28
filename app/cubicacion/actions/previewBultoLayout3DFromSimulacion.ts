"use server";

import { prisma } from "@/lib/prisma";
import { previewBultoLayout3D } from "../simulacion/actions/previewBultoLayout3D";

// Reutilizamos el motor actual, pero le pasamos un "lote virtual" persistido o un lote dummy.
// En este micro-paso, lo resolvemos simple: si la simulación tiene lote_id, usamos ese.
// Si no, devolvemos error claro (y luego implementamos motor sin lote).

export async function previewBultoLayout3DFromSimulacion(args: {
  simulacionId: number;
  snap: any;
}) {
  const sim = await prisma.cubicacionSimulacion.findUnique({
    where: { id: args.simulacionId },
    select: { id: true, lote_id: true },
  });

  if (!sim) throw new Error("Simulación no encontrada");

  if (!sim.lote_id) {
    throw new Error(
      "Esta simulación no tiene lote asociado. Falta implementar preview 3D sin lote (próximo paso).",
    );
  }

  return previewBultoLayout3D({
    loteId: sim.lote_id,
    snap: args.snap,
  });
}
