"use server";

import { prisma } from "@/lib/prisma";
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

export async function previewPalletPlan(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;
  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
  objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  objetivoUnidades?: number; // bultos objetivo (según tu UI)
  objetivoOcupacion?: number; // 0..1 (tu UI ya lo manda /100)
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
        bulto_empresa: true, // ✅ snake_case
        items: {
          include: { tipo_producto: true }, // ✅ snake_case
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);

  if (!contenedor) throw new Error("Contenedor inexistente.");
  if (!lote) throw new Error("Lote inexistente.");
  if (!lote.items?.length) throw new Error("El lote no tiene ítems.");

  // 2) Validar dimensiones del contenedor (pueden venir null)
  const largoM = toNumber(contenedor.largo_mts, 0);
  const anchoM = toNumber(contenedor.ancho_mts, 0);
  const altoM = toNumber(contenedor.alto_mts, 0);

  requirePositive(largoM, "El contenedor no tiene largo_mts válido.");
  requirePositive(anchoM, "El contenedor no tiene ancho_mts válido.");
  requirePositive(altoM, "El contenedor no tiene alto_mts válido.");

  // 3) Regla operativa (ejemplo actual: por empresa+contenedor, genérica de producto/transporte)
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  // 4) Si lote EMPRESA_BULTO, debe existir la relación
  if (lote.tipo_bulto === "EMPRESA_BULTO" && !lote.bulto_empresa) {
    throw new Error(
      "El lote es EMPRESA_BULTO pero no tiene bulto_empresa asociado (bulto_empresa_id)."
    );
  }

  // 5) Armado de items para el cálculo desde snapshot del lote
  const items = lote.items.map((it) => {
    const tp = it.tipo_producto;

    const unidades = toNumber(it.cantidad_unidades, 0);
    requirePositive(unidades, `Item ${tp.codigo}: cantidad_unidades inválida.`);

    // ✅ snapshot (si existe) para consistencia
    const unidadesPorBultoSnapshot =
      it.unidades_por_bulto != null && toNumber(it.unidades_por_bulto, 0) > 0
        ? toNumber(it.unidades_por_bulto, 0)
        : null;

    const unidadesPorBultoFallback = Math.max(
      1,
      toNumber(tp.unidad_entra_por_bulto, 1)
    );

    const unidadesPorBulto =
      unidadesPorBultoSnapshot ?? unidadesPorBultoFallback;

    const cantidadBultosSnapshot =
      it.cantidad_bultos != null && toNumber(it.cantidad_bultos, 0) > 0
        ? toNumber(it.cantidad_bultos, 0)
        : 0;

    const cantidadBultos =
      cantidadBultosSnapshot > 0
        ? cantidadBultosSnapshot
        : ceilDiv(unidades, unidadesPorBulto);

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

    // Peso bulto: preferimos peso_por_bulto; si no, estimamos desde peso unidad * unidadesPorBulto
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
      tipoProductoId: it.tipo_producto_id, // ✅ ojo: el motor espera tipoProductoId
      codigo,
      descripcion,
      cantidadBultos,
      dimBultoMm,
      pesoBultoKg,
    };
  });

  // ✅ Consoles (preview)
  console.log("PREVIEW_PALLET :: LOTE", {
    loteId: lote.id,
    tipo_bulto: lote.tipo_bulto,
    bulto_empresa_id: lote.bulto_empresa_id,
    bulto_empresa: lote.bulto_empresa
      ? {
          id: lote.bulto_empresa.id,
          largo_mm: lote.bulto_empresa.largo_mm,
          ancho_mm: lote.bulto_empresa.ancho_mm,
          alto_mm: lote.bulto_empresa.alto_mm,
        }
      : null,
    snapshot: {
      unidades_totales: lote.unidades_totales,
      bultos_totales: lote.bultos_totales,
    },
  });

  console.log(
    "PREVIEW_PALLET :: ITEMS",
    items.map((x) => ({
      codigo: x.codigo,
      cantidadBultos: x.cantidadBultos,
      dimBultoMm: x.dimBultoMm,
      pesoBultoKg: x.pesoBultoKg,
    }))
  );

  // 6) Objetivos
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
      "El objetivo de ocupación debe estar entre 0 y 1 (ej: 0.50)."
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

  console.log("PREVIEW_PALLET :: PLAN resumen", {
    palletsRequeridos: plan.palletsRequeridos,
    cajasTotales: plan.pallet1.cajasTotales,
    cajasPorCapa: plan.pallet1.cajasPorCapa,
    capas: plan.pallet1.capas,
    alturaTotalM: plan.pallet1.alturaTotalM,
    pesoTotalKg: plan.pallet1.pesoTotalKg,
    ocupacionBasePct: plan.pallet1.ocupacionBasePct,
    ocupacionVolumenPct: plan.pallet1.ocupacionVolumenPct,
    ocupacionLogradaPct: plan.pallet1.ocupacionLogradaPct,
    unidadesColocadas: plan.pallet1.unidadesColocadas,
    volumenLibreMm3: plan.pallet1.volumenLibreMm3,
    warnings: plan.pallet1.warnings,
    placementsCount: plan.pallet1.placements?.length ?? 0,
    palletDimMm: plan.pallet1.palletDimMm,
  });

  return { plan };
}
