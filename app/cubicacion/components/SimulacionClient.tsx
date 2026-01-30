"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { BultoPanel } from "../simulacion/[simulacionId]/BultoPanel";
import { BultoSimSnapshot } from "../simulacion/types/types";
import { BultoPanelSim } from "./BultoPanelSim";

import { useRouter, useSearchParams } from "next/navigation";
import { CamionClientSimV2 } from "./CamionClientSimV";
import { PalletClientV2 } from "./PalletClientV2";

/* =========================
   Types
========================= */

type EmpresaBulto = {
  id: number;
  empresa_id: number;
  codigo: string;
  descripcion?: string | null;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  espesor_pared_mm: number;
  tara_kg?: number | null;
  max_peso_kg?: number | null;
  es_preferido: boolean;
  habilitado: boolean;
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
  empresaId: number;
  descripcion: string | null;
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

/* =========================
   Camión (types mínimos)
========================= */

type Transporte = {
  id: number;
  denominacion_de_vehiculo: string;
  mt_largo_cub: number;
  mt_ancho_cub: number;
  mt_alto_cub: number;
  max_peso_kg?: number | null;
};

type PalletSummary = {
  palletsGuardados: number;
  pesoEstimadoKg: number;
  lastUpdatedAt: string | null;
};

type CamionStrategy = "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";
type CamionPlanStatus = "BORRADOR" | "SELECCIONADO" | "DESCARTADO";

type DimMm = { largo: number; ancho: number; alto: number };

type CamionPlacement = {
  /** ✅ clave estable para React + para evitar choque de tipos */
  id: string;
  palletPlanId: number;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

type CamionPlanResult = {
  palletsTotales: number;
  palletsEnCamion: number;
  camionesRequeridos: number;
  pesoTotalKg: number;
  ocupacionBasePct: number;
  warnings: string[];
  placements: CamionPlacement[];
  camionDimMm: DimMm;
};

type CamionPreviewResponse = {
  recommended_strategy: CamionStrategy;
  plans_by_strategy: Record<CamionStrategy, CamionPlanResult>;
};

function pill(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm">
      {text}
    </span>
  );
}

/* =========================
   Helpers (camión)
========================= */

function ensurePlanHasPlacementIds(plan: CamionPlanResult): CamionPlanResult {
  const placements = Array.isArray(plan?.placements) ? plan.placements : [];
  return {
    ...plan,
    placements: placements.map((p: any, idx: number) => ({
      ...p,
      // ✅ id estable + único (si el server no lo manda todavía)
      id: String(p?.id ?? `cp-${p?.palletPlanId ?? "x"}-${idx}`),
    })),
  };
}

/* =========================
   Component
========================= */

export function SimulacionClient({
  simulacionId,
  simulacionLoteId,
  empresaId,
  lote,
  contenedores,
  empresaBultos,
  transportes,
  palletSummary,
  productosPlan,
  initialStep,
  // Actions
  onSearchTipoProducto,
  onUpsertProductoPlan,
  onPreviewCamion,
  onGuardarCamion,
  onContinuarABulto,
}: {
  simulacionId: number;
  initialStep?: string | null;
  simulacionLoteId: number | null;
  empresaId: number;
  lote: ClientLote | null;

  contenedores: ClientContenedor[];
  empresaBultos: EmpresaBulto[];

  transportes: Transporte[];
  palletSummary: PalletSummary;

  productosPlan: Array<{
    id: number;
    codigo: string;
    cantidad_unidades: number;
    tipo_producto_id?: number | null;
  }>;

  // IMPORTANT: server action to sync producto_plan -> lote_item before going to Bulto
  onContinuarABulto: () => Promise<void>;

  onSearchTipoProducto: (params: { q: string }) => Promise<
    Array<{
      id: number;
      codigo: string;
      descripcion: string;
      unidad_entra_por_bulto: number;
      largo_por_bulto: number;
      ancho_por_bulto: number;
      alto_por_bulto: number;
      peso_por_unidad_venta: string | null;
      peso_por_bulto: string | null;
      volumen_por_bulto: string | null;
    }>
  >;

  onUpsertProductoPlan: (params: {
    codigo: string;
    cantidad_unidades: number;
    tipo_producto_id?: number | null;

    dim_unidad_mm?: any | null;
    largo_unidad_mm?: unknown;
    ancho_unidad_mm?: unknown;
    alto_unidad_mm?: unknown;
    peso_unidad_kg?: number | null;
  }) => Promise<void>;

  onPreviewCamion: (params: { transporteId: number }) => Promise<CamionPreviewResponse>;

  onGuardarCamion: (params: {
    transporteId: number;
    strategy: CamionStrategy;
    status?: CamionPlanStatus;
    plan: CamionPlanResult;
  }) => Promise<{ camionPlanId: number }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // === Workflow state
  const [bultoSnap, setBultoSnap] = useState<BultoSimSnapshot | null>(null);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const appliedRef = useRef(false);
  const [palletPlanId, setPalletPlanId] = useState<number | null>(null);

  // === Step 0: buscador
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition(); // buscar / upsert
  const [isSyncing, startSync] = useTransition(); // continuar a bulto

  const hasProductos =
    (productosPlan?.length ?? 0) > 0 || (lote?.items?.length ?? 0) > 0;

  const hasBulto = !!bultoSnap;
  const hasPallet = palletPlanId != null;

  // Pallet y camión (por ahora) requieren lote existente
  const palletEnabled = hasBulto && !!lote;
  const camionEnabled = hasPallet && !!lote;

  const canGoBulto = hasProductos;
  const canGoPallet = palletEnabled;
  const canGoCamion = camionEnabled;

  const loteForPallet = useMemo(() => {
    if (!lote) return null;
    if (!bultoSnap) return lote;

    const itemsByTipoProductoId = new Map(
      bultoSnap.items.map((x) => [x.tipo_producto_id, x]),
    );

    return {
      ...lote,
      __simulacion: {
        candidateKey: bultoSnap.candidateKey,
        titulo: bultoSnap.titulo,
      },
      unidades_totales: bultoSnap.totales.unidades,
      bultos_totales: bultoSnap.totales.bultos,
      items: lote.items.map((it) => {
        const sim = itemsByTipoProductoId.get(it.tipo_producto_id);
        if (!sim) return it;

        return {
          ...it,
          cantidad_unidades: sim.unidades_planificadas,
          cantidad_bultos: sim.cantidad_bultos,
          unidades_por_bulto: sim.unidades_por_bulto,
          dim_bulto_mm: sim.dim_bulto_mm ?? null,
        };
      }),
    };
  }, [lote, bultoSnap]);

  useEffect(() => {
    if (appliedRef.current) return;
    if (!initialStep) return;

    if (initialStep === "bulto" || initialStep === "1") {
      setStep(1);
      appliedRef.current = true;
    }
  }, [initialStep]);

  useEffect(() => {
    if (!appliedRef.current) return;

    const stepParam = searchParams.get("step");
    if (!stepParam) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("step");

    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  // ✅ Sync + refresh + go to step 1
  const handleContinuarABulto = () => {
    startSync(async () => {
      await onContinuarABulto(); // server action: asegura lote + sync items
      router.refresh(); // recarga datos del server (lote.items)
      setStep(1); // ir a Bulto
    });
  };

  /**
   * ✅ Wrapper: normaliza la respuesta del server para que SIEMPRE tenga placements con `id`
   * Esto arregla:
   * - El error de TS (faltaba `id`)
   * - El warning de React (keys duplicadas) si tu viewer usa p.id como key
   */
  const handlePreviewCamion = async (params: { transporteId: number }) => {
    const res = await onPreviewCamion(params);

    const plans = res.plans_by_strategy;

    return {
      ...res,
      plans_by_strategy: {
        ESTABLE: ensurePlanHasPlacementIds(plans.ESTABLE),
        OPTIMIZAR: ensurePlanHasPlacementIds(plans.OPTIMIZAR),
        DESCARGA_RAPIDA: ensurePlanHasPlacementIds(plans.DESCARGA_RAPIDA),
      },
    } satisfies CamionPreviewResponse;
  };

  const handleGuardarCamion = (params: {
    transporteId: number;
    strategy: CamionStrategy;
    status?: CamionPlanStatus;
    plan: CamionPlanResult;
  }) => {
    return onGuardarCamion(params);
  };

  return (
    <section className="bg-slate-50/40">
      <div className="mx-auto w-full max-w-350 px-4 py-5 md:px-6 md:py-6">
        <div className="space-y-5">
          {/* Header */}
          <header className="rounded-2xl border bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-slate-900">
                  Simulación avanzada
                </h1>
                <p className="text-sm text-slate-600">
                  Flujo encadenado: Productos → Bulto → Pallet → Camión
                </p>

                <div className="mt-3 flex flex-wrap gap-2 leading-tight">
                  {pill(`Simulación #${simulacionId}`)}
                  {pill(`Empresa: ${empresaId}`)}
                  {pill(lote ? `Lote #${lote.id}` : "Sin lote")}
                  {pill(`Productos: ${productosPlan?.length ?? 0}`)}
                </div>
              </div>
            </div>
          </header>

          {/* Estado del workflow */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">
                  Estado del workflow
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    0) Productos:{" "}
                    <span
                      className={
                        hasProductos
                          ? "text-emerald-700 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {hasProductos ? "OK" : "Pendiente"}
                    </span>
                  </span>

                  <span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    1) Bulto:{" "}
                    <span
                      className={
                        hasBulto
                          ? "text-emerald-700 font-medium"
                          : hasProductos
                          ? "text-indigo-700 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {hasBulto ? "Aplicado" : hasProductos ? "Listo" : "Bloqueado"}
                    </span>
                  </span>

                  <span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    2) Pallet:{" "}
                    <span
                      className={
                        hasPallet
                          ? "text-emerald-700 font-medium"
                          : palletEnabled
                          ? "text-indigo-700 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {hasPallet
                        ? `Guardado #${palletPlanId}`
                        : palletEnabled
                        ? "Listo"
                        : lote
                        ? "Requiere bulto"
                        : "Requiere lote"}
                    </span>
                  </span>

                  <span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    3) Camión:{" "}
                    <span
                      className={
                        camionEnabled ? "text-indigo-700 font-medium" : "text-slate-600"
                      }
                    >
                      {camionEnabled ? "Listo" : lote ? "Pendiente" : "Requiere lote"}
                    </span>
                  </span>
                </div>

                {hasBulto && bultoSnap && (
                  <p className="text-[11px] text-slate-500">
                    Escenario activo:{" "}
                    <span className="font-medium text-slate-700">
                      {bultoSnap.titulo}
                    </span>
                  </p>
                )}
              </div>

              {/* <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 text-sm"
                  onClick={() => setStep(0)}
                >
                  Productos
                </button>

                <button
                  type="button"
                  className="px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 text-sm disabled:opacity-50"
                  disabled={!canGoBulto}
                  onClick={() => setStep(1)}
                >
                  Ir a Bulto
                </button>

                <button
                  type="button"
                  className="px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 text-sm disabled:opacity-50"
                  disabled={!canGoPallet}
                  onClick={() => setStep(2)}
                >
                  Ir a Pallet
                </button>

                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm disabled:opacity-50"
                  disabled={!canGoCamion}
                  onClick={() => setStep(3)}
                >
                  Ir a Camión
                </button>
              </div> */}
            </div>
          </div>

          {/* Step selector */}
          <div className="rounded-2xl border bg-white p-2 shadow-sm">
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className={[
                  "rounded-xl px-3 py-2 text-sm border transition text-left",
                  step === 0
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-white border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="text-xs text-slate-600">Paso 0</div>
                <div className="font-semibold">Productos</div>
                <div className="text-[11px] text-slate-500">Catálogo + lista</div>
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!canGoBulto}
                className={[
                  "rounded-xl px-3 py-2 text-sm border transition text-left disabled:opacity-50",
                  step === 1
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-white border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="text-xs text-slate-600">Paso 1</div>
                <div className="font-semibold">Bulto</div>
                <div className="text-[11px] text-slate-500">
                  {hasProductos ? "Listo para simular" : "Requiere productos"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!canGoPallet}
                className={[
                  "rounded-xl px-3 py-2 text-sm border transition text-left disabled:opacity-50",
                  step === 2
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-white border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="text-xs text-slate-600">Paso 2</div>
                <div className="font-semibold">Pallet</div>
                <div className="text-[11px] text-slate-500">
                  {lote ? (hasBulto ? "Listo para calcular" : "Requiere bulto") : "Requiere lote"}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!canGoCamion}
                className={[
                  "rounded-xl px-3 py-2 text-sm border transition text-left disabled:opacity-50",
                  step === 3
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-white border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="text-xs text-slate-600">Paso 3</div>
                <div className="font-semibold">Camión</div>
                <div className="text-[11px] text-slate-500">
                  {lote ? (hasPallet ? "Listo para planificar" : "Requiere pallet") : "Requiere lote"}
                </div>
              </button>
            </div>
          </div>

          {/* Panel activo */}
          <div className="rounded-2xl border bg-white shadow-sm">
            {/* Paso 0: Productos */}
            {step === 0 && (
              <div className="p-4 md:p-5 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">0) Productos</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Buscá y agregá productos a la simulación. Luego continuá al paso Bulto.
                  </p>
                </div>

                {/* Buscador */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-slate-600">
                        Buscar producto (código o descripción)
                      </label>
                      <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        placeholder="Ej: CAFE o GALLETAS"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={!q.trim() || isPending}
                        onClick={() => {
                          const query = q.trim();
                          startTransition(async () => {
                            const r = await onSearchTipoProducto({ q: query });
                            setResults(r ?? []);
                          });
                        }}
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 text-sm disabled:opacity-50"
                      >
                        {isPending ? "Buscando..." : "Buscar"}
                      </button>
                    </div>
                  </div>

                  {/* Resultados */}
                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-600">Resultados</p>

                    {results?.length ? (
                      <ul className="mt-2 space-y-2">
                        {results.map((r) => (
                          <li key={r.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900">{r.codigo}</div>
                                <div className="text-slate-600 text-xs truncate">{r.descripcion}</div>

                                <div className="mt-1 text-[11px] text-slate-500">
                                  Bulto: {r.unidad_entra_por_bulto} u · {r.largo_por_bulto}×{r.ancho_por_bulto}×
                                  {r.alto_por_bulto} mm · Peso/u venta: {r.peso_por_unidad_venta ?? "N/D"}
                                </div>
                              </div>

                              <form
                                action={async (fd) => {
                                  const cantidad = Number(fd.get("cantidad_unidades") ?? 0);

                                  await onUpsertProductoPlan({
                                    codigo: r.codigo,
                                    cantidad_unidades: cantidad,
                                    tipo_producto_id: r.id,

                                    largo_unidad_mm: fd.get("largo_unidad_mm"),
                                    ancho_unidad_mm: fd.get("ancho_unidad_mm"),
                                    alto_unidad_mm: fd.get("alto_unidad_mm"),

                                    peso_unidad_kg:
                                      fd.get("peso_unidad_kg") == null ||
                                      String(fd.get("peso_unidad_kg")).trim() === ""
                                        ? null
                                        : Number(fd.get("peso_unidad_kg")),
                                  });

                                  router.refresh();
                                }}
                                className="grid gap-2 md:grid-cols-6 md:items-end"
                              >
                                <div>
                                  <label className="text-[11px] text-slate-600">Unidades</label>
                                  <input
                                    name="cantidad_unidades"
                                    type="number"
                                    min={1}
                                    defaultValue={6}
                                    className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] text-slate-600">Largo unidad (mm)</label>
                                  <input
                                    name="largo_unidad_mm"
                                    type="number"
                                    min={1}
                                    defaultValue={80}
                                    className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] text-slate-600">Ancho unidad (mm)</label>
                                  <input
                                    name="ancho_unidad_mm"
                                    type="number"
                                    min={1}
                                    defaultValue={80}
                                    className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] text-slate-600">Alto unidad (mm)</label>
                                  <input
                                    name="alto_unidad_mm"
                                    type="number"
                                    min={1}
                                    defaultValue={180}
                                    className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                                  />
                                </div>

                                <div>
                                  <label className="text-[11px] text-slate-600">Peso/u (kg)</label>
                                  <input
                                    name="peso_unidad_kg"
                                    type="number"
                                    step="0.001"
                                    min={0}
                                    placeholder="opcional"
                                    className="w-full rounded-md border bg-white px-2 py-1 text-sm"
                                  />
                                </div>

                                <button
                                  type="submit"
                                  className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50"
                                >
                                  Agregar
                                </button>
                              </form>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        {q.trim() ? "Sin resultados." : "Escribí una búsqueda y tocá Buscar."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Productos cargados */}
                <div className="rounded-xl border bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-600">
                      Productos cargados en la simulación
                    </p>

                    <button
                      type="button"
                      className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm disabled:opacity-50"
                      disabled={!hasProductos || isSyncing}
                      onClick={handleContinuarABulto}
                    >
                      {isSyncing ? "Sincronizando..." : "Continuar a Bulto"}
                    </button>
                  </div>

                  {productosPlan?.length ? (
                    <ul className="mt-3 space-y-2">
                      {productosPlan.map((p: any) => (
                        <li key={p.id} className="rounded-lg border bg-white px-3 py-2 text-sm">
                          <span className="font-medium">{p.codigo}</span>
                          <span className="text-slate-500"> · unidades: {p.cantidad_unidades}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Todavía no hay productos.</p>
                  )}
                </div>
              </div>
            )}

            {/* Paso 1: Bulto */}
            {step === 1 && (
              <div className="p-4 md:p-5">
                {lote ? (
                  <BultoPanel
                    simulacionId={simulacionId}
                    simulacionLoteId={simulacionLoteId}
                    lote={lote}
                    empresaBultos={empresaBultos}
                    onApply={(snap) => {
                      setBultoSnap(snap);
                      setStep(2);
                    }}
                  />
                ) : (
                  <BultoPanelSim
                    simulacionId={simulacionId}
                    simulacionLoteId={simulacionLoteId}
                    empresaBultos={empresaBultos}
                    onApply={(snap) => {
                      setBultoSnap(snap);
                      setStep(2);
                    }}
                  />
                )}

                {bultoSnap && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    Aplicado: <span className="font-semibold">{bultoSnap.titulo}</span>
                  </div>
                )}

                {!lote && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Nota: Pallet y Camión aún requieren lote asociado.
                  </div>
                )}
              </div>
            )}

            {/* Paso 2: Pallet */}
            {step === 2 && (
              <div className="p-4 md:p-5" id="panel-pallet">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">2) Pallet</h2>
                  </div>
                </div>

                {!lote || !loteForPallet ? (
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
                    Este paso requiere lote asociado (por ahora). Volvé a Productos/Bulto o asociá la simulación a un lote.
                  </div>
                ) : (
                  <>
                    <PalletClientV2
                      empresaId={empresaId}
                      lote={loteForPallet as any}
                      contenedores={contenedores as any}
                      bultoSnap={bultoSnap}
                      onSaved={(id: number) => {
                        setPalletPlanId(id);
                        setStep(3);
                      }}
                    />

                    {palletPlanId != null && (
                      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                        PalletPlan guardado: <span className="font-semibold">#{palletPlanId}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Paso 3: Camión */}
            {step === 3 && (
              <div className="p-4 md:p-5" id="panel-camion">
                {!lote ? (
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-600">
                    Este paso requiere lote asociado (por ahora).
                  </div>
                ) : (
                  <CamionClientSimV2
                    lote={lote}
                    transportes={transportes}
                    palletSummary={palletSummary}
                    onPreview={handlePreviewCamion}
                    onGuardar={handleGuardarCamion}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
