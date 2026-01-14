// src/app/cubicacion/actions/savePalletPlan.ts
"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { calcularPalletPlan } from "../lib/packing-pallet";

function toNumber(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function requirePositive(n: number, msg: string) {
  if (!Number.isFinite(n) || n <= 0) throw new Error(msg);
  return n;
}

function ceilDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.ceil(a / b);
}

// ✅ Fix TS2322 (unknown -> InputJsonValue)
function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function savePalletPlan(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;
  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
  objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  objetivoUnidades?: number; // bultos objetivo (si modoSimulacion)
  objetivoOcupacion?: number; // 0..1
  modoSimulacion?: boolean;
}) {
  const {
    empresaId,
    loteId,
    tipoContenedorId,
    mixPolicy,
    objective,
    objetivoUnidades,
    objetivoOcupacion,
    modoSimulacion,
  } = params;

  // 1) Cargar contenedor + lote (snake_case)
  const [contenedor, lote] = await Promise.all([
    prisma.tipoContenedor.findUnique({ where: { id: tipoContenedorId } }),
    prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      include: {
        bulto_empresa: true,
        items: {
          include: { tipo_producto: true },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);

  if (!contenedor) throw new Error("Contenedor inexistente.");
  if (!lote) throw new Error("Lote inexistente.");
  if (!lote.items?.length) throw new Error("El lote no tiene ítems.");

  // 2) Validar dimensiones del contenedor
  const largoM = toNumber(contenedor.largo_mts, 0);
  const anchoM = toNumber(contenedor.ancho_mts, 0);
  const altoM = toNumber(contenedor.alto_mts, 0);

  requirePositive(largoM, "El contenedor no tiene largo_mts válido.");
  requirePositive(anchoM, "El contenedor no tiene ancho_mts válido.");
  requirePositive(altoM, "El contenedor no tiene alto_mts válido.");

  // 3) Regla operativa
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  // 4) EMPRESA_BULTO debe tener relación
  if (lote.tipo_bulto === "EMPRESA_BULTO" && !lote.bulto_empresa) {
    throw new Error(
      "El lote es EMPRESA_BULTO pero no tiene bulto_empresa asociado (bulto_empresa_id)."
    );
  }

  // 5) Items (snapshot-first para consistencia)
  const items = lote.items.map((it, idx) => {
    const tp = it.tipo_producto;

    const unidades = toNumber(it.cantidad_unidades, 0);
    requirePositive(unidades, `Item ${idx + 1}: cantidad_unidades inválida.`);

    // ✅ snapshot: unidades_por_bulto
    const unPorBultoSnapshot =
      it.unidades_por_bulto != null && toNumber(it.unidades_por_bulto, 0) > 0
        ? toNumber(it.unidades_por_bulto, 0)
        : null;

    const unPorBultoFallback = Math.max(
      1,
      toNumber(tp.unidad_entra_por_bulto, 1)
    );

    const unidadesPorBulto = unPorBultoSnapshot ?? unPorBultoFallback;

    // ✅ snapshot: cantidad_bultos
    const bultosSnapshot =
      it.cantidad_bultos != null && toNumber(it.cantidad_bultos, 0) > 0
        ? toNumber(it.cantidad_bultos, 0)
        : 0;

    const cantidadBultos =
      bultosSnapshot > 0 ? bultosSnapshot : ceilDiv(unidades, unidadesPorBulto);

    requirePositive(
      cantidadBultos,
      `Item ${tp.codigo}: no se pudo determinar cantidad_bultos.`
    );

    const codigo = String(tp.codigo ?? `PROD-${it.tipo_producto_id}`).trim();
    const descripcion = String(tp.descripcion ?? "");

    const dimBultoMm =
      lote.tipo_bulto === "EMPRESA_BULTO"
        ? {
            largo: toNumber(lote.bulto_empresa!.largo_mm, 0),
            ancho: toNumber(lote.bulto_empresa!.ancho_mm, 0),
            alto: toNumber(lote.bulto_empresa!.alto_mm, 0),
          }
        : {
            largo: toNumber(tp.largo_por_bulto, 0),
            ancho: toNumber(tp.ancho_por_bulto, 0),
            alto: toNumber(tp.alto_por_bulto, 0),
          };

    requirePositive(
      dimBultoMm.largo,
      `El producto ${codigo} no tiene largo de bulto válido.`
    );
    requirePositive(
      dimBultoMm.ancho,
      `El producto ${codigo} no tiene ancho de bulto válido.`
    );
    requirePositive(
      dimBultoMm.alto,
      `El producto ${codigo} no tiene alto de bulto válido.`
    );

    // Peso bulto: preferimos peso_por_bulto; si no, estimamos con snapshot peso_unidad_kg y unidadesPorBulto
    const pesoPorBulto =
      tp.peso_por_bulto != null ? toNumber(tp.peso_por_bulto, 0) : 0;

    const pesoUnidad =
      it.peso_unidad_kg != null
        ? toNumber(it.peso_unidad_kg, 0)
        : tp.peso_por_unidad_entrega != null
        ? toNumber(tp.peso_por_unidad_entrega, 0)
        : tp.peso_por_unidad_venta != null
        ? toNumber(tp.peso_por_unidad_venta, 0)
        : 0;

    const pesoBultoKg =
      pesoPorBulto > 0
        ? pesoPorBulto
        : Math.max(0, pesoUnidad) * unidadesPorBulto;

    return {
      tipoProductoId: it.tipo_producto_id,
      codigo,
      descripcion,
      cantidadBultos,
      dimBultoMm,
      pesoBultoKg,
    };
  });

  // 6) Objetivos (solo valida rango)
  const parsedObjetivoUnidades =
    objetivoUnidades != null && toNumber(objetivoUnidades, 0) > 0
      ? toNumber(objetivoUnidades, 0)
      : undefined;

  const parsedObjetivoOcupacion =
    objetivoOcupacion != null ? Number(objetivoOcupacion) : undefined;

  if (
    parsedObjetivoOcupacion != null &&
    (parsedObjetivoOcupacion < 0 || parsedObjetivoOcupacion > 1)
  ) {
    throw new Error(
      "El objetivo de ocupación debe estar entre 0 y 1 (ej: 0.85)."
    );
  }

  // 7) Calcular plan
  const plan = calcularPalletPlan({
    contenedor: {
      id: contenedor.id,
      codigo: contenedor.codigo,
      largo_mts: largoM,
      ancho_mts: anchoM,
      alto_mts: altoM,
      peso_pallet_kg: toNumber(contenedor.peso_pallet_kg, 0),
      peso_max_kg: toNumber(contenedor.peso_max_kg, 0),
    },
    reglas: regla
      ? {
          maxAlturaM: regla.maxAlturaM ? Number(regla.maxAlturaM) : null,
          maxCodigosPorPallet: regla.maxCodigosPorPallet ?? null,
          permitirMezcla: regla.permitirMezcla,
        }
      : null,
    mixPolicy,
    objective,
    items,
    objetivoUnidades: parsedObjetivoUnidades,
    objetivoOcupacion: parsedObjetivoOcupacion,
    modoSimulacion,
  });

  // 8) Persistir (upsert por uq_lote_contenedor)
  const maxAlturaMm =
    regla?.maxAlturaM != null
      ? Math.round(Number(regla.maxAlturaM) * 1000)
      : null;

  const permitirMezclaFinal =
    (regla?.permitirMezcla ?? true) && mixPolicy === "PERMITIR_MEZCLA";

  const saved = await prisma.cubicacionPalletPlan.upsert({
    where: {
      // @@unique([loteId, tipoContenedorId]) -> nombre real en tu client
      loteId_tipoContenedorId: { loteId, tipoContenedorId },
    },
    create: {
      loteId,
      tipoContenedorId,

      permitir_mezcla: permitirMezclaFinal,
      max_codigos_por_pallet: regla?.maxCodigosPorPallet ?? null,
      max_altura_mm: maxAlturaMm,

      pallets_necesarios: plan.palletsRequeridos,
      ocupacion_volumen_pct: plan.pallet1.ocupacionVolumenPct,
      peso_total_kg: plan.pallet1.pesoTotalKg,
      altura_utilizada_mm: Math.round(plan.pallet1.alturaTotalM * 1000),

      layout: toInputJsonValue(plan),
    },
    update: {
      permitir_mezcla: permitirMezclaFinal,
      max_codigos_por_pallet: regla?.maxCodigosPorPallet ?? null,
      max_altura_mm: maxAlturaMm,

      pallets_necesarios: plan.palletsRequeridos,
      ocupacion_volumen_pct: plan.pallet1.ocupacionVolumenPct,
      peso_total_kg: plan.pallet1.pesoTotalKg,
      altura_utilizada_mm: Math.round(plan.pallet1.alturaTotalM * 1000),

      layout: toInputJsonValue(plan),
    },
    select: { id: true },
  });

  return { plan, palletPlanId: saved.id };
}
