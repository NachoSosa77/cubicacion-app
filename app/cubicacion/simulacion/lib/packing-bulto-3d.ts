// app/cubicacion/simulacion/lib/packing-bulto-3d.ts

import type { BultoLayout3DPlacement, DimMm } from "../types/types";

function safePos(n: unknown, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : fallback;
}

function isValidDim(d: DimMm | null | undefined) {
  return !!d && d.largo > 0 && d.ancho > 0 && d.alto > 0;
}

type ItemInput = {
  tipo_producto_id: number;
  codigo: string;
  unidades: number;
  dimUnidadMm: DimMm;
};

export function calcularLayoutBulto3D(args: {
  bultoInternoMm: DimMm;
  items: ItemInput[];
  maxUnidades?: number; // por performance
}): { placements: BultoLayout3DPlacement[]; warnings: string[] } {
  const warnings: string[] = [];

  const b = args.bultoInternoMm;
  if (!isValidDim(b)) {
    return {
      placements: [],
      warnings: ["Bulto interno inválido (dimensiones)."],
    };
  }

  const maxUnidades = Math.max(1, Math.floor(args.maxUnidades ?? 800));

  // Packing simple por capas:
  // - Fill X (largo) luego Z (ancho), luego Y (alto) por capas.
  // - No rota unidades (profesionalmente luego podemos agregar rotaciones).
  let xCursor = -b.largo / 2;
  let zCursor = -b.ancho / 2;
  let yCursor = -b.alto / 2;

  let rowDepth = 0; // en Z
  let layerHeight = 0; // en Y
  let capa = 1;

  const placements: BultoLayout3DPlacement[] = [];

  const placeOne = (it: ItemInput) => {
    const d = it.dimUnidadMm;

    // Si no entra en el bulto, no se coloca
    if (d.largo > b.largo || d.ancho > b.ancho || d.alto > b.alto) {
      warnings.push(
        `${it.codigo}: unidad no entra en bulto (${d.largo}×${d.ancho}×${d.alto}).`
      );
      return false;
    }

    // Si no entra en la fila actual (X), bajar a nueva fila (Z)
    if (xCursor + d.largo > b.largo / 2) {
      xCursor = -b.largo / 2;
      zCursor += rowDepth;
      rowDepth = 0;
    }

    // Si no entra en el plano (Z), subir capa (Y)
    if (zCursor + d.ancho > b.ancho / 2) {
      xCursor = -b.largo / 2;
      zCursor = -b.ancho / 2;
      yCursor += layerHeight;
      layerHeight = 0;
      capa += 1;
    }

    // Si no entra en altura (Y), no se coloca
    if (yCursor + d.alto > b.alto / 2) {
      return false;
    }

    // Centro del cubo (posición)
    const posCentro = {
      x: xCursor + d.largo / 2,
      y: yCursor + d.alto / 2,
      z: zCursor + d.ancho / 2,
    };

    placements.push({
      tipo_producto_id: it.tipo_producto_id,
      codigo: it.codigo,
      dim_unidad_mm: d,
      positionMm: posCentro,
      capa,
    });

    // Avanzar cursor X
    xCursor += d.largo;

    // Actualizar máximos de fila/capa
    rowDepth = Math.max(rowDepth, d.ancho);
    layerHeight = Math.max(layerHeight, d.alto);

    return true;
  };

  // Orden: primero los “más grandes” para estabilidad visual
  const expanded: ItemInput[] = [];
  for (const it of args.items) {
    const u = Math.max(0, Math.floor(safePos(it.unidades, 0)));
    for (let i = 0; i < u; i++) expanded.push(it);
  }

  expanded.sort((a, c) => {
    const va = a.dimUnidadMm.largo * a.dimUnidadMm.ancho * a.dimUnidadMm.alto;
    const vc = c.dimUnidadMm.largo * c.dimUnidadMm.ancho * c.dimUnidadMm.alto;
    return vc - va;
  });

  let placed = 0;
  for (const it of expanded) {
    if (placed >= maxUnidades) {
      warnings.push(
        `Se truncó el layout a ${maxUnidades} unidades por performance.`
      );
      break;
    }
    const ok = placeOne(it);
    if (!ok) break; // si no entra, cortamos (layout “máximo” alcanzado)
    placed += 1;
  }

  if (placements.length === 0) {
    warnings.push(
      "No se pudo ubicar ninguna unidad (faltan dims de unidad o no entran)."
    );
  }

  return { placements, warnings };
}
