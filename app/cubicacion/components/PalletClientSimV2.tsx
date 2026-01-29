"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

// server actions
import { guardarPalletPlan } from "../actions/guardarPalletPlan";
import { previewPalletPlan } from "../actions/previewPalletPlan";
import { BultoSimSnapshot } from "../simulacion/types/types";
import { CubicacionPalletViewer3D } from "./CubicacionPalletViewer3D";

/* =========================
   Types (plain, client-safe)
========================= */

type DimMm = { largo: number; ancho: number; alto: number };

type Placement = {
  tipoProductoId: number;
  codigo: string;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  capa: number;
};

type PalletPlanResult = {
  palletsRequeridos: number;
  pallet1: {
    cajasTotales: number;
    unidadesColocadas: number;
    cajasPorCapa: number;
    capas: number;
    ocupacionBasePct: number;
    ocupacionVolumenPct: number;
    ocupacionLogradaPct: number;
    volumenLibreMm3: number;
    pesoTotalKg: number;
    alturaTotalM: number;
    warnings: string[];
    placements: Placement[];
    palletDimMm: DimMm;
    referencias?: {
      alturaFisicaMm: number;
      alturaUtilMm: number;
      alturaUsadaMm: number;
      volumenMaxMm3: number;
      volumenUsadoAlturaMm3: number;
      volumenCajasMm3: number;
      objetivoOcupacion01?: number | null;
      objetivoUnidades?: number | null;
      modoSimulacion?: boolean;
      rotacion2D?: "ON" | "OFF";
      orientacionElegida?: "NORMAL" | "ROTADA";
    };
  };
};

type ClientContenedor = {
  id: number;
  codigo: string;
  descripcion: string;
  largo_mts: number | null;
  ancho_mts: number | null;
  alto_mts: number | null;
  peso_max_kg: number | null;
  peso_pallet_kg?: number | null;
};

type ClientLote = {
  id: number;
  descripcion?: string | null;

  unidades_totales: number;
  bultos_totales: number;

  packing_policy:
  | "OPERATIVO_AGRUPADO"
  | "OPTIMIZAR_VOLUMEN"
  | "BUSCAR_MEJOR_ACOMODO";
  tipo_bulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bulto_empresa_id?: number | null;

  bulto_layout?: any | null;

  items: Array<{
    id: number;
    tipo_producto_id: number;

    cantidad_unidades: number;
    cantidad_bultos: number;
    unidades_por_bulto?: number | null;

    volumen_total_m3: number;

    dim_unidad_mm?: any | null;
    peso_unidad_kg?: number | null;

    tipo_producto: {
      id: number;
      codigo: string;
      descripcion: string;

      unidad_entra_por_bulto: number;
      largo_por_bulto: number;
      ancho_por_bulto: number;
      alto_por_bulto: number;
    };
  }>;
};

type MixPolicy = "NO_MEZCLAR" | "PERMITIR_MEZCLA";
type Objective = "OPERATIVO_ESTABLE" | "OPERATIVO_PARAMETRIZABLE";
type Rotacion2D = "ON" | "OFF";

type PalletParametros = {
  // ✅ PRO: stress test y override
  bultosSimulados?: number | null; // objetivo de bultos a intentar colocar (puede ser > lote real)
  capasMaxOverride?: number | null; // máximo de capas permitido (además de altura/peso)
  objetivoOcupacion01?: number | null; // 0..1 (opcional)
  apilableOverride?: boolean | null; // false => NO apilable
} | null;

interface Props {
  empresaId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
  bultoSnap: BultoSimSnapshot | null;
  onSaved?: (palletPlanId: number) => void;
}

/* =========================
   Helpers
========================= */

function safeNumber(n: unknown, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function ceilDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.ceil(a / b);
}

function formatDimMm(d: { largo: number; ancho: number; alto: number }) {
  return `${d.largo}×${d.ancho}×${d.alto} mm`;
}

function formatVolumenMm3ToM3(volumenMm3: number) {
  return `${(volumenMm3 / 1_000_000_000).toFixed(3)} m³`;
}

function tryDimMm(v: any): DimMm | null {
  if (!v) return null;
  const largo = safeNumber(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = safeNumber(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = safeNumber(v.alto ?? v.alto_mm ?? v.h, 0);
  if (largo > 0 && ancho > 0 && alto > 0) return { largo, ancho, alto };
  return null;
}

/* =========================
   Component
========================= */

export function PalletClientSimV2({
  empresaId,
  lote,
  contenedores,
  bultoSnap,
  onSaved,
}: Props) {
  const router = useRouter();

  const [tipoContenedorId, setTipoContenedorId] = useState<number | "">("");
  const [mixPolicy, setMixPolicy] = useState<MixPolicy>("PERMITIR_MEZCLA");
  const [objective, setObjective] = useState<Objective>("OPERATIVO_ESTABLE");
  const [rotacion2D, setRotacion2D] = useState<Rotacion2D>("OFF");

  // ✅ PRO (solo si objective=OPERATIVO_PARAMETRIZABLE)
  const [proBultosSimulados, setProBultosSimulados] = useState<string>(""); // objetivo bultos a intentar
  const [proCapasMaxOverride, setProCapasMaxOverride] = useState<string>(""); // máximo capas permitido
  const [proObjetivoOcupacion, setProObjetivoOcupacion] = useState<string>(""); // 0..1
  const [proApilableOverride, setProApilableOverride] = useState<
    "AUTO" | "NO_APILABLE"
  >("AUTO");

  const [result, setResult] = useState<PalletPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPendingPreview, startPreview] = useTransition();
  const [isPendingSave, startSave] = useTransition();
  const [savedId, setSavedId] = useState<number | null>(null);

  const multiSku = useMemo(() => (lote.items?.length ?? 0) > 1, [lote.items]);

  const forceNoMezclar = useMemo(() => {
    return objective === "OPERATIVO_ESTABLE" && multiSku;
  }, [objective, multiSku]);

  const mixPolicyEfectiva: MixPolicy = forceNoMezclar ? "NO_MEZCLAR" : mixPolicy;

  const contenedorSeleccionado = useMemo(() => {
    if (!tipoContenedorId) return null;
    return contenedores.find((c) => c.id === tipoContenedorId) ?? null;
  }, [tipoContenedorId, contenedores]);

  const proRefs = useMemo(() => {
    if (!result) return null;

    const pallet = result.pallet1.palletDimMm;
    const sampleDim = result.pallet1.placements?.[0]?.dimMm ?? null;

    const nx =
      sampleDim && sampleDim.largo > 0
        ? Math.floor(pallet.largo / sampleDim.largo)
        : 0;

    const nz =
      sampleDim && sampleDim.ancho > 0
        ? Math.floor(pallet.ancho / sampleDim.ancho)
        : 0;

    const capTeorica = Math.max(0, nx * nz);

    const sobraXmm =
      sampleDim && sampleDim.largo > 0
        ? pallet.largo - nx * sampleDim.largo
        : null;

    const sobraZmm =
      sampleDim && sampleDim.ancho > 0
        ? pallet.ancho - nz * sampleDim.ancho
        : null;

    return {
      pallet,
      sampleDim,
      nx,
      nz,
      capTeorica,
      sobraXmm,
      sobraZmm,
      isEmpresaBulto: lote.tipo_bulto === "EMPRESA_BULTO",
      labelUnidad: lote.tipo_bulto === "EMPRESA_BULTO" ? "bultos" : "cajas",
    };
  }, [result, lote.tipo_bulto]);

  const loteResumen = useMemo(() => {
    return lote.items.map((it) => {
      const unPorBultoSnapshot =
        it.unidades_por_bulto != null && Number(it.unidades_por_bulto) > 0
          ? Number(it.unidades_por_bulto)
          : null;

      const unPorBultoFallback = safeNumber(it.tipo_producto.unidad_entra_por_bulto, 0);
      const unPorBulto = unPorBultoSnapshot ?? unPorBultoFallback;

      const bultosSnapshot = safeNumber(it.cantidad_bultos, 0);

      const bultosEstimados =
        bultosSnapshot > 0
          ? bultosSnapshot
          : unPorBulto > 0
            ? ceilDiv(it.cantidad_unidades, unPorBulto)
            : 0;

      const dimBultoStd =
        lote.tipo_bulto === "PRODUCTO_ESTANDAR"
          ? {
            largo: safeNumber(it.tipo_producto.largo_por_bulto, 0),
            ancho: safeNumber(it.tipo_producto.ancho_por_bulto, 0),
            alto: safeNumber(it.tipo_producto.alto_por_bulto, 0),
          }
          : null;

      const dimUnidad = tryDimMm(it.dim_unidad_mm);

      const snapshotOk =
        bultosSnapshot > 0 || unPorBultoSnapshot != null || dimUnidad != null;

      return {
        id: it.id,
        codigo: it.tipo_producto.codigo,
        descripcion: it.tipo_producto.descripcion,
        cantidadUnidades: it.cantidad_unidades,
        unPorBulto,
        bultosEstimados,
        volumenTotalM3: it.volumen_total_m3,
        dimBultoStd,
        dimUnidad,
        snapshotOk,
      };
    });
  }, [lote.items, lote.tipo_bulto]);

  useEffect(() => {
    if (forceNoMezclar && mixPolicy !== "NO_MEZCLAR") {
      setMixPolicy("NO_MEZCLAR");
    }
  }, [forceNoMezclar, mixPolicy]);

  /* =========================
     Validación común
  ========================= */

  const validateForm = () => {
    setError(null);
    setSavedId(null);

    if (!tipoContenedorId) {
      setError("Seleccioná un tipo de pallet / contenedor.");
      return null;
    }

    const c = contenedorSeleccionado;
    if (!c) {
      setError("Contenedor inválido.");
      return null;
    }

    if (!c.largo_mts || !c.ancho_mts || !c.alto_mts) {
      setError(
        "El contenedor seleccionado no tiene dimensiones completas (largo/ancho/alto). Completá esos datos para poder calcular."
      );
      return null;
    }

    // =========================
    // PRO: parseo parámetros
    // =========================
    const isPro = objective === "OPERATIVO_PARAMETRIZABLE";

    const parsedBultosSimulados =
      isPro && proBultosSimulados.trim() !== "" && safeNumber(proBultosSimulados, 0) > 0
        ? Math.floor(safeNumber(proBultosSimulados, 0))
        : null;

    const parsedCapasMaxOverride =
      isPro && proCapasMaxOverride.trim() !== "" && safeNumber(proCapasMaxOverride, 0) > 0
        ? Math.floor(safeNumber(proCapasMaxOverride, 0))
        : null;

    const parsedObjetivoOcupacion01 =
      isPro && proObjetivoOcupacion.trim() !== ""
        ? safeNumber(proObjetivoOcupacion, NaN)
        : null;

    if (parsedObjetivoOcupacion01 != null) {
      if (
        !Number.isFinite(parsedObjetivoOcupacion01) ||
        parsedObjetivoOcupacion01 < 0 ||
        parsedObjetivoOcupacion01 > 1
      ) {
        setError("En modo PRO, el objetivo de ocupación debe estar entre 0 y 1 (ej: 0.50).");
        return null;
      }
    }

    const apilableOverride: boolean | null =
      isPro && proApilableOverride === "NO_APILABLE" ? false : null;

    // Si forzás NO apilable, 1 capa es la única opción coherente
    const capasMaxOverrideEfectiva =
      apilableOverride === false ? 1 : parsedCapasMaxOverride;

    const parametros: PalletParametros =
      isPro
        ? {
          bultosSimulados: parsedBultosSimulados,
          capasMaxOverride: capasMaxOverrideEfectiva,
          objetivoOcupacion01: parsedObjetivoOcupacion01,
          apilableOverride,
        }
        : null;

    // En operativo estable: rotación OFF sí o sí
    const rotacion2DEfectiva: Rotacion2D =
      objective === "OPERATIVO_ESTABLE" ? "OFF" : rotacion2D;

    return {
      empresaId,
      loteId: lote.id,
      tipoContenedorId: Number(tipoContenedorId),
      mixPolicy: mixPolicyEfectiva,
      objective,
      rotacion2D: rotacion2DEfectiva,
      parametros: parametros ?? undefined,
      bultoSnapshot: bultoSnap ?? undefined,
    };
  };

  /* =========================
     Handlers
  ========================= */

  const handlePreview = () => {
    const form = validateForm();
    if (!form) return;

    setResult(null);

    startPreview(async () => {
      try {
        const res = await previewPalletPlan(form);
        setResult(res.plan);
      } catch (e) {
        console.error(e);
        setError("No se pudo calcular la cubicación en pallet.");
      }
    });
  };

  const handleGuardar = () => {
    const form = validateForm();
    if (!form) return;

    if (!result) {
      setError("Primero previsualizá el layout antes de guardar.");
      return;
    }

    startSave(async () => {
      try {
        const res = await guardarPalletPlan({
          ...form,
          plan: result,
        });

        setSavedId(res.palletPlanId);
        onSaved?.(res.palletPlanId);
        router.refresh();
      } catch (e) {
        console.error(e);
        setError("No se pudo guardar el plan de pallet.");
      }
    });
  };

  const handleCompareMix = () => {
    const form = validateForm();
    if (!form) return;

    startPreview(async () => {
      try {
        const offRes = await previewPalletPlan({
          ...form,
          mixPolicy: "NO_MEZCLAR",
        });
        const onRes = await previewPalletPlan({
          ...form,
          mixPolicy: "PERMITIR_MEZCLA",
        });

        const best =
          (onRes.plan.pallet1.ocupacionLogradaPct ?? 0) >=
            (offRes.plan.pallet1.ocupacionLogradaPct ?? 0)
            ? onRes.plan
            : offRes.plan;

        setResult(best);
      } catch (e) {
        console.error(e);
        setError("No se pudo comparar mezcla ON vs OFF.");
      }
    });
  };

  function pill(text: string) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm">
        {text}
      </span>
    );
  }

  function optionCard(args: {
    title: string;
    desc: string;
    active: boolean;
    onClick: () => void;
    badge?: string;
  }) {
    const { title, desc, active, onClick, badge } = args;
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "w-full text-left rounded-lg border p-3 transition",
          active
            ? "border-indigo-300 bg-indigo-50"
            : "border-slate-200 bg-white hover:bg-slate-50",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-xs text-slate-600">{desc}</p>
          </div>

          {badge ? (
            <span
              className={[
                "text-[11px] px-2 py-0.5 rounded-full border",
                active
                  ? "bg-white border-indigo-200 text-indigo-700"
                  : "bg-white border-slate-200 text-slate-700",
              ].join(" ")}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </button>
    );
  }

  /* =========================
     Render
  ========================= */

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Columna izquierda: Config */}
      <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Configuración
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Elegí contenedor, reglas de mezcla y el objetivo del cálculo.
            </p>
          </div>

          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
            Pallet
          </span>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {pill(`Lote #${lote.id}`)}
          {pill(`Demanda: ${safeNumber(lote.unidades_totales, 0)} un`)}
          {pill(`${safeNumber(lote.bultos_totales, 0)} bultos`)}
          {bultoSnap?.candidateKey
            ? pill(`Bulto elegido: ${bultoSnap.candidateKey}`)
            : pill("Bulto: sin aplicar")}
        </div>

        {/* Objetivo (cards) */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">
            Modo de cubicación
          </label>

          <div className="grid gap-2">
            {optionCard({
              title: "Operativo / estable (recomendado)",
              desc: "Consistente para operación diaria. Sin parámetros PRO.",
              active: objective === "OPERATIVO_ESTABLE",
              onClick: () => setObjective("OPERATIVO_ESTABLE"),
              badge: objective === "OPERATIVO_ESTABLE" ? "Seleccionado" : "Elegir",
            })}

            {optionCard({
              title: "Operativo parametrizable (PRO)",
              desc: "Permite simular más bultos, limitar capas máximas y definir objetivo de ocupación.",
              active: objective === "OPERATIVO_PARAMETRIZABLE",
              onClick: () => setObjective("OPERATIVO_PARAMETRIZABLE"),
              badge:
                objective === "OPERATIVO_PARAMETRIZABLE" ? "Seleccionado" : "Elegir",
            })}
          </div>

          {/* Rotación 2D */}
          <div className="mt-2 rounded-lg border bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Rotación 2D</p>
                <p className="text-xs text-slate-500">
                  Permite rotar base largo/ancho para mejorar la grilla (si ayuda).
                </p>
              </div>

              <button
                type="button"
                disabled={objective === "OPERATIVO_ESTABLE"}
                onClick={() => setRotacion2D((v) => (v === "ON" ? "OFF" : "ON"))}
                className={[
                  "text-xs px-3 py-2 rounded-md border bg-white",
                  objective === "OPERATIVO_ESTABLE"
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-slate-50",
                ].join(" ")}
              >
                {objective === "OPERATIVO_ESTABLE" ? "OFF (fijo)" : rotacion2D}
              </button>
            </div>
          </div>

          {/* Panel PRO */}
          {objective === "OPERATIVO_PARAMETRIZABLE" && (
            <div className="rounded-lg border bg-white p-3 space-y-3">
              <p className="text-sm font-semibold text-slate-800">Parámetros PRO</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Bultos a simular (opcional)
                  </label>
                  <input
                    value={proBultosSimulados}
                    onChange={(e) => setProBultosSimulados(e.target.value)}
                    inputMode="numeric"
                    placeholder={`Ej: ${Math.max(1, safeNumber(lote.bultos_totales, 0) * 2)}`}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Stress test: el motor intenta colocar hasta esa cantidad (puede ser mayor que el lote real).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Capas máximas (override) (opcional)
                  </label>
                  <input
                    value={proCapasMaxOverride}
                    onChange={(e) => setProCapasMaxOverride(e.target.value)}
                    inputMode="numeric"
                    placeholder="Ej: 1, 2, 3..."
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tope de capas permitido. Igual se respetan altura útil y peso máximo.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Objetivo ocupación (0..1) (opcional)
                  </label>
                  <input
                    value={proObjetivoOcupacion}
                    onChange={(e) => setProObjetivoOcupacion(e.target.value)}
                    inputMode="decimal"
                    placeholder="Ej: 0.50"
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Ejemplo: 0.50 = 50% del volumen máximo del pallet.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Apilable (override)
                  </label>
                  <select
                    value={proApilableOverride}
                    onChange={(e) => setProApilableOverride(e.target.value as any)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="AUTO">Auto (según catálogo)</option>
                    <option value="NO_APILABLE">Forzar NO apilable (1 capa)</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Si forzás NO apilable, el motor limita a 1 capa.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>




        {/* Configuración (selects + acciones) */}
        <div className="rounded-lg border bg-white p-3 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Tipo de pallet / contenedor
            </label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={tipoContenedorId}
              onChange={(e) =>
                setTipoContenedorId(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            >
              <option value="">Seleccioná</option>
              {contenedores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.descripcion}
                </option>
              ))}
            </select>

            {contenedorSeleccionado && (
              <div className="text-xs text-slate-500 mt-2 space-y-1">
                <p>
                  Dimensiones:{" "}
                  {contenedorSeleccionado.largo_mts &&
                    contenedorSeleccionado.ancho_mts &&
                    contenedorSeleccionado.alto_mts
                    ? `${contenedorSeleccionado.largo_mts}×${contenedorSeleccionado.ancho_mts}×${contenedorSeleccionado.alto_mts} m`
                    : "incompletas"}
                  {" · "}
                  Peso máx:{" "}
                  {contenedorSeleccionado.peso_max_kg != null
                    ? `${contenedorSeleccionado.peso_max_kg} kg`
                    : "sin definir"}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Mezcla de productos
            </label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white disabled:opacity-50"
              value={mixPolicyEfectiva}
              disabled={forceNoMezclar}
              onChange={(e) => setMixPolicy(e.target.value as MixPolicy)}
            >
              <option value="PERMITIR_MEZCLA">Permitir mezcla</option>
              <option value="NO_MEZCLAR">No mezclar (1 SKU por pallet)</option>
            </select>

            {forceNoMezclar ? (
              <p className="mt-2 text-[11px] text-amber-700">
                Operativo estable + múltiples SKUs: mezcla deshabilitada (se fuerza NO_MEZCLAR).
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">
                Si permitís mezcla, el motor puede combinar SKUs en el mismo pallet.
              </p>
            )}
          </div>

          {/* Acciones principales (único lugar) */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              {result ? (
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Plan listo
                </span>
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                  Sin calcular
                </span>
              )}

              <button
                type="button"
                onClick={handleCompareMix}
                disabled={forceNoMezclar || isPendingPreview || isPendingSave}
                className="text-xs px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                {forceNoMezclar ? "Comparar mezcla (bloqueado)" : isPendingPreview ? "Calculando..." : "Comparar mezcla"}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handlePreview}
                disabled={isPendingPreview || isPendingSave}
                className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50"
              >
                {isPendingPreview
                  ? "Calculando..."
                  : "Ver plan / previsualizar"}
              </button>

              <button
                type="button"
                onClick={handleGuardar}
                disabled={!result || isPendingPreview || isPendingSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50"
              >
                {isPendingSave ? "Guardando..." : "Guardar plan"}
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              “Ver plan” calcula el layout. Luego podés guardar cuando estés
              conforme.
            </p>
          </div>
        </div>

        {/* Saved / error */}
        {savedId != null && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 space-y-2">
            <div>
              Guardado OK. PalletPlan ID:{" "}
              <span className="font-semibold">{savedId}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/cubicacion/camion/${lote.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm"
              >
                Abrir camión (nueva pestaña)
              </a>
              <a
                href={`/cubicacion/camion/${lote.id}`}
                className="inline-flex items-center justify-center px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 text-sm"
              >
                Abrir camión (misma pestaña)
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 text-sm text-red-700 rounded-md">
            {error}
          </div>
        )}
      </div>

      {/* Columna derecha: Preview / Resultado */}
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Previsualización
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Estado:{" "}
                {result ? (
                  <span className="text-emerald-700">plan listo</span>
                ) : (
                  <span className="text-slate-500">sin calcular</span>
                )}
              </p>
            </div>

            {result ? (
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                OK
              </span>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                Pendiente
              </span>
            )}
          </div>

          {!result ? (
            <div className="mt-4 rounded-md border bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-700">Aún no hay resultado</p>
              <p className="mt-1 text-xs text-slate-500">
                Calculá el plan desde el panel de la izquierda.
              </p>
            </div>
          ) : (
            (() => {
              const capacidadTotal = Math.max(1, result.pallet1.cajasTotales);
              const progresoUnidades = Math.min(
                100,
                (result.pallet1.unidadesColocadas / capacidadTotal) * 100,
              );
              const ocupacionLibrePct = Math.max(
                0,
                100 - result.pallet1.ocupacionLogradaPct,
              );

              return (
                <div className="mt-4 space-y-4">
                  {/* Métricas — 2 filas */}
                  <div className="space-y-3">
                    {/* Fila 1 */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-slate-500">
                          Bultos colocados
                        </p>

                        <div className="mt-1 flex items-end justify-between gap-2">
                          <p className="text-2xl font-semibold text-slate-900">
                            {result.pallet1.unidadesColocadas}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            de {result.pallet1.cajasTotales}
                          </p>
                        </div>

                        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${progresoUnidades}%` }}
                          />
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500">
                          Capacidad calculada: {result.pallet1.cajasTotales}
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-slate-500">Capas</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {result.pallet1.capas}
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500 space-y-1">
                          <span className="block">
                            {proRefs?.isEmpresaBulto
                              ? "Unidad de cálculo: bulto empresa"
                              : "Unidad de cálculo: bulto/caja"}
                          </span>

                          {proRefs?.sampleDim ? (
                            <span className="block">
                              Bulto usado:{" "}
                              <span className="font-medium">
                                {proRefs.sampleDim.largo}×
                                {proRefs.sampleDim.ancho}×
                                {proRefs.sampleDim.alto} mm
                              </span>
                            </span>
                          ) : (
                            <span className="block">
                              Bulto usado: (sin placements)
                            </span>
                          )}

                          {proRefs?.sampleDim ? (
                            <span className="block">
                              Capacidad teórica por capa:{" "}
                              <span className="font-medium">
                                {proRefs.capTeorica} {proRefs.labelUnidad}/capa
                              </span>{" "}
                              <span className="text-slate-400">
                                ({proRefs.nx}×{proRefs.nz})
                              </span>
                            </span>
                          ) : null}

                          <span className="block">
                            Resultado (máx. por capa en este plan):{" "}
                            <span className="font-medium">
                              {result.pallet1.cajasPorCapa}{" "}
                              {proRefs?.labelUnidad ?? "cajas"}/capa
                            </span>
                          </span>

                          {result.pallet1.referencias?.rotacion2D ? (
                            <span className="block">
                              Rotación 2D:{" "}
                              <span className="font-medium">{result.pallet1.referencias.rotacion2D}</span>
                              {result.pallet1.referencias.orientacionElegida ? (
                                <>
                                  {" · "}Orientación:{" "}
                                  <span className="font-medium">
                                    {result.pallet1.referencias.orientacionElegida}
                                  </span>
                                </>
                              ) : null}
                            </span>
                          ) : null}


                          {proRefs?.sobraXmm != null &&
                            proRefs?.sobraZmm != null ? (
                            <span className="block text-slate-400">
                              Hueco esperado por grilla: sobra{" "}
                              {proRefs.sobraXmm} mm en largo y{" "}
                              {proRefs.sobraZmm} mm en ancho.
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    {/* Fila 2 */}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-slate-500">
                          Ocupación volumen
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {result.pallet1.ocupacionVolumenPct.toFixed(1)}%
                        </p>

                        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{
                              width: `${Math.min(100, result.pallet1.ocupacionVolumenPct)}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500">
                          Altura usada: {result.pallet1.alturaTotalM.toFixed(3)}{" "}
                          m
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-slate-500">
                          Ocupación total
                        </p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {result.pallet1.ocupacionLogradaPct.toFixed(1)}%
                        </p>

                        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-amber-500"
                            style={{
                              width: `${Math.min(100, result.pallet1.ocupacionLogradaPct)}%`,
                            }}
                          />
                        </div>

                        <p className="mt-2 text-[11px] text-slate-500">
                          Referencia: volumen completo.
                        </p>
                      </div>

                      <div className="rounded-lg border p-3">
                        <p className="text-xs text-slate-500">Peso total</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">
                          {result.pallet1.pesoTotalKg.toFixed(1)} kg
                        </p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          Pallets req.: {result.palletsRequeridos}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-slate-500">Volumen libre estimado</p>
                      <p className="font-semibold text-lg">
                        {formatVolumenMm3ToM3(result.pallet1.volumenLibreMm3)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Aproximadamente {ocupacionLibrePct.toFixed(1)}% del
                        pallet queda disponible.
                      </p>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-slate-400"
                          style={{
                            width: `${Math.min(100, ocupacionLibrePct)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-md border p-3 space-y-2">
                      <p className="text-slate-500">
                        Pallets requeridos (estimación)
                      </p>
                      <p className="font-semibold text-lg">
                        {result.palletsRequeridos}
                      </p>
                      <p className="text-xs text-slate-500">
                        Estimación base; no modifica el cálculo máximo.
                      </p>
                    </div>
                  </div>

                  {result.pallet1.warnings?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 rounded-md">
                      <p className="font-semibold mb-1">Advertencias</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {result.pallet1.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Viewer 3D */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">
                        Previsualización 3D — Pallet #1
                      </p>
                      <span className="text-[11px] text-slate-500">
                        Vista del layout calculado
                      </span>
                    </div>

                    <div className="min-h-[360px] h-[420px] w-full overflow-hidden rounded-md border bg-white">
                      <CubicacionPalletViewer3D
                        palletDimMm={result.pallet1.palletDimMm}
                        placements={result.pallet1.placements}
                      />
                    </div>

                    <p className="text-xs text-slate-500">
                      La visualización representa el layout calculado para el
                      primer pallet.
                    </p>
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Detalle del lote (derecha) */}
        <details className="rounded-lg border bg-white p-4">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">
            Detalle del lote
            <span className="ml-2 text-[11px] text-slate-500">
              ({loteResumen.length} SKUs)
            </span>
          </summary>

          <ul className="mt-3 list-disc pl-5 text-slate-700 text-xs space-y-1">
            {loteResumen.map((it) => (
              <li key={it.id}>
                <span className="font-medium">{it.codigo}</span>
                {" — "}
                {it.cantidadUnidades} un
                {it.bultosEstimados > 0 ? (
                  <>
                    {" ("}
                    {it.bultosEstimados} bultos · {it.unPorBulto} un/bulto
                    {it.dimBultoStd ? ` · ${formatDimMm(it.dimBultoStd)}` : ""}
                    {")"}
                  </>
                ) : (
                  <span className="text-slate-500"> (sin datos de bulto)</span>
                )}
                {it.dimUnidad ? (
                  <span className="text-slate-600">
                    {" "}
                    · unidad {formatDimMm(it.dimUnidad)}
                  </span>
                ) : null}
                {" — "}
                {it.volumenTotalM3.toFixed(4)} m³
                {!it.snapshotOk ? (
                  <span className="text-amber-700"> · (faltan snapshots)</span>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
