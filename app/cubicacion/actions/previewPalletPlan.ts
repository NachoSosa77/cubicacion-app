"use server";

import { prisma } from "@/lib/prisma";
import { calcularPalletPlan } from "../lib/packing-pallet";

/* =========================
   Types (server-safe)
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
  candidateKey: "A" | "B" | "C" | "D";
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

function dimFromAny(v: any): DimMm | null {
  if (!v) return null;
  const d = {
    largo: toNumber(v.largo ?? v.largo_mm ?? v.l, 0),
    ancho: toNumber(v.ancho ?? v.ancho_mm ?? v.a, 0),
    alto: toNumber(v.alto ?? v.alto_mm ?? v.h, 0),
  };
  return isValidDimMm(d) ? d : null;
}

/* =========================
   Main
========================= */

export async function previewPalletPlan(params: {
  empresaId: number;
  loteId: number;
  tipoContenedorId: number;

  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";

  // ✅ Nuevo: solo 2 modos
  objective: "OPERATIVO_ESTABLE" | "OPERATIVO_PARAMETRIZABLE";

  // ✅ Feature independiente del objective
  rotacion2D?: "ON" | "OFF";

  // ✅ PRO: parámetros opcionales (solo si objective=OPERATIVO_PARAMETRIZABLE)
  parametros?: {
    // ✅ NUEVOS NOMBRES (como en el client)
    bultosSimulados?: number | null; // permite pasar MÁS que el supply para stress-test
    capasMaxOverride?: number | null; // límite de capas deseado (además de altura/peso)
    objetivoOcupacion01?: number | null; // 0..1
    apilableOverride?: boolean | null; // false => forzar NO apilable (max 1 capa)
  } | null;

  // legacy — compat
  objetivoUnidades?: number; // bultos
  objetivoOcupacion?: number; // 0..1
  modoSimulacion?: boolean;

  // V2 snapshot aplicado desde simulación de bulto
  bultoSnapshot?: BultoSimSnapshot;
}) {
  const {
    empresaId,
    loteId,
    tipoContenedorId,
    mixPolicy,
    objective,
    rotacion2D,
    parametros,
    objetivoUnidades,
    objetivoOcupacion,
    modoSimulacion,
    bultoSnapshot,
  } = params;

  // 1) Cargar contenedor + lote
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

  // 3) Regla operativa (global)
  const regla = await prisma.cubicacionRegla.findFirst({
    where: {
      empresaId,
      tipoContenedorId: contenedor.id,
      tipoProductoId: null,
      transporteClasificacionId: null,
    },
    orderBy: { id: "desc" },
  });

  // 4) Resolver bulto empresa efectivo (si EMPRESA_BULTO)
  let bultoEmpresaEf = lote.bulto_empresa ?? null;

  const snapBultoIds = new Set<number>();
  for (const s of bultoSnapshot?.items ?? []) {
    const id = s.audit?.bultoEmpresaId;
    if (typeof id === "number" && Number.isFinite(id) && id > 0)
      snapBultoIds.add(id);
  }

  const snapBultoId =
    snapBultoIds.size === 1 ? Array.from(snapBultoIds)[0] : null;

  if ((lote as any).tipo_bulto === "EMPRESA_BULTO") {
    if (snapBultoIds.size > 1) {
      throw new Error(
        `Snapshot trae múltiples bultoEmpresaId (${Array.from(
          snapBultoIds,
        ).join(",")}). En modo EMPRESA_BULTO operamos con 1 solo bulto global.`,
      );
    }

    if (
      snapBultoId &&
      (!bultoEmpresaEf || (bultoEmpresaEf as any).id !== snapBultoId)
    ) {
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
          `Snapshot eligió empresa_bulto_id=${snapBultoId} pero no existe / no está habilitado para empresa ${empresaId}.`,
        );
      }

      bultoEmpresaEf = b as any;
    }

    if (!bultoEmpresaEf) {
      throw new Error(
        "El lote es EMPRESA_BULTO pero no tiene bulto_empresa asociado y el snapshot no proveyó uno válido.",
      );
    }
  }

  // 5) Map snapshot por tipo_producto_id
  const snapByTipoProd = new Map<number, BultoSimSnapshot["items"][number]>();
  if (bultoSnapshot?.items?.length) {
    for (const s of bultoSnapshot.items)
      snapByTipoProd.set(s.tipo_producto_id, s);
  }

  // 6) Armado de items
  const items = lote.items.map((it) => {
    const tp = it.tipo_producto;

    const codigo = String(tp.codigo ?? `PROD-${it.tipo_producto_id}`).trim();
    const descripcion = String(tp.descripcion ?? "");

    const snap = snapByTipoProd.get(it.tipo_producto_id) ?? null;

    // DEMANDA
    const unidades = snap
      ? toNumber(snap.unidades_planificadas, 0)
      : toNumber((it as any).cantidad_unidades, 0);

    requirePositive(unidades, `Item ${codigo}: cantidad_unidades inválida.`);

    // PACKAGING
    let unidadesPorBulto: number;
    let cantidadBultos: number;

    if (snap) {
      unidadesPorBulto = Math.max(1, toNumber(snap.unidades_por_bulto, 1));
      cantidadBultos = Math.max(1, toNumber(snap.cantidad_bultos, 1));
    } else {
      const unidadesPorBultoSnapshot =
        (it as any).unidades_por_bulto != null &&
        toNumber((it as any).unidades_por_bulto, 0) > 0
          ? toNumber((it as any).unidades_por_bulto, 0)
          : null;

      const unidadesPorBultoFallback = Math.max(
        1,
        toNumber((tp as any).unidad_entra_por_bulto, 1),
      );
      unidadesPorBulto = unidadesPorBultoSnapshot ?? unidadesPorBultoFallback;

      const cantidadBultosSnapshot =
        (it as any).cantidad_bultos != null &&
        toNumber((it as any).cantidad_bultos, 0) > 0
          ? toNumber((it as any).cantidad_bultos, 0)
          : 0;

      cantidadBultos =
        cantidadBultosSnapshot > 0
          ? cantidadBultosSnapshot
          : ceilDiv(unidades, unidadesPorBulto);

      requirePositive(
        cantidadBultos,
        `Item ${codigo}: no se pudo determinar cantidad_bultos.`,
      );
    }

    // DIM BULTO (regla profesional)
    const dimSnap = dimFromAny(snap?.dim_bulto_mm);
    const dimDb = dimFromAny((it as any).dim_bulto_mm);

    const dimFromEmpresa =
      (lote as any).tipo_bulto === "EMPRESA_BULTO"
        ? {
            largo: toNumber((bultoEmpresaEf as any)!.largo_mm, 0),
            ancho: toNumber((bultoEmpresaEf as any)!.ancho_mm, 0),
            alto: toNumber((bultoEmpresaEf as any)!.alto_mm, 0),
          }
        : null;

    const dimFromCatalogo =
      (lote as any).tipo_bulto !== "EMPRESA_BULTO"
        ? {
            largo: toNumber((tp as any).largo_por_bulto, 0),
            ancho: toNumber((tp as any).ancho_por_bulto, 0),
            alto: toNumber((tp as any).alto_por_bulto, 0),
          }
        : null;

    const dimBultoMm: DimMm | null =
      (lote as any).tipo_bulto === "EMPRESA_BULTO"
        ? dimFromEmpresa && isValidDimMm(dimFromEmpresa)
          ? dimFromEmpresa
          : null
        : (dimSnap ??
          dimDb ??
          (dimFromCatalogo && isValidDimMm(dimFromCatalogo)
            ? dimFromCatalogo
            : null));

    if (!dimBultoMm || !isValidDimMm(dimBultoMm)) {
      throw new Error(
        `El producto ${codigo} no tiene dimensiones de bulto válidas.`,
      );
    }

    // PESO
    const pesoPorBulto =
      (tp as any).peso_por_bulto != null
        ? toNumber((tp as any).peso_por_bulto, 0)
        : 0;

    const pesoUnidad =
      (it as any).peso_unidad_kg != null
        ? toNumber((it as any).peso_unidad_kg, 0)
        : (tp as any).peso_por_unidad_entrega != null
          ? toNumber((tp as any).peso_por_unidad_entrega, 0)
          : (tp as any).peso_por_unidad_venta != null
            ? toNumber((tp as any).peso_por_unidad_venta, 0)
            : 0;

    const pesoBultoKg =
      pesoPorBulto > 0
        ? pesoPorBulto
        : Math.max(0, pesoUnidad) * unidadesPorBulto;

    // ✅ apilable robusto (tinyint 0/1)
    const apilable = Boolean((tp as any).apilable);

    return {
      tipoProductoId: it.tipo_producto_id,
      codigo,
      descripcion,
      cantidadBultos,
      dimBultoMm,
      pesoBultoKg,
      apilable,
    };
  });

  // 7) Supply real (preferimos items)
  const bultosFromItems = items.reduce(
    (acc, it) => acc + toNumber(it.cantidadBultos, 0),
    0,
  );
  const bultosFromLote = toNumber((lote as any).bultos_totales, 0);

  const bultosDisponibles =
    bultosFromItems > 0 ? bultosFromItems : bultosFromLote;

  if (bultosDisponibles <= 0) {
    throw new Error("No se pudo determinar bultosDisponibles del lote.");
  }

  // 8) Objetivos: prioridad PRO > legacy > supply
  //    ✅ PRO: bultosSimulados NO clampa contra supply (sirve para stress-test/capacidad)
  const legacyObjetivoUnidades =
    objetivoUnidades != null && toNumber(objetivoUnidades, 0) > 0
      ? toNumber(objetivoUnidades, 0)
      : null;

  const proBultosSimulados =
    parametros?.bultosSimulados != null &&
    toNumber(parametros.bultosSimulados, 0) > 0
      ? toNumber(parametros.bultosSimulados, 0)
      : null;

  const objetivoUnidadesEfectivo =
    proBultosSimulados ?? legacyObjetivoUnidades ?? bultosDisponibles;

  // ocupación 0..1: prioridad PRO > legacy
  const legacyObjOcup =
    objetivoOcupacion != null ? Number(objetivoOcupacion) : null;

  const proObjOcup =
    parametros?.objetivoOcupacion01 != null
      ? Number(parametros.objetivoOcupacion01)
      : null;

  const objetivoOcupacion01Efectivo = proObjOcup ?? legacyObjOcup ?? undefined;

  if (
    objetivoOcupacion01Efectivo != null &&
    (objetivoOcupacion01Efectivo < 0 || objetivoOcupacion01Efectivo > 1)
  ) {
    throw new Error(
      "El objetivo de ocupación debe estar entre 0 y 1 (ej: 0.50).",
    );
  }

  // ✅ rotación 2D default profesional:
  // - OPERATIVO_ESTABLE: OFF sí o sí
  // - PARAM: respeta lo que venga (default OFF)
  const rotacion2DEfectiva: "ON" | "OFF" =
    objective === "OPERATIVO_ESTABLE" ? "OFF" : (rotacion2D ?? "OFF");

  // ✅ modo simulación:
  // - si el usuario pidió bultosSimulados, es claramente un stress-test => true
  const modoSimulacionEfectivo =
    proBultosSimulados != null ? true : (modoSimulacion ?? true);

  // ✅ parámetros PRO que realmente usa el motor
  //    OJO: el motor hoy consume `limiteCapas`, así que mapeamos capasMaxOverride -> limiteCapas
  const apilableOverride =
    typeof parametros?.apilableOverride === "boolean"
      ? parametros.apilableOverride
      : null;

  const proCapasMaxOverride =
    parametros?.capasMaxOverride != null &&
    toNumber(parametros.capasMaxOverride, 0) > 0
      ? Math.floor(toNumber(parametros.capasMaxOverride, 0))
      : null;

  // Si forzás NO apilable, coherentemente 1 capa
  const limiteCapasEfectivo =
    apilableOverride === false ? 1 : proCapasMaxOverride;

  const parametrosMotor =
    objective === "OPERATIVO_PARAMETRIZABLE"
      ? {
          limiteCapas: limiteCapasEfectivo,
          objetivoOcupacion01: objetivoOcupacion01Efectivo ?? null,
          apilableOverride,
        }
      : null;

  // ✅ MixPolicy efectiva (regla profesional)
  // En OPERATIVO_ESTABLE con múltiples SKUs, no permitimos mezcla.
  const multiSku = items.filter((x) => x.cantidadBultos > 0).length > 1;

  const mixPolicyEfectiva: "NO_MEZCLAR" | "PERMITIR_MEZCLA" =
    objective === "OPERATIVO_ESTABLE" && multiSku ? "NO_MEZCLAR" : mixPolicy;

  console.log("PREVIEW_PALLET :: LOTE", {
    loteId: lote.id,
    tipo_bulto: (lote as any).tipo_bulto,
    bulto_empresa_id: (lote as any).bulto_empresa_id,
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
      objetivoUnidadesEfectivo,
      modoSimulacionEfectivo,
      objective,
      rotacion2DEfectiva,
      parametrosMotor,
    },
    parametrosInput: parametros ?? null,
    mixPolicyInput: mixPolicy,
    mixPolicyEfectiva,
    multiSku,
  });

  console.log(
    "PREVIEW_PALLET :: ITEMS",
    items.map((x) => ({
      codigo: x.codigo,
      cantidadBultos: x.cantidadBultos,
      dimBultoMm: x.dimBultoMm,
      pesoBultoKg: x.pesoBultoKg,
      apilable: x.apilable,
    })),
  );

  const motivoMix = !multiSku
    ? "SINGLE_SKU"
    : objective === "OPERATIVO_ESTABLE"
      ? "OPERATIVO_ESTABLE_FORCE_NO_MEZCLAR"
      : "RESPETA_INPUT";

  console.log("PREVIEW_PALLET :: MIX", {
    mixPolicyInput: mixPolicy,
    mixPolicyEfectiva,
    multiSku,
    motivoMix,
    reglaPermitirMezcla: regla?.permitirMezcla ?? null,
    maxCodigosPorPallet: (regla as any)?.maxCodigosPorPallet ?? null,
  });

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
          maxAlturaM: (regla as any).maxAlturaM
            ? Number((regla as any).maxAlturaM)
            : null,
          maxCodigosPorPallet: (regla as any).maxCodigosPorPallet ?? null,
          permitirMezcla: (regla as any).permitirMezcla,
        }
      : null,
    mixPolicy: mixPolicyEfectiva,
    objective,
    rotacion2D: rotacion2DEfectiva,
    parametros: parametrosMotor,
    items,

    // legacy (el motor lo usa para cortes)
    objetivoUnidades: objetivoUnidadesEfectivo,
    objetivoOcupacion: objetivoOcupacion01Efectivo,
    modoSimulacion: modoSimulacionEfectivo,
  });

  return { plan };
}
