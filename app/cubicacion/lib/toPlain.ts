import { Prisma } from "@prisma/client";

export function toPlain<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (value instanceof Prisma.Decimal) {
    return Number(value) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((v) => toPlain(v)) as unknown as T;
  }

  if (typeof value === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      out[k] = toPlain(v);
    }
    return out;
  }

  return value;
}
