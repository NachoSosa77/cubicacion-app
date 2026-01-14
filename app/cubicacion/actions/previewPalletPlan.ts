"use server";

import { prisma } from "@/lib/prisma";
import { calcularPalletPlan } from "../lib/packing-pallet";

/* =========================
   Types (server-safe)
   (NO import desde BultoPanel: es client)
========================= */

type SourceTag =
  | "SNAPSHOT"
  | "CATALOGO"
  | "MANUAL_GLOBAL"
  | "MANUAL_SKU"
  | "FALLBACK"
  | "BULTO_EMPRESA";

type DimMm = { largo: number; ancho: number; alto: number };

type BultoSimSnapshot = {
  candidateKey: "A" | "B" | "C";
  titulo: string;
  scope?: "LOTE" | "SKU";
  warnings?: string[];
  items: Array<{
    tipo_producto_id: number;
    codigo: string;
    unidades_planificadas: number;
    unidades_por_bulto: number;
    cantidad_bultos: number;
    sobrante_unidades: number;
    dim_bulto_mm?: DimMm | null;
    audit: {
      sourceUnPorBulto: SourceTag;
      sourceDims: SourceTag;
      bultoEmpresaId?: number;
      bultoEmpresaCodigo?: string;
    };
  }>;
  totales: {
    unidades: number;
    bultos: number;
    bultosParciales: number;
  };
};

/* =========================
   Helpers
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

function isValidDimMm(d: { largo: number; ancho: number; alto: number }) {
  return d.largo > 0 && d.ancho > 0 && d.alto > 0;
}

/* =========================
   Main
========================= */

export async function previewPalletPlan(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;
  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
  objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";

  // legacy (tu UI actual)
  objetivoUnidades?: number; // bultos objetivo (según tu UI)
  objetivoOcupacion?: number; // 0..1 (tu UI ya lo manda /100)
  modoSimulacion?: boolean;

  // NUEVO (V2): viene de SimulacionClient cuando aplicás el bulto
  bultoSnapshot?: BultoSimSnapshot;
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
    bultoSnapshot,
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

  // 2) Validar dimensiones del contenedor (pueden venir null)
  const largoM = toNumber(contenedor.largo_mts, 0);
  const anchoM = toNumber(contenedor.ancho_mts, 0);
  const altoM = toNumber(contenedor.alto_mts, 0);

  requirePositive(largoM, "El contenedor no tiene largo_mts válido.");
  requirePositive(anchoM, "El contenedor no tiene ancho_mts válido.");
  requirePositive(altoM, "El contenedor no tiene alto_mts válido.");

  // 3) Regla operativa (ejemplo actual)
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  // 4) Resolver bulto empresa efectivo (si el snapshot eligió otro bulto)
  let bultoEmpresaEf = lote.bulto_empresa ?? null;

  const snapBultoId =
    bultoSnapshot?.items?.find((x) => x.audit?.bultoEmpresaId)?.audit
      ?.bultoEmpresaId ?? null;

  if (lote.tipo_bulto === "EMPRESA_BULTO") {
    if (snapBultoId && (!bultoEmpresaEf || bultoEmpresaEf.id !== snapBultoId)) {
      const b = await prisma.empresaBulto.findFirst({
        where: {
          id: snapBultoId,
          empresa_id: empresaId,
          habilitado: true,
          deleted_at: null,
        },
      });
      if (!b) {
        throw new Error(
          `Snapshot eligió empresa_bulto_id=${snapBultoId} pero no existe / no está habilitado para empresa ${empresaId}.`
        );
      }
      bultoEmpresaEf = b as any;
    }

    if (!bultoEmpresaEf) {
      throw new Error(
        "El lote es EMPRESA_BULTO pero no tiene bulto_empresa asociado (bulto_empresa_id) y el snapshot no proveyó uno válido."
      );
    }
  }

  // 5) Map snapshot por tipo_producto_id (si viene)
  const snapByTipoProd = new Map<number, BultoSimSnapshot["items"][number]>();
  if (bultoSnapshot?.items?.length) {
    for (const s of bultoSnapshot.items)
      snapByTipoProd.set(s.tipo_producto_id, s);
  }

  // 6) Armado de items para el cálculo
  const items = lote.items.map((it) => {
    const tp = it.tipo_producto;
    const codigo = String(tp.codigo ?? `PROD-${it.tipo_producto_id}`).trim();
    const descripcion = String(tp.descripcion ?? "");

    // =========================
    // DEMANDA (unidades)
    // - si hay snapshot aplicado, usamos unidades_planificadas
    // - sino, usamos cantidad_unidades del lote
    // =========================
    const snap = snapByTipoProd.get(it.tipo_producto_id) ?? null;

    const unidades = snap
      ? toNumber(snap.unidades_planificadas, 0)
      : toNumber(it.cantidad_unidades, 0);

    requirePositive(unidades, `Item ${codigo}: cantidad_unidades inválida.`);

    // =========================
    // PACKAGING (unidades por bulto + bultos)
    // - si hay snapshot aplicado, usamos unidades_por_bulto y cantidad_bultos
    // - sino, usamos snapshot DB (it.unidades_por_bulto / it.cantidad_bultos)
    //   y fallback a catálogo
    // =========================
    let unidadesPorBulto: number;
    let cantidadBultos: number;

    if (snap) {
      unidadesPorBulto = Math.max(1, toNumber(snap.unidades_por_bulto, 1));
      cantidadBultos = Math.max(1, toNumber(snap.cantidad_bultos, 1));
    } else {
      const unidadesPorBultoSnapshot =
        it.unidades_por_bulto != null && toNumber(it.unidades_por_bulto, 0) > 0
          ? toNumber(it.unidades_por_bulto, 0)
          : null;

      const unidadesPorBultoFallback = Math.max(
        1,
        toNumber(tp.unidad_entra_por_bulto, 1)
      );

      unidadesPorBulto = unidadesPorBultoSnapshot ?? unidadesPorBultoFallback;

      const cantidadBultosSnapshot =
        it.cantidad_bultos != null && toNumber(it.cantidad_bultos, 0) > 0
          ? toNumber(it.cantidad_bultos, 0)
          : 0;

      cantidadBultos =
        cantidadBultosSnapshot > 0
          ? cantidadBultosSnapshot
          : ceilDiv(unidades, unidadesPorBulto);

      requirePositive(
        cantidadBultos,
        `Item ${codigo}: no se pudo determinar cantidad_bultos.`
      );
    }

    // =========================
    // DIM BULT0
    // - EMPRESA_BULTO: del bulto empresa efectivo (snapshot puede cambiar bulto)
    // - PRODUCTO_ESTANDAR: del catálogo del producto
    // =========================
    const dimBultoMm =
      lote.tipo_bulto === "EMPRESA_BULTO"
        ? {
            largo: toNumber((bultoEmpresaEf as any)!.largo_mm, 0),
            ancho: toNumber((bultoEmpresaEf as any)!.ancho_mm, 0),
            alto: toNumber((bultoEmpresaEf as any)!.alto_mm, 0),
          }
        : {
            largo: toNumber(tp.largo_por_bulto, 0),
            ancho: toNumber(tp.ancho_por_bulto, 0),
            alto: toNumber(tp.alto_por_bulto, 0),
          };

    if (!isValidDimMm(dimBultoMm)) {
      throw new Error(
        `El producto ${codigo} no tiene dimensiones de bulto válidas.`
      );
    }

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
      tipoProductoId: it.tipo_producto_id,
      codigo,
      descripcion,
      cantidadBultos,
      dimBultoMm,
      pesoBultoKg,
    };
  });

  // 7) Objetivos (legacy)
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

  // 8) Supply de bultos: para V2 tomamos el supply del snapshot aplicado (items)
  // (si no hay snapshot, queda igual que antes: sumatoria por items; lote.bultos_totales puede ser viejo)
  const bultosFromItems = items.reduce(
    (acc, it) => acc + toNumber(it.cantidadBultos, 0),
    0
  );
  const bultosFromLote = toNumber(lote.bultos_totales, 0);

  // Preferimos items (porque representa lo que vamos a colocar), y dejamos lote como fallback.
  const bultosDisponibles =
    bultosFromItems > 0 ? bultosFromItems : bultosFromLote;

  if (bultosDisponibles <= 0) {
    throw new Error("No se pudo determinar bultosDisponibles del lote.");
  }

  // Objetivo efectivo: nunca puede superar el supply
  const objetivoUnidadesEfectivo = Math.min(
    parsedObjetivoUnidades ?? bultosDisponibles,
    bultosDisponibles
  );

  // Modo simulación efectivo:
  // - si tu UI lo manda, lo respetamos
  // - si NO lo manda, igual lo activamos para aplicar límite duro de supply (lo que venís usando)
  const modoSimulacionEfectivo = modoSimulacion ?? true;

  // ✅ Consoles (preview)
  console.log("PREVIEW_PALLET :: LOTE", {
    loteId: lote.id,
    tipo_bulto: lote.tipo_bulto,
    bulto_empresa_id: lote.bulto_empresa_id,
    bulto_empresa_ef: bultoEmpresaEf
      ? {
          id: (bultoEmpresaEf as any).id,
          codigo: (bultoEmpresaEf as any).codigo,
          largo_mm: (bultoEmpresaEf as any).largo_mm,
          ancho_mm: (bultoEmpresaEf as any).ancho_mm,
          alto_mm: (bultoEmpresaEf as any).alto_mm,
        }
      : null,
    snapshot_aplicado: bultoSnapshot
      ? {
          candidateKey: bultoSnapshot.candidateKey,
          titulo: bultoSnapshot.titulo,
          totales: bultoSnapshot.totales,
        }
      : null,
    supply: {
      bultosFromItems,
      bultosFromLote,
      bultosDisponibles,
      parsedObjetivoUnidades,
      objetivoUnidadesEfectivo,
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

  // 9) Calcular plan
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

    // objetivos + modo simulación (limitador de supply)
    objetivoUnidades: objetivoUnidadesEfectivo,
    objetivoOcupacion: parsedObjetivoOcupacion,
    modoSimulacion: modoSimulacionEfectivo,

    // (opcional) referencias para debugging: si tu motor ya lo devuelve, genial.
    // Si no, no pasa nada.
  });

  return { plan };
}
