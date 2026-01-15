// app/cubicacion/simulacion/actions/previewBultoLayout3D.ts
"use server";

import { prisma } from "@/lib/prisma";
import { calcularLayoutBulto3D } from "../lib/packing-bulto-3d";
import type { BultoSimSnapshot, DimMm } from "../types/types";

function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function tryDimMm(v: any): DimMm | null {
  if (!v) return null;
  const largo = safeInt(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = safeInt(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = safeInt(v.alto ?? v.alto_mm ?? v.h, 0);
  if (largo > 0 && ancho > 0 && alto > 0) return { largo, ancho, alto };
  return null;
}

export async function previewBultoLayout3D(params: {
  loteId: number;
  snap: BultoSimSnapshot;
  // override opcional si el usuario eligió bulto empresa en C aunque el lote sea PRODUCTO_ESTANDAR
  bultoOverrideMm?: DimMm | null;
}) {
  const lote = await prisma.cubicacionLote.findUnique({
    where: { id: params.loteId },
    include: {
      items: { include: { tipo_producto: true }, orderBy: { id: "asc" } },
    },
  });

  if (!lote) throw new Error("Lote inexistente.");

  // 1) Determinar bulto interno: usamos override si viene; si no, el dim_bulto_mm del snapshot (debería venir)
  //    Nota: acá asumimos dim_bulto_mm es “interno” para demo. Luego afinamos con espesor/tara.
  const snapFirstWithDim = params.snap.items.find(
    (x) => x.dim_bulto_mm && x.dim_bulto_mm.largo > 0
  );
  const bultoInternoMm =
    params.bultoOverrideMm ?? snapFirstWithDim?.dim_bulto_mm ?? null;

  if (!bultoInternoMm) {
    return {
      layout: {
        bulto: { dimInternaMm: { largo: 0, ancho: 0, alto: 0 } },
        contenido: [],
        placements: [],
        warnings: [
          "No hay dim_bulto_mm en el snapshot (no se puede armar visor 3D).",
        ],
      },
    };
  }

  // 2) Items para layout (unidades planificadas por SKU + dim_unidad_mm del lote)
  const loteItemsByTipo = new Map(
    lote.items.map((it) => [it.tipo_producto_id, it])
  );

  const warnings: string[] = [];
  const itemsForPacking = params.snap.items
    .map((s) => {
      const it = loteItemsByTipo.get(s.tipo_producto_id);
      if (!it) {
        warnings.push(`${s.codigo}: no existe en lote.items.`);
        return null;
      }

      const dimUnidad = tryDimMm(it.dim_unidad_mm);
      if (!dimUnidad) {
        warnings.push(
          `${s.codigo}: falta dim_unidad_mm (no se puede dibujar 3D).`
        );
        return null;
      }

      return {
        tipo_producto_id: s.tipo_producto_id,
        codigo: s.codigo,
        unidades: Math.max(0, safeInt(s.unidades_planificadas, 0)),
        dimUnidadMm: dimUnidad,
      };
    })
    .filter(Boolean) as Array<{
    tipo_producto_id: number;
    codigo: string;
    unidades: number;
    dimUnidadMm: DimMm;
  }>;

  const res = calcularLayoutBulto3D({
    bultoInternoMm,
    items: itemsForPacking,
    maxUnidades: 800,
  });

  const placements = res.placements;
  const contenido = itemsForPacking.map((it) => ({
    productoId: it.tipo_producto_id,
    codigo: it.codigo,
    unidades: it.unidades,
    dimUnidadMm: it.dimUnidadMm,
    // positionMm individual va en placements (para el viewer está OK que exista por unidad)
  }));

  return {
    layout: {
      bulto: { dimInternaMm: bultoInternoMm },
      contenido,
      placements,
      warnings: [...warnings, ...res.warnings],
    },
  };
}
