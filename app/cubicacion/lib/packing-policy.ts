// lib/packing-policy.ts
export type PackingPolicy =
  | "OPERATIVO_AGRUPADO"
  | "OPTIMIZAR_VOLUMEN"
  | "BUSCAR_MEJOR_ACOMODO";

export const PACKING_POLICY_LABELS: Record<
  PackingPolicy,
  {
    titulo: string;
    descripcion: string;
  }
> = {
  OPERATIVO_AGRUPADO: {
    titulo: "Operativa (no mezcla, por producto)",
    descripcion:
      "Prioriza facilidad de armado y conteo en depósito. Los productos se agrupan dentro del bulto.",
  },
  OPTIMIZAR_VOLUMEN: {
    titulo: "Optimizar volumen (mezclar productos)",
    descripcion:
      "Prioriza ocupación del bulto y reducción de cantidad de bultos.",
  },
  BUSCAR_MEJOR_ACOMODO: {
    titulo: "Mejor acomodo (mezcla + más intentos, puede demorar)",
    descripcion:
      "Ejecuta más intentos y estrategias para mejorar el resultado. Puede demorar unos segundos.",
  },
};
