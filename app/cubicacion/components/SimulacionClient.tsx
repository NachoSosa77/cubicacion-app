"use client";

import { useMemo, useState } from "react";
import { BultoPanel } from "../simulacion/[loteId]/BultoPanel";
import { BultoSimSnapshot } from "../simulacion/types/types";
import { CamionClientSimV2 } from "./CamionClientSimV";
import { PalletClientV2 } from "./PalletClientV2";

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
  empresaId:number;
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

// Si ya tenés tipos exportados desde actions/lib, podés reemplazar estos
type CamionStrategy = "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";
type CamionPlanStatus = "BORRADOR" | "SELECCIONADO" | "DESCARTADO";

type DimMm = { largo: number; ancho: number; alto: number };

type CamionPlacement = {
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

export function SimulacionClient({
  empresaId,
  lote,
  contenedores,
  empresaBultos,

  // === NUEVO (para Step 3 inline) ===
  transportes,
  palletSummary,
  onPreviewCamion,
  onGuardarCamion,
}: {
  empresaId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
  empresaBultos: EmpresaBulto[];

  transportes: Transporte[];
  palletSummary: PalletSummary;
  onPreviewCamion: (params: { transporteId: number }) => Promise<CamionPreviewResponse>;
  onGuardarCamion: (params: {
    transporteId: number;
    strategy: CamionStrategy;
    status?: CamionPlanStatus;
    plan: CamionPlanResult;
  }) => Promise<{ camionPlanId: number }>;
}) {
  const [bultoSnap, setBultoSnap] = useState<BultoSimSnapshot | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [palletPlanId, setPalletPlanId] = useState<number | null>(null);

  const loteForPallet = useMemo(() => {
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

  const hasBulto = !!bultoSnap;
  const hasPallet = palletPlanId != null;

  const palletEnabled = hasBulto;
  const camionEnabled = hasPallet;

  const canGoPallet = hasBulto;
  const canGoCamion = hasPallet;

  /* =========================
     Handlers Step 3 (inline)
  ========================= */

  const handlePreviewCamion = (params: { transporteId: number }) => {
    return onPreviewCamion(params);
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
      {/* Container */}
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
                  Flujo encadenado: Bulto → Pallet → Camión (V2)
                </p>

                <div className="mt-3 flex flex-wrap gap-2 leading-tight">
                  {pill(`Lote ${lote.descripcion}`)}
                  {pill(`Tipos de productos: ${lote.items.length} `)}
                  {pill(`Unidades: ${lote.unidades_totales} `)}
                  {pill(`Bultos: ${lote.bultos_totales} `)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/cubicacion/pallet/${lote.id}`}
                  className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 text-sm"
                >
                  Flujo actual: Pallet
                </a>
                <a
                  href={`/cubicacion/camion/${lote.id}`}
                  className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 text-sm"
                >
                  Flujo actual: Camión
                </a>
              </div>
            </div>
          </header>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-600">
                  Estado del workflow
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    1) Bulto:{" "}
                    <span
                      className={
                        hasBulto
                          ? "text-emerald-700 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {hasBulto ? "Aplicado" : "Pendiente"}
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
                          ? "Listo para calcular"
                          : "Bloqueado"}
                    </span>
                  </span>

                  <span className="rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700">
                    3) Camión:{" "}
                    <span
                      className={
                        camionEnabled
                          ? "text-indigo-700 font-medium"
                          : "text-slate-600"
                      }
                    >
                      {camionEnabled ? "Listo para planificar" : "Pendiente"}
                    </span>
                  </span>
                </div>

                {hasBulto && (
                  <p className="text-[11px] text-slate-500">
                    Escenario activo:{" "}
                    <span className="font-medium text-slate-700">
                      {bultoSnap.titulo}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 text-sm disabled:opacity-50"
                  disabled={!palletEnabled}
                  onClick={() => {
                    document
                      .getElementById("panel-pallet")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Ir a Pallet
                </button>

                <button
                  type="button"
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm disabled:opacity-50"
                  disabled={!camionEnabled}
                  onClick={() => {
                    document
                      .getElementById("panel-camion")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Ir a Camión
                </button>
              </div>
            </div>
          </div>

          {/* Step selector */}
          <div className="rounded-2xl border bg-white p-2 shadow-sm">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={[
                  "rounded-xl px-3 py-2 text-sm border transition text-left",
                  step === 1
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900"
                    : "bg-white border-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="text-xs text-slate-600">Paso 1</div>
                <div className="font-semibold">Bulto</div>
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
                  {hasBulto ? "Listo para calcular" : "Requiere bulto aplicado"}
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
                  {hasPallet ? "Listo para planificar" : "Requiere pallet guardado"}
                </div>
              </button>
            </div>
          </div>

          {/* Panel activo */}
          <div className="rounded-2xl border bg-white shadow-sm">
            {step === 1 && (
              <div className="p-4 md:p-5">
                <BultoPanel
                  lote={lote}
                  empresaBultos={empresaBultos}
                  onApply={(snap) => {
                    setBultoSnap(snap);
                    setStep(2);
                  }}
                />

                {bultoSnap && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    Aplicado:{" "}
                    <span className="font-semibold">{bultoSnap.titulo}</span>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="p-4 md:p-5" id="panel-pallet">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      2) Pallet
                    </h2>
                  </div>
                </div>

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
                    PalletPlan guardado:{" "}
                    <span className="font-semibold">#{palletPlanId}</span>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
  <div className="p-4 md:p-5" id="panel-camion">
    <CamionClientSimV2
      lote={lote}
      transportes={transportes}
      palletSummary={palletSummary}
      onPreview={handlePreviewCamion}
      onGuardar={handleGuardarCamion}
    />
  </div>
)}

          </div>
        </div>
      </div>
    </section>
  );
}
