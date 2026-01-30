// app/cubicacion/simulacion/lib/packing-metrics.ts
export type DimMm = { largo: number; ancho: number; alto: number };

export type RotationMode = "NONE" | "ROT_6";

export function isValidDim(d: DimMm | null | undefined) {
  return !!d && d.largo > 0 && d.ancho > 0 && d.alto > 0;
}

export function volMm3(d: DimMm) {
  return d.largo * d.ancho * d.alto;
}

export function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function safePosInt(v: unknown, fallback = 0) {
  const n = safeInt(v, fallback);
  return n > 0 ? n : fallback;
}

export function ceilDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.ceil(a / b);
}

/** 6 orientaciones (permutaciones) */
export function rotations6(d: DimMm): Array<{ dim: DimMm; key: string }> {
  const { largo: L, ancho: A, alto: H } = d;
  return [
    { dim: { largo: L, ancho: A, alto: H }, key: "L×A×H" },
    { dim: { largo: L, ancho: H, alto: A }, key: "L×H×A" },
    { dim: { largo: A, ancho: L, alto: H }, key: "A×L×H" },
    { dim: { largo: A, ancho: H, alto: L }, key: "A×H×L" },
    { dim: { largo: H, ancho: L, alto: A }, key: "H×L×A" },
    { dim: { largo: H, ancho: A, alto: L }, key: "H×A×L" },
  ];
}

/** Capacidad por grilla sin rotación */
export function gridCapacity(dimBulto: DimMm, dimUnidad: DimMm) {
  if (!isValidDim(dimBulto) || !isValidDim(dimUnidad)) return 0;

  const nx = Math.floor(dimBulto.largo / dimUnidad.largo);
  const ny = Math.floor(dimBulto.ancho / dimUnidad.ancho);
  const nz = Math.floor(dimBulto.alto / dimUnidad.alto);

  if (nx <= 0 || ny <= 0 || nz <= 0) return 0;
  return nx * ny * nz;
}

/** Máxima capacidad por grilla, opcional con rotación */
export function maxGridCapacity(args: {
  dimBulto: DimMm;
  dimUnidad: DimMm;
  rotationMode: RotationMode;
}) {
  const { dimBulto, dimUnidad, rotationMode } = args;

  if (!isValidDim(dimBulto) || !isValidDim(dimUnidad)) {
    return { capMax: 0, bestDimUnidad: dimUnidad, bestKey: "—" };
  }

  if (rotationMode === "NONE") {
    const cap = gridCapacity(dimBulto, dimUnidad);
    return { capMax: cap, bestDimUnidad: dimUnidad, bestKey: "SIN_ROT" };
  }

  let best = { capMax: 0, bestDimUnidad: dimUnidad, bestKey: "—" };

  for (const r of rotations6(dimUnidad)) {
    const cap = gridCapacity(dimBulto, r.dim);
    if (cap > best.capMax) {
      best = { capMax: cap, bestDimUnidad: r.dim, bestKey: r.key };
    }
  }
  return best;
}

/** Ocupación por volumen (%): unidades * volUnidad / volBulto */
export function occupancyVolPct(args: {
  dimBulto: DimMm;
  unidades: number;
  dimUnidad: DimMm;
}) {
  const { dimBulto, unidades, dimUnidad } = args;
  if (!isValidDim(dimBulto) || !isValidDim(dimUnidad)) return null;

  const vB = volMm3(dimBulto);
  if (vB <= 0) return null;

  const u = Math.max(0, Math.floor(unidades));
  const vU = volMm3(dimUnidad);
  const pct = (u * vU * 100) / vB;
  return Number.isFinite(pct) ? pct : null;
}
