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
        `${it.codigo}: unidad no entra en bulto (${d.largo}×${d.ancho}×${d.alto}).`,
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
        `Se truncó el layout a ${maxUnidades} unidades por performance.`,
      );
      break;
    }
    const ok = placeOne(it);
    if (!ok) continue; // si no entra, cortamos (layout “máximo” alcanzado)
    placed += 1;
  }

  if (placements.length === 0) {
    warnings.push(
      "No se pudo ubicar ninguna unidad (faltan dims de unidad o no entran).",
    );
  }

  function overlap1D(aMin: number, aMax: number, bMin: number, bMax: number) {
    return aMin < bMax && bMin < aMax;
  }

  function overlapXZ(a: BultoLayout3DPlacement, b: BultoLayout3DPlacement) {
    const ad = a.dim_unidad_mm;
    const bd = b.dim_unidad_mm;

    const aMinX = a.positionMm.x - ad.largo / 2;
    const aMaxX = a.positionMm.x + ad.largo / 2;
    const aMinZ = a.positionMm.z - ad.ancho / 2;
    const aMaxZ = a.positionMm.z + ad.ancho / 2;

    const bMinX = b.positionMm.x - bd.largo / 2;
    const bMaxX = b.positionMm.x + bd.largo / 2;
    const bMinZ = b.positionMm.z - bd.ancho / 2;
    const bMaxZ = b.positionMm.z + bd.ancho / 2;

    return (
      overlap1D(aMinX, aMaxX, bMinX, bMaxX) &&
      overlap1D(aMinZ, aMaxZ, bMinZ, bMaxZ)
    );
  }

  /**
   * Baja cada caja hasta apoyar en piso o en la caja más alta debajo
   * que solape en XZ. No cambia X/Z.
   */
  function applyGravity(
    placements: BultoLayout3DPlacement[],
    bultoInternoMm: DimMm,
  ) {
    const floorY = -bultoInternoMm.alto / 2;

    // de abajo hacia arriba
    const orderedIdx = placements
      .map((p, i) => ({ i, y: p.positionMm.y }))
      .sort((a, b) => a.y - b.y);

    for (const { i } of orderedIdx) {
      const p = placements[i];
      const d = p.dim_unidad_mm;

      const halfY = d.alto / 2;

      // piso
      let supportTopY = floorY;

      // buscar soporte debajo (entre las ya “resueltas” o cualquiera con y menor)
      for (let j = 0; j < placements.length; j++) {
        if (j === i) continue;
        const q = placements[j];

        // solo candidatos debajo
        if (q.positionMm.y >= p.positionMm.y) continue;

        if (!overlapXZ(p, q)) continue;

        const qTopY = q.positionMm.y + q.dim_unidad_mm.alto / 2;
        if (qTopY > supportTopY) supportTopY = qTopY;
      }

      // nuevo centro Y apoyado
      const newCenterY = supportTopY + halfY;

      // clamp por si algo raro se fue arriba del techo
      const ceilingY = bultoInternoMm.alto / 2;
      if (newCenterY + halfY <= ceilingY + 1e-6) {
        p.positionMm.y = newCenterY;
      }
    }
  }

  applyGravity(placements, b);

  if (placements.length === 0) {
    warnings.push(
      "No se pudo ubicar ninguna unidad (faltan dims de unidad o no entran).",
    );
  }

  return { placements, warnings };
}
