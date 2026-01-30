import { DimMm, EmpresaBultoDTO } from "../types/domains";

function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function getEmpresaBultoInnerDim(b: EmpresaBultoDTO): DimMm | null {
  const li = safeInt(b.largo_int_mm, 0);
  const ai = safeInt(b.ancho_int_mm, 0);
  const hi = safeInt(b.alto_int_mm, 0);

  if (li > 0 && ai > 0 && hi > 0) return { largo: li, ancho: ai, alto: hi };

  const esp = Math.max(0, safeInt(b.espesor_pared_mm ?? 0, 0));
  const l = safeInt(b.largo_mm, 0) - 2 * esp;
  const a = safeInt(b.ancho_mm, 0) - 2 * esp;
  const h = safeInt(b.alto_mm, 0) - 2 * esp;

  if (l > 0 && a > 0 && h > 0) return { largo: l, ancho: a, alto: h };
  return null;
}
