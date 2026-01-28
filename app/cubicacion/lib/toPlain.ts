// app/cubicacion/lib/toPlain.ts
import { Prisma } from "@prisma/client";

function isDecimalLike(v: any): boolean {
  if (!v || typeof v !== "object") return false;

  // 1) caso ideal
  if (v instanceof Prisma.Decimal) return true;

  // 2) fallback robusto (evita fallos de instanceof por bundling)
  const ctorName = v?.constructor?.name;
  if (ctorName === "Decimal") return true;

  // 3) duck typing: Prisma.Decimal tiene estos métodos
  return typeof v.toNumber === "function" && typeof v.toString === "function";
}

export function toPlain<T>(value: T): any {
  if (value === null || value === undefined) return value;

  if (isDecimalLike(value)) {
    // Recomendación: toString() para no perder precisión.
    // Si preferís number, dejá toNumber().
    return (value as any).toString();
  }

  if (value instanceof Date) return value.toISOString();

  if (typeof value === "bigint") return value.toString();

  if (Array.isArray(value)) return value.map(toPlain);

  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = toPlain(v);
    return out;
  }

  return value;
}
