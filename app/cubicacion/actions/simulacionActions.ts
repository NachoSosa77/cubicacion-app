// app/cubicacion/actions/simulacionActions.ts
"use server";

import { prisma } from "@/lib/prisma";

export interface CrearSimulacionInput {
  empresaId: number;
  // opcional: si más adelante querés soportar "usar lote existente"
  loteId?: number | null;
  meta?: Record<string, any>;
  titulo?: string;
  descripcion?: string;
}

export async function crearSimulacion(input: CrearSimulacionInput) {
  const empresaId = Number(input.empresaId);
  if (!Number.isFinite(empresaId) || empresaId <= 0) {
    throw new Error("empresaId inválido");
  }

  const titulo = input.titulo ?? "Simulación nueva";
  const descripcion = input.descripcion ?? null;
  const meta = input.meta ?? {};

  // Si te pasan un loteId válido, lo respetamos; si no, creamos uno.
  const loteIdIn = input.loteId;
  const loteIdValido =
    typeof loteIdIn === "number" && Number.isFinite(loteIdIn) && loteIdIn > 0
      ? loteIdIn
      : null;

  return prisma.$transaction(async (tx) => {
    // 1) Si no hay lote válido, crear lote BORRADOR
    const lote =
      loteIdValido != null
        ? await tx.cubicacionLote.findUnique({ where: { id: loteIdValido } })
        : await tx.cubicacionLote.create({
            data: {
              empresa_id: empresaId,
              descripcion: descripcion ?? `Lote generado por simulación`,
              status: "BORRADOR",
              packing_policy: "OPERATIVO_AGRUPADO",
              tipo_bulto: "EMPRESA_BULTO",
              unidades_totales: 0,
              bultos_totales: 0,
              meta: {
                origen: "SIMULACION",
              },
            } as any,
          });

    if (!lote) throw new Error("No se pudo resolver/crear el lote.");

    // 2) Crear simulación ya linkeada al lote
    const simulacion = await tx.cubicacionSimulacion.create({
      data: {
        empresa_id: empresaId,
        lote_id: lote.id,
        titulo,
        descripcion,
        status: "BORRADOR",
        meta: {
          ...meta,
          lote_id: lote.id,
        },
      },
    });

    // 3) Guardar simulacion_id en meta del lote (útil para trazabilidad)
    await tx.cubicacionLote.update({
      where: { id: lote.id },
      data: {
        meta: {
          ...(typeof (lote as any).meta === "object" && (lote as any).meta
            ? (lote as any).meta
            : {}),
          simulacion_id: simulacion.id,
        },
      } as any,
    });

    return simulacion;
  });
}
