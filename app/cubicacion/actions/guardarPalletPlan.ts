"use server";

import { prisma } from "@/lib/prisma";

type MixPolicy = "NO_MEZCLAR" | "PERMITIR_MEZCLA";
type Objective = "OPERATIVO_ESTABLE" | "OPERATIVO_PARAMETRIZABLE";
type Rotacion2D = "ON" | "OFF";

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

function asIntOrNull(v: unknown) {
  const n = Math.floor(toNumber(v, NaN));
  return Number.isFinite(n) ? n : null;
}

function asPosIntOrNull(v: unknown) {
  const n = Math.floor(toNumber(v, NaN));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeString(v: unknown) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/** suma bultos en pallet1 (según itemsOut) */
function sumBultosEnPallet1(plan: any): number {
  const items = plan?.pallet1?.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce(
    (acc: number, it: any) =>
      acc + Math.max(0, Math.floor(toNumber(it?.bultosEnPallet1, 0))),
    0,
  );
}

export async function guardarPalletPlan(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;

  // inputs (lo que el usuario eligió)
  mixPolicy: MixPolicy;
  objective: Objective;
  rotacion2D?: Rotacion2D;

  // objetivos / modo
  objetivoUnidades?: number; // en tu caso: bultos objetivo (legacy naming)
  objetivoOcupacion?: number; // 0..1
  modoSimulacion?: boolean;

  // PRO params (si existen en tu form)
  parametros?: {
    bultosSimulados?: number | null;
    capasMaxOverride?: number | null;
    objetivoOcupacion01?: number | null;
    apilableOverride?: boolean | null;
  } | null;

  // tracing opcional
  simulacionId?: number | null;
  candidateKey?: "A" | "B" | "C" | "D" | null;

  plan: any; // PalletPlanResult serializable
}) {
  const {
    empresaId,
    loteId,
    tipoContenedorId,
    mixPolicy,
    objective,
    rotacion2D,
    objetivoUnidades,
    objetivoOcupacion,
    modoSimulacion,
    parametros,
    simulacionId,
    candidateKey,
    plan,
  } = params;

  requirePositive(empresaId, "empresaId inválido.");
  requirePositive(loteId, "loteId inválido.");
  requirePositive(tipoContenedorId, "tipoContenedorId inválido.");
  if (!plan?.pallet1) throw new Error("Plan inválido (sin pallet1).");

  // Validar existencia (y evita FK rotas)
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

  // pallets necesarios (ya corregiste la estimación)
  const palletsNecesarios = requirePositive(
    toNumber(plan.palletsRequeridos, 0),
    "plan.palletsRequeridos inválido.",
  );

  // métricas
  const ocupacionVolumenPct = toDecimal2Pct(p1.ocupacionVolumenPct);
  const pesoTotalKg = Math.max(0, toNumber(p1.pesoTotalKg, 0));

  // alturas
  const alturaUtilMm = asPosIntOrNull(p1?.referencias?.alturaUtilMm);
  const alturaUsadaMm = asPosIntOrNull(p1?.referencias?.alturaUsadaMm);

  const alturaUtilizadaMm = Math.max(
    0,
    alturaUsadaMm ?? Math.round(toNumber(p1.alturaTotalM, 0) * 1000),
  );

  // reglas / misc (si existen)
  const maxCodigosPorPallet = asPosIntOrNull(
    p1?.referencias?.maxCodigosPorPallet,
  );

  // boolean “input” para columna
  const permitirMezclaInput = mixPolicy === "PERMITIR_MEZCLA";

  // candidateKey: prioridad param > layout meta > null
  const candidateKeyFinal =
    candidateKey ??
    safeString(plan?._meta?.candidateKey) ??
    safeString(plan?.candidate_key) ??
    null;

  // simulacion id
  const simulacionIdFinal =
    simulacionId != null
      ? asPosIntOrNull(simulacionId)
      : asPosIntOrNull(plan?._meta?.simulacionId);

  // derivados útiles para auditoría
  const bultosEnPallet1 = sumBultosEnPallet1(plan);
  const cajasTotalesPallet1 =
    asPosIntOrNull(p1?.cajasTotales) ?? bultosEnPallet1;
  const objetivoBultosInput =
    asPosIntOrNull(parametros?.bultosSimulados) ??
    asPosIntOrNull(objetivoUnidades) ??
    asPosIntOrNull(plan?._meta?._input?.objetivoUnidades) ??
    null;

  // layout enriquecido (source of truth + auditoría)
  const layout = {
    ...plan,
    _meta: {
      ...(plan?._meta ?? {}),
      version: "pallet-plan-v2",
      savedAt: new Date().toISOString(),
      empresaId,
      loteId,
      tipoContenedorId,
      simulacionId: simulacionIdFinal,
      candidateKey: candidateKeyFinal,
    },
    _input: {
      mixPolicyInput: mixPolicy,
      objective,
      rotacion2D: rotacion2D ?? p1?.referencias?.rotacion2D ?? null,
      modoSimulacion: Boolean(
        modoSimulacion ?? p1?.referencias?.modoSimulacion ?? false,
      ),
      objetivoUnidades: objetivoUnidades ?? null,
      objetivoOcupacion01: objetivoOcupacion ?? null, // legacy
      parametros: parametros ?? null,
    },
    _derived: {
      palletsNecesarios,
      cajasTotalesPallet1: cajasTotalesPallet1 ?? null,
      bultosEnPallet1: bultosEnPallet1 || null,
      objetivoBultosInput,
      permitirMezclaInput,
      alturaUtilMm,
      alturaUsadaMm: alturaUsadaMm ?? null,
      ocupacionVolumenPct: Number(ocupacionVolumenPct),
      pesoTotalKg,
    },
  };

  const data: any = {
    loteId,
    tipoContenedorId,

    permitir_mezcla: permitirMezclaInput,

    max_codigos_por_pallet: maxCodigosPorPallet,
    max_altura_mm: alturaUtilMm ?? null,

    pallets_necesarios: palletsNecesarios,

    ocupacion_volumen_pct: ocupacionVolumenPct, // Decimal(5,2)
    peso_total_kg: pesoTotalKg,
    altura_utilizada_mm: alturaUtilizadaMm,

    simulacion_id: simulacionIdFinal, // si tu tabla lo tiene
    candidate_key: candidateKeyFinal, // si tu tabla lo tiene

    layout, // JSON completo enriquecido
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
