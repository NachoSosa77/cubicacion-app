// app/cubicacion/simulacion/actions/applyBultoSnapshot.ts
"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { BultoSimSnapshot } from "../simulacion/types/types";

function toPosInt(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.trunc(n));
}

function toDimMmJson(v: any): Prisma.InputJsonValue | undefined {
  if (!v) return undefined;

  const largo = toPosInt(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = toPosInt(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = toPosInt(v.alto ?? v.alto_mm ?? v.h, 0);

  if (largo <= 0 || ancho <= 0 || alto <= 0) return undefined;
  return { largo, ancho, alto } as Prisma.InputJsonValue;
}

// Si tenés enum BultoFuente en lote_item, mantenemos el mapping.
// Ajustalo a tu enum real si difiere.
function mapFuente(candidateKey: "A" | "B" | "C") {
  // ejemplo: enum BultoFuente { CATALOGO, OPERATIVO, EMPRESA_BULTO }
  if (candidateKey === "A") return "OPERATIVO" as const;
  if (candidateKey === "C") return "EMPRESA_BULTO" as const;
  return "CATALOGO" as const; // B
}

export async function applyBultoSnapshot(params: {
  simulacionId: number;
  snap: BultoSimSnapshot;
  mode: "SIMULACION" | "PUBLISH_TO_LOTE";
}) {
  const simulacionId = Number(params.simulacionId);
  if (!Number.isFinite(simulacionId) || simulacionId <= 0) {
    throw new Error("simulacionId inválido.");
  }

  const snap = params.snap;
  if (!snap?.items?.length) throw new Error("Snapshot vacío.");

  // 1) Traemos simulación y el lote asociado (si existe)
  const sim = await prisma.cubicacionSimulacion.findUnique({
    where: { id: simulacionId },
    select: {
      id: true,
      lote_id: true,
    },
  });
  if (!sim) throw new Error("Simulación inexistente.");

  const loteId = sim.lote_id ?? null;

  // 2) Operaciones sobre SIMULACION (siempre)
  const txOps: Prisma.PrismaPromise<any>[] = [];

  // Guardado por SKU en producto_plan
  for (const it of snap.items) {
    txOps.push(
      prisma.cubicacionProductoPlan.updateMany({
        where: {
          simulacion_id: simulacionId,
          tipo_producto_id: it.tipo_producto_id,
        },
        data: {
          unidades_por_bulto: it.unidades_por_bulto ?? null,
          cantidad_bultos: it.cantidad_bultos ?? 0,
          dim_bulto_mm: toDimMmJson(it.dim_bulto_mm) ?? undefined, // no mandar null
        },
      })
    );
  }

  // Totales a simulación (opcional pero recomendable)
  txOps.push(
    prisma.cubicacionSimulacion.update({
      where: { id: simulacionId },
      data: {
        unidades_totales: toPosInt(snap.totales?.unidades, 0),
        bultos_totales: toPosInt(snap.totales?.bultos, 0),
        // meta: podés guardar auditoría liviana si querés
        meta: {
          ...(snap.candidateKey
            ? { last_bulto_candidate: snap.candidateKey }
            : {}),
          ...(snap.titulo ? { last_bulto_titulo: snap.titulo } : {}),
          last_bulto_applied_at: new Date().toISOString(),
        } as any,
      },
    })
  );

  // 3) Si pidieron publicar al lote, lo hacemos en la MISMA transacción
  if (params.mode === "PUBLISH_TO_LOTE") {
    if (!loteId)
      throw new Error("La simulación no tiene lote asociado (lote_id = null).");

    const lote = await prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      select: {
        id: true,
        items: { select: { id: true, tipo_producto_id: true } },
      },
    });
    if (!lote) throw new Error("Lote asociado inexistente.");

    const itemByTipoProductoId = new Map<number, { id: number }>();
    for (const it of lote.items)
      itemByTipoProductoId.set(it.tipo_producto_id, { id: it.id });

    const bultoFuente = mapFuente(snap.candidateKey);

    for (const s of snap.items) {
      const ref = itemByTipoProductoId.get(Number(s.tipo_producto_id));
      if (!ref) continue; // si el SKU no está en el lote, lo ignoramos

      const unidadesPorBulto =
        s.unidades_por_bulto != null ? toPosInt(s.unidades_por_bulto, 0) : null;

      const cantidadBultos = toPosInt(s.cantidad_bultos, 0);
      const dimBultoMm = toDimMmJson(s.dim_bulto_mm);

      txOps.push(
        prisma.cubicacionLoteItem.update({
          where: { id: ref.id },
          data: {
            unidades_por_bulto:
              unidadesPorBulto && unidadesPorBulto > 0
                ? unidadesPorBulto
                : null,
            cantidad_bultos: cantidadBultos > 0 ? cantidadBultos : 0,
            dim_bulto_mm: dimBultoMm ?? undefined, // requiere que exista en schema (ya lo migraste)
            bulto_fuente: bultoFuente, // requiere que exista en schema
          },
        })
      );
    }

    // Totales en lote si querés dejarlos consistentes (recomendado si los mostrás)
    txOps.push(
      prisma.cubicacionLote.update({
        where: { id: loteId },
        data: {
          unidades_totales: toPosInt(snap.totales?.unidades, 0),
          bultos_totales: toPosInt(snap.totales?.bultos, 0),
        },
      })
    );
  }

  // 4) Ejecutar
  // - En SIMULACION: podés ejecutar sin transaction, pero lo dejamos en transaction igual.
  // - En PUBLISH_TO_LOTE: ES clave que sea transacción.
  await prisma.$transaction(txOps);

  return {
    ok: true,
    simulacionId,
    loteId: loteId ?? null,
    mode: params.mode,
  };
}
