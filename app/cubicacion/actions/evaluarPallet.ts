"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { calcularPalletPlan } from "../lib/packing-pallet";

/* =========================
   Utils seguros
========================= */

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

/* =========================
   Action principal
========================= */

export async function evaluarPallet(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;
  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
  objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  objetivoUnidades?: number;
  objetivoOcupacion?: number;
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

  /* =========================
     1) Cargar contenedor + lote
  ========================= */

  const [contenedor, lote] = await Promise.all([
    prisma.tipoContenedor.findUnique({
      where: { id: tipoContenedorId },
    }),
    prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      include: {
        bultoEmpresa: true,
        items: {
          include: { tipoProducto: true },
        },
      },
    }),
  ]);

  if (!contenedor) throw new Error("Contenedor inexistente.");
  if (!lote) throw new Error("Lote inexistente.");
  if (!lote.items?.length) throw new Error("El lote no tiene ítems.");

  /* =========================
     🔍 DEBUG LOTE (SEGURO)
  ========================= */

  console.log("EVALUAR_PALLET :: LOTE", {
    loteId: lote.id,
    tipo_bulto: lote.tipo_bulto,
    bulto_empresa_id: lote.bulto_empresa_id ?? null,
    bultoEmpresa: lote.bultoEmpresa
      ? {
          id: lote.bultoEmpresa.id,
          largo_mm: lote.bultoEmpresa.largo_mm,
          ancho_mm: lote.bultoEmpresa.ancho_mm,
          alto_mm: lote.bultoEmpresa.alto_mm,
        }
      : null,
  });

  /* =========================
     2) Validar dimensiones contenedor
  ========================= */

  const largoM = toNumber(contenedor.largo_mts);
  const anchoM = toNumber(contenedor.ancho_mts);
  const altoM = toNumber(contenedor.alto_mts);

  requirePositive(largoM, "El contenedor no tiene largo_mts válido.");
  requirePositive(anchoM, "El contenedor no tiene ancho_mts válido.");
  requirePositive(altoM, "El contenedor no tiene alto_mts válido.");

  /* =========================
     3) Regla aplicable
  ========================= */

  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  /* =========================
     4) Validación EMPRESA_BULTO
  ========================= */

  if (lote.tipo_bulto === "EMPRESA_BULTO" && !lote.bultoEmpresa) {
    throw new Error(
      "El lote es EMPRESA_BULTO pero no tiene bultoEmpresa asociado."
    );
  }

  /* =========================
     5) Armar items para cálculo
  ========================= */

  const items = lote.items.map((it) => {
    const tp = it.tipoProducto;

    const unidades = toNumber(it.cantidad_unidades);
    requirePositive(unidades, `Item ${tp.codigo}: cantidad_unidades inválida.`);

    const unidadesPorBulto = Math.max(
      1,
      toNumber(tp.unidad_entra_por_bulto, 1)
    );

    const cantidadBultos = ceilDiv(unidades, unidadesPorBulto);
    requirePositive(
      cantidadBultos,
      `Item ${tp.codigo}: no se pudo derivar cantidadBultos.`
    );

    const dimBultoMm =
      lote.tipo_bulto === "EMPRESA_BULTO"
        ? {
            largo: toNumber(lote.bultoEmpresa!.largo_mm),
            ancho: toNumber(lote.bultoEmpresa!.ancho_mm),
            alto: toNumber(lote.bultoEmpresa!.alto_mm),
          }
        : {
            largo: toNumber(tp.largo_por_bulto),
            ancho: toNumber(tp.ancho_por_bulto),
            alto: toNumber(tp.alto_por_bulto),
          };

    requirePositive(
      dimBultoMm.largo,
      `Producto ${tp.codigo}: largo bulto inválido.`
    );
    requirePositive(
      dimBultoMm.ancho,
      `Producto ${tp.codigo}: ancho bulto inválido.`
    );
    requirePositive(
      dimBultoMm.alto,
      `Producto ${tp.codigo}: alto bulto inválido.`
    );

    const pesoPorBulto =
      tp.peso_por_bulto != null ? toNumber(tp.peso_por_bulto) : 0;

    const pesoUnidad =
      it.peso_unidad_kg != null
        ? toNumber(it.peso_unidad_kg)
        : tp.peso_por_unidad_entrega != null
        ? toNumber(tp.peso_por_unidad_entrega)
        : tp.peso_por_unidad_venta != null
        ? toNumber(tp.peso_por_unidad_venta)
        : 0;

    const pesoBultoKg =
      pesoPorBulto > 0
        ? pesoPorBulto
        : Math.max(0, pesoUnidad) * unidadesPorBulto;

    return {
      tipoProductoId: it.tipoProductoId,
      codigo: String(tp.codigo ?? `PROD-${it.tipoProductoId}`),
      descripcion: String(tp.descripcion ?? ""),
      cantidadBultos,
      dimBultoMm,
      pesoBultoKg,
    };
  });

  /* =========================
     🔍 DEBUG ITEMS
  ========================= */

  console.log(
    "EVALUAR_PALLET :: ITEMS",
    items.map((i) => ({
      codigo: i.codigo,
      cantidadBultos: i.cantidadBultos,
      dimBultoMm: i.dimBultoMm,
      pesoBultoKg: i.pesoBultoKg,
    }))
  );

  /* =========================
     6) Calcular plan
  ========================= */
  const parsedObjetivoUnidades =
    objetivoUnidades != null && toNumber(objetivoUnidades) > 0
      ? toNumber(objetivoUnidades)
      : undefined;
  const parsedObjetivoOcupacion =
    objetivoOcupacion != null ? Number(objetivoOcupacion) : undefined;

  if (
    parsedObjetivoOcupacion != null &&
    (parsedObjetivoOcupacion < 0 || parsedObjetivoOcupacion > 1)
  ) {
    throw new Error(
      "El objetivo de ocupación debe ser un número entre 0 y 1 (por ejemplo, 0.85)."
    );
  }

  const plan = calcularPalletPlan({
    contenedor: {
      id: contenedor.id,
      codigo: contenedor.codigo,
      largo_mts: largoM,
      ancho_mts: anchoM,
      alto_mts: altoM,
      peso_pallet_kg: toNumber(contenedor.peso_pallet_kg),
      peso_max_kg: toNumber(contenedor.peso_max_kg),
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

  console.log("EVALUAR_PALLET :: PLAN resumen", {
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
    placementsCount: plan.pallet1.placements?.length,
    palletDimMm: plan.pallet1.palletDimMm,
  });

  /* =========================
     7) Persistir resultado
  ========================= */
  const layoutJson = plan as unknown as Prisma.InputJsonValue;

  const saved = await prisma.cubicacionPalletPlan.upsert({
    where: {
      loteId_tipoContenedorId: { loteId, tipoContenedorId },
    },
    create: {
      loteId,
      tipoContenedorId,
      permitir_mezcla:
        (regla?.permitirMezcla ?? true) && mixPolicy === "PERMITIR_MEZCLA",
      max_codigos_por_pallet: regla?.maxCodigosPorPallet ?? null,
      max_altura_mm: regla?.maxAlturaM
        ? Math.round(Number(regla.maxAlturaM) * 1000)
        : null,
      pallets_necesarios: plan.palletsRequeridos,
      ocupacion_volumen_pct: plan.pallet1.ocupacionVolumenPct,
      peso_total_kg: plan.pallet1.pesoTotalKg,
      altura_utilizada_mm: Math.round(plan.pallet1.alturaTotalM * 1000),
      layout: layoutJson,
    },
    update: {
      permitir_mezcla:
        (regla?.permitirMezcla ?? true) && mixPolicy === "PERMITIR_MEZCLA",
      max_codigos_por_pallet: regla?.maxCodigosPorPallet ?? null,
      max_altura_mm: regla?.maxAlturaM
        ? Math.round(Number(regla.maxAlturaM) * 1000)
        : null,
      pallets_necesarios: plan.palletsRequeridos,
      ocupacion_volumen_pct: plan.pallet1.ocupacionVolumenPct,
      peso_total_kg: plan.pallet1.pesoTotalKg,
      altura_utilizada_mm: Math.round(plan.pallet1.alturaTotalM * 1000),
      layout: layoutJson,
    },
    select: { id: true },
  });

  return { plan, palletPlanId: saved.id };
}
