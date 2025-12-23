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
}) {
  const { empresaId, loteId, tipoContenedorId, mixPolicy, objective } = params;

  // 1) Cargar contenedor + lote
  const [contenedor, lote] = await Promise.all([
    prisma.tipoContenedor.findUnique({ where: { id: tipoContenedorId } }),
    prisma.cubicacionLote.findUnique({
      where: { id: loteId },
      include: {
        bultoEmpresa: true,
        items: { include: { tipoProducto: true } },
      },
    }),
  ]);

  if (!contenedor) throw new Error("Contenedor inexistente.");
  if (!lote) throw new Error("Lote inexistente.");
  if (!lote.items?.length) throw new Error("El lote no tiene ítems.");

  // 2) Validar dimensiones del contenedor (tu schema permite null)
  const largoM = toNumber(contenedor.largo_mts, 0);
  const anchoM = toNumber(contenedor.ancho_mts, 0);
  const altoM = toNumber(contenedor.alto_mts, 0);

  requirePositive(largoM, "El contenedor no tiene largo_mts válido.");
  requirePositive(anchoM, "El contenedor no tiene ancho_mts válido.");
  requirePositive(altoM, "El contenedor no tiene alto_mts válido.");

  // 3) Regla
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  // 4) EMPRESA_BULTO debe existir
  if (lote.tipo_bulto === "EMPRESA_BULTO" && !lote.bultoEmpresa) {
    throw new Error(
      "El lote es EMPRESA_BULTO pero no tiene bultoEmpresa asociado (bulto_empresa_id)."
    );
  }

  // 5) Items
  const items = lote.items.map((it) => {
    const tp = it.tipoProducto;

    const unidades = toNumber(it.cantidad_unidades, 0);
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

    const codigo = String(tp.codigo ?? `PROD-${it.tipoProductoId}`).trim();
    const descripcion = String(tp.descripcion ?? "");

    const dimBultoMm =
      lote.tipo_bulto === "EMPRESA_BULTO"
        ? {
            largo: toNumber(lote.bultoEmpresa!.largo_mm, 0),
            ancho: toNumber(lote.bultoEmpresa!.ancho_mm, 0),
            alto: toNumber(lote.bultoEmpresa!.alto_mm, 0),
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

    const pesoPorBulto =
      tp.peso_por_bulto != null ? toNumber(tp.peso_por_bulto, 0) : 0;

    const pesoUnidad =
      it.peso_unidad_kg != null
        ? toNumber(it.peso_unidad_kg, 0)
        : tp.peso_por_uniad_entrega != null
        ? toNumber(tp.peso_por_uniad_entrega, 0)
        : tp.peso_por_unidad_venta != null
        ? toNumber(tp.peso_por_unidad_venta, 0)
        : 0;

    const pesoBultoKg =
      pesoPorBulto > 0
        ? pesoPorBulto
        : Math.max(0, pesoUnidad) * unidadesPorBulto;

    return {
      tipoProductoId: it.tipoProductoId,
      codigo,
      descripcion,
      cantidadBultos,
      dimBultoMm,
      pesoBultoKg,
    };
  });

  // ✅ Consoles (save)
  console.log("SAVE_PALLET :: LOTE", {
    loteId: lote.id,
    tipo_bulto: lote.tipo_bulto,
    bulto_empresa_id: lote.bulto_empresa_id,
    bultoEmpresa: lote.bultoEmpresa
      ? {
          id: lote.bultoEmpresa.id,
          largo_mm: lote.bultoEmpresa.largo_mm,
          ancho_mm: lote.bultoEmpresa.ancho_mm,
          alto_mm: lote.bultoEmpresa.alto_mm,
        }
      : null,
  });

  console.log(
    "SAVE_PALLET :: ITEMS",
    items.map((x) => ({
      codigo: x.codigo,
      cantidadBultos: x.cantidadBultos,
      dimBultoMm: x.dimBultoMm,
      pesoBultoKg: x.pesoBultoKg,
    }))
  );

  // 6) Calcular
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
  });

  console.log("SAVE_PALLET :: PLAN resumen", {
    palletsRequeridos: plan.palletsRequeridos,
    cajasTotales: plan.pallet1.cajasTotales,
    cajasPorCapa: plan.pallet1.cajasPorCapa,
    capas: plan.pallet1.capas,
    alturaTotalM: plan.pallet1.alturaTotalM,
    pesoTotalKg: plan.pallet1.pesoTotalKg,
    ocupacionBasePct: plan.pallet1.ocupacionBasePct,
    ocupacionVolumenPct: plan.pallet1.ocupacionVolumenPct,
    warnings: plan.pallet1.warnings,
    placementsCount: plan.pallet1.placements?.length ?? 0,
    palletDimMm: plan.pallet1.palletDimMm,
  });

  // 7) Persistir (upsert)
  const maxAlturaMm =
    regla?.maxAlturaM != null
      ? Math.round(Number(regla.maxAlturaM) * 1000)
      : null;

  const permitirMezclaFinal =
    (regla?.permitirMezcla ?? true) && params.mixPolicy === "PERMITIR_MEZCLA";

  console.log(
    "SAVE_PALLET :: placements length",
    plan.pallet1.placements?.length,
    plan.pallet1.placements
  );

  const saved = await prisma.cubicacionPalletPlan.upsert({
    where: {
      // @@unique([loteId, tipoContenedorId], map: "uq_lote_contenedor")
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
