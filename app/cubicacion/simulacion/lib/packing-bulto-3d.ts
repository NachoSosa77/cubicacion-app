// app/cubicacion/simulacion/lib/packing-bulto-3d.ts
import type {
  BultoLayout3DPlacement,
  DimMm,
  RotationMode,
} from "../types/types";

function safePos(n: unknown, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : fallback;
}

function isValidDim(d: DimMm | null | undefined) {
  return !!d && d.largo > 0 && d.ancho > 0 && d.alto > 0;
}

function volMm3(d: DimMm) {
  return d.largo * d.ancho * d.alto;
}

type ItemInput = {
  tipo_producto_id: number;
  codigo: string;
  unidades: number;
  dimUnidadMm: DimMm;
};

type CursorState = {
  xCursor: number;
  zCursor: number;
  yCursor: number;
  rowDepth: number;
  layerHeight: number;
  capa: number;
};

type FitResult = {
  dim: DimMm;
  rotationKey?: BultoLayout3DPlacement["rotationKey"];
  next: CursorState;
  posCentro: { x: number; y: number; z: number };
};

/** 6 orientaciones posibles (largo/ancho/alto permutadas) */
function rotations6(d: DimMm): Array<{
  dim: DimMm;
  key: BultoLayout3DPlacement["rotationKey"];
}> {
  const L = d.largo,
    W = d.ancho,
    H = d.alto;
  return [
    { dim: { largo: L, ancho: W, alto: H }, key: "LWH" },
    { dim: { largo: L, ancho: H, alto: W }, key: "LHW" },
    { dim: { largo: W, ancho: L, alto: H }, key: "WLH" },
    { dim: { largo: W, ancho: H, alto: L }, key: "WHL" },
    { dim: { largo: H, ancho: L, alto: W }, key: "HLW" },
    { dim: { largo: H, ancho: W, alto: L }, key: "HWL" },
  ];
}

/**
 * Simula “colocar una unidad” en el cursor actual siguiendo tus reglas:
 * - fill X, luego Z, luego Y
 * - sin backtracking
 * Devuelve: posición + nuevo cursor, o null si no entra.
 */
function tryFitAtCursor(args: {
  b: DimMm;
  cur: CursorState;
  d: DimMm;
}): FitResult | null {
  const { b, cur, d } = args;

  // si la unidad no entra en el bulto en ninguna dimensión -> out
  if (d.largo > b.largo || d.ancho > b.ancho || d.alto > b.alto) return null;

  let { xCursor, zCursor, yCursor, rowDepth, layerHeight, capa } = cur;

  // fila nueva si excede X
  if (xCursor + d.largo > b.largo / 2) {
    xCursor = -b.largo / 2;
    zCursor += rowDepth;
    rowDepth = 0;
  }

  // capa nueva si excede Z
  if (zCursor + d.ancho > b.ancho / 2) {
    xCursor = -b.largo / 2;
    zCursor = -b.ancho / 2;
    yCursor += layerHeight;
    layerHeight = 0;
    capa += 1;
  }

  // no entra en altura
  if (yCursor + d.alto > b.alto / 2) return null;

  const posCentro = {
    x: xCursor + d.largo / 2,
    y: yCursor + d.alto / 2,
    z: zCursor + d.ancho / 2,
  };

  // avanzar cursores como tu lógica original
  const next: CursorState = {
    xCursor: xCursor + d.largo,
    zCursor,
    yCursor,
    rowDepth: Math.max(rowDepth, d.ancho),
    layerHeight: Math.max(layerHeight, d.alto),
    capa,
  };

  return { dim: d, next, posCentro };
}

/**
 * Heurística simple para elegir la “mejor” rotación:
 * - probamos candidates (1 o 6)
 * - elegimos la que deja menor “sobrante inmediato” en X y Z (tendencia a rellenar mejor fila/plano)
 */
function pickBestRotation(args: {
  b: DimMm;
  cur: CursorState;
  base: DimMm;
  rotationMode: RotationMode;
}): FitResult | null {
  const { b, cur, base, rotationMode } = args;

  const cands =
    rotationMode === "ROT_6"
      ? rotations6(base)
      : [{ dim: base, key: undefined }];

  let best: (FitResult & { score: number }) | null = null;

  for (const c of cands) {
    const fit = tryFitAtCursor({ b, cur, d: c.dim });
    if (!fit) continue;

    // score menor = mejor
    const endX = fit.posCentro.x + fit.dim.largo / 2;
    const endZ = fit.posCentro.z + fit.dim.ancho / 2;

    const slackX = b.largo / 2 - endX; // cuanto queda al final de fila
    const slackZ = b.ancho / 2 - endZ; // cuanto queda al final del plano

    // ponderación leve hacia rellenar X primero (tu algoritmo es X->Z->Y)
    const score = slackX * 1.0 + slackZ * 0.6;

    if (!best || score < best.score) {
      best = { ...fit, rotationKey: c.key, score };
    }
  }

  if (!best) return null;
  // limpiamos score antes de devolver
  const { score: _score, ...out } = best;
  return out;
}

export function calcularLayoutBulto3D(args: {
  bultoInternoMm: DimMm;
  items: ItemInput[];
  maxUnidades?: number;
  rotationMode?: RotationMode;
  stopAtOcupacion01?: number; // 0..1
}): { placements: BultoLayout3DPlacement[]; warnings: string[] } {
  const rotationMode: RotationMode = args.rotationMode ?? "NONE";
  const stopAt = args.stopAtOcupacion01;
  const warnings: string[] = [];

  const b = args.bultoInternoMm;
  if (!isValidDim(b)) {
    return {
      placements: [],
      warnings: ["Bulto interno inválido (dimensiones)."],
    };
  }

  const maxUnidades = Math.max(1, Math.floor(args.maxUnidades ?? 800));
  const bultoVol = volMm3(b);
  let ocupadoVol = 0;

  let cur: CursorState = {
    xCursor: -b.largo / 2,
    zCursor: -b.ancho / 2,
    yCursor: -b.alto / 2,
    rowDepth: 0,
    layerHeight: 0,
    capa: 1,
  };

  const placements: BultoLayout3DPlacement[] = [];
  const warnedNoFit = new Set<string>();

  // expand + sort (igual que vos)
  const expanded: ItemInput[] = [];
  for (const it of args.items) {
    const u = Math.max(0, Math.floor(safePos(it.unidades, 0)));
    for (let i = 0; i < u; i++) expanded.push(it);
  }

  expanded.sort((a, c) => volMm3(c.dimUnidadMm) - volMm3(a.dimUnidadMm));

  let placed = 0;

  for (const it of expanded) {
    if (placed >= maxUnidades) {
      warnings.push(
        `Se truncó el layout a ${maxUnidades} unidades por performance.`,
      );
      break;
    }

    // corte por ocupación objetivo (si existe)
    if (typeof stopAt === "number" && Number.isFinite(stopAt) && stopAt > 0) {
      const occ01 = bultoVol > 0 ? ocupadoVol / bultoVol : 0;
      if (occ01 >= Math.min(1, stopAt)) break;
    }

    const fit = pickBestRotation({
      b,
      cur,
      base: it.dimUnidadMm,
      rotationMode,
    });

    if (!fit) {
      const key = `${it.codigo}:NO_FIT`;
      if (!warnedNoFit.has(key)) {
        warnedNoFit.add(key);
        warnings.push(
          `${it.codigo}: unidad no entra en la grilla actual (o no hay orientación válida).`,
        );
      }
      continue;
    }

    placements.push({
      tipo_producto_id: it.tipo_producto_id,
      codigo: it.codigo,
      dim_unidad_mm: fit.dim,
      positionMm: fit.posCentro,
      capa: fit.next.capa,
      rotationKey: fit.rotationKey,
    });

    cur = fit.next;
    ocupadoVol += volMm3(fit.dim);
    placed += 1;
  }

  if (placements.length === 0) {
    warnings.push(
      "No se pudo ubicar ninguna unidad (faltan dims o no entran).",
    );
  }

  // gravity + bounds check: podés mantener tus funciones tal cual (reusando las tuyas)
  // ✅ dejo tus helpers abajo casi idénticos

  function overlap1D(aMin: number, aMax: number, bMin: number, bMax: number) {
    return aMin < bMax && bMin < aMax;
  }

  function overlapXZ(a: BultoLayout3DPlacement, b2: BultoLayout3DPlacement) {
    const ad = a.dim_unidad_mm;
    const bd = b2.dim_unidad_mm;

    const aMinX = a.positionMm.x - ad.largo / 2;
    const aMaxX = a.positionMm.x + ad.largo / 2;
    const aMinZ = a.positionMm.z - ad.ancho / 2;
    const aMaxZ = a.positionMm.z + ad.ancho / 2;

    const bMinX = b2.positionMm.x - bd.largo / 2;
    const bMaxX = b2.positionMm.x + bd.largo / 2;
    const bMinZ = b2.positionMm.z - bd.ancho / 2;
    const bMaxZ = b2.positionMm.z + bd.ancho / 2;

    return (
      overlap1D(aMinX, aMaxX, bMinX, bMaxX) &&
      overlap1D(aMinZ, aMaxZ, bMinZ, bMaxZ)
    );
  }

  function applyGravity(ps: BultoLayout3DPlacement[], bultoInternoMm: DimMm) {
    const floorY = -bultoInternoMm.alto / 2;

    const orderedIdx = ps
      .map((p, i) => ({ i, y: p.positionMm.y }))
      .sort((a, b) => a.y - b.y);

    for (const { i } of orderedIdx) {
      const p = ps[i];
      const d = p.dim_unidad_mm;
      const halfY = d.alto / 2;

      let supportTopY = floorY;

      for (let j = 0; j < ps.length; j++) {
        if (j === i) continue;
        const q = ps[j];
        if (q.positionMm.y >= p.positionMm.y) continue;
        if (!overlapXZ(p, q)) continue;

        const qTopY = q.positionMm.y + q.dim_unidad_mm.alto / 2;
        if (qTopY > supportTopY) supportTopY = qTopY;
      }

      const newCenterY = supportTopY + halfY;
      const ceilingY = bultoInternoMm.alto / 2;

      if (newCenterY + halfY <= ceilingY + 1e-6) p.positionMm.y = newCenterY;
    }
  }

  applyGravity(placements, b);

  // bounds check
  const eps = 1e-6;
  for (const p of placements) {
    const d = p.dim_unidad_mm;

    const minX = p.positionMm.x - d.largo / 2;
    const maxX = p.positionMm.x + d.largo / 2;
    const minY = p.positionMm.y - d.alto / 2;
    const maxY = p.positionMm.y + d.alto / 2;
    const minZ = p.positionMm.z - d.ancho / 2;
    const maxZ = p.positionMm.z + d.ancho / 2;

    const out =
      minX < -b.largo / 2 - eps ||
      maxX > b.largo / 2 + eps ||
      minY < -b.alto / 2 - eps ||
      maxY > b.alto / 2 + eps ||
      minZ < -b.ancho / 2 - eps ||
      maxZ > b.ancho / 2 + eps;

    if (out) {
      warnings.push(
        `${p.codigo}: placement fuera del bulto (pos/dim inconsistente).`,
      );
      break;
    }
  }

  return { placements, warnings };
}
