"use server";

import { prisma } from "@/lib/prisma";

type MixPolicy = "NO_MEZCLAR" | "PERMITIR_MEZCLA";
type Objective = "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function requirePositive(n: number, msg: string) {
  if (!Number.isFinite(n) || n <= 0) throw new Error(msg);
  return n;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Decimal(5,2) friendly (Prisma Decimal acepta string/Decimal) */
function toDecimal2Pct(v: unknown) {
  const n = toNumber(v, 0);
  const clamped = clamp(n, 0, 100);
  return clamped.toFixed(2); // "12.34"
}

export async function guardarPalletPlan(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;
  mixPolicy: MixPolicy;
  objective: Objective;
  objetivoUnidades?: number;
  objetivoOcupacion?: number; // 0..1 (como en preview)
  modoSimulacion?: boolean;
  plan: any; // PalletPlanResult serializable
}) {
  const { loteId, tipoContenedorId, mixPolicy, plan } = params;

  requirePositive(loteId, "loteId inválido.");
  requirePositive(tipoContenedorId, "tipoContenedorId inválido.");
  if (!plan?.pallet1) throw new Error("Plan inválido (sin pallet1).");

  // Validar existencia
  const [lote, contenedor] = await Promise.all([
    prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      select: { id: true },
    }),
    prisma.tipoContenedor.findUnique({
      where: { id: tipoContenedorId },
      select: { id: true },
    }),
  ]);

  if (!lote) throw new Error("Lote inexistente.");
  if (!contenedor) throw new Error("Contenedor inexistente.");

  const p1 = plan.pallet1;

  const palletsNecesarios = requirePositive(
    toNumber(plan.palletsRequeridos, 0),
    "plan.palletsRequeridos inválido."
  );

  const ocupacionVolumenPct = toDecimal2Pct(p1.ocupacionVolumenPct);
  const pesoTotalKg = Math.max(0, toNumber(p1.pesoTotalKg, 0));

  // prioridad: referencias.alturaUsadaMm; fallback: alturaTotalM
  const alturaUtilizadaMm = Math.max(
    0,
    p1?.referencias?.alturaUsadaMm != null
      ? Math.round(toNumber(p1.referencias.alturaUsadaMm, 0))
      : Math.round(toNumber(p1.alturaTotalM, 0) * 1000)
  );

  const permitirMezcla = mixPolicy === "PERMITIR_MEZCLA";

  // Si tu plan NO trae esto, queda null (OK)
  const maxCodigosPorPallet =
    p1?.referencias?.maxCodigosPorPallet != null
      ? Math.max(0, Math.trunc(toNumber(p1.referencias.maxCodigosPorPallet, 0)))
      : null;

  const maxAlturaMm =
    p1?.referencias?.alturaUtilMm != null
      ? Math.max(0, Math.round(toNumber(p1.referencias.alturaUtilMm, 0)))
      : null;

  const data = {
    loteId,
    tipoContenedorId,
    permitir_mezcla: permitirMezcla,
    max_codigos_por_pallet: maxCodigosPorPallet,
    max_altura_mm: maxAlturaMm,
    pallets_necesarios: palletsNecesarios,
    ocupacion_volumen_pct: ocupacionVolumenPct, // Decimal(5,2)
    peso_total_kg: pesoTotalKg,
    altura_utilizada_mm: alturaUtilizadaMm,
    layout: plan, // JSON completo
  };

  // ✅ robusto: no depende del nombre del unique input compuesto
  const existing = await prisma.cubicacionPalletPlan.findFirst({
    where: { loteId, tipoContenedorId },
    select: { id: true },
  });

  const saved = existing
    ? await prisma.cubicacionPalletPlan.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      })
    : await prisma.cubicacionPalletPlan.create({
        data,
        select: { id: true },
      });

  return { palletPlanId: saved.id };
}
