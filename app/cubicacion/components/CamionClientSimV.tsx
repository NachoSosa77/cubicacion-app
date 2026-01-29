"use client";

import { useMemo, useState, useTransition } from "react";
import { CubicacionCamionViewer3D } from "./CubicacionCamionViewer3D";

/* =========================
   Types
========================= */

type DimMm = { largo: number; ancho: number; alto: number };

type CamionPlacement = {
  palletPlanId: number;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

export type CamionPlanResult = {
  palletsTotales: number;
  palletsEnCamion: number;
  camionesRequeridos: number;
  pesoTotalKg: number;
  ocupacionBasePct: number;
  warnings: string[];
  placements: CamionPlacement[];
  camionDimMm: DimMm;
};

export type CamionStrategy = "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";

type PreviewResponse = {
  recommended_strategy: CamionStrategy;
  plans_by_strategy: Record<CamionStrategy, CamionPlanResult>;
  simulacion?: {
    modo: "SIMULACION_CAMION_PCT";
    cargaPct: number;
    palletsMaxPorStrategy: Record<CamionStrategy, number>;
    palletsSimuladosPorStrategy: Record<CamionStrategy, number>;
    bultosSimuladosPorStrategy: Record<CamionStrategy, number>;
    productosSimuladosPorStrategy: Record<
      CamionStrategy,
      Array<{ tipoProductoId: number; codigo: string; bultos: number }>
    >;
  } | null;
};

type ClientLote = {
  id: number;
  empresaId: number;
  descripcion?: string | null;
  tipoBulto?: "EMPRESA_BULTO" | "PRODUCTO";
};

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

/* =========================
   UI helpers
========================= */

const STRATEGY_LABEL: Record<CamionStrategy, string> = {
  ESTABLE: "Operativo / estable",
  OPTIMIZAR: "Optimizar ocupación",
  DESCARGA_RAPIDA: "Descarga rápida",
};

const STRATEGY_DESC: Record<CamionStrategy, string> = {
  ESTABLE: "Layout simple y consistente. Prioriza facilidad operativa.",
  OPTIMIZAR: "Maximiza ocupación del piso. Ideal para reducir viajes.",
  DESCARGA_RAPIDA: "Ordena pensando en descarga. Mejora tiempos en destino.",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function pill(text: string) {
  return (
    <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
      {text}
    </span>
  );
}

function optionCard(opts: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={opts.onClick}
      className={[
        "w-full text-left rounded-lg border p-3 transition",
        opts.active
          ? "border-indigo-300 bg-indigo-50"
          : "border-slate-200 bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{opts.title}</p>
          <p className="mt-1 text-xs text-slate-600">{opts.desc}</p>
        </div>

        <span
          className={[
            "shrink-0 text-[11px] px-2 py-1 rounded-full border",
            opts.active
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-slate-700 border-slate-200",
          ].join(" ")}
        >
          {opts.badge ?? (opts.active ? "Seleccionado" : "Elegir")}
        </span>
      </div>
    </button>
  );
}

/* =========================
   Component
========================= */

export function CamionClientSimV2({
  lote,
  transportes,
  palletSummary,
  onPreview,
  onGuardar,
}: {
  lote: ClientLote;
  transportes: Transporte[];
  palletSummary: PalletSummary;
  onPreview: (params: {
    transporteId: number;
    modo?: "GUARDADO" | "SIMULACION_CAMION_PCT";
    cargaPct?: number;
  }) => Promise<PreviewResponse>;
  onGuardar: (params: {
    transporteId: number;
    strategy: CamionStrategy;
    plan: CamionPlanResult;
    status?: "BORRADOR" | "SELECCIONADO";
  }) => Promise<{ camionPlanId: number }>;
}) {
  const [transporteId, setTransporteId] = useState<number | "">("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<CamionStrategy>("ESTABLE");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modoCarga, setModoCarga] = useState<
    "GUARDADO" | "SIMULACION_CAMION_PCT"
  >("GUARDADO");
  const [cargaPct, setCargaPct] = useState("100");

  const [isPending, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();

  const transporteSel = useMemo(() => {
    if (!transporteId) return null;
    return transportes.find((t) => t.id === transporteId) ?? null;
  }, [transporteId, transportes]);

  const hasPallets = (palletSummary?.palletsGuardados ?? 0) > 0;

  const activePlan = preview?.plans_by_strategy?.[selected] ?? null;

  const handlePreview = () => {
    setError(null);
    setMensaje(null);
    setPreview(null);

    if (!hasPallets) {
      setError(
        "Este lote no tiene planes de pallet guardados. Primero evaluá y guardá pallets."
      );
      return;
    }
    if (!transporteId) {
      setError("Seleccioná un transporte.");
      return;
    }
    if (!transporteSel) {
      setError("Transporte inválido.");
      return;
    }

    if (modoCarga === "SIMULACION_CAMION_PCT") {
      const pct = Number(cargaPct);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        setError("Indicá un % válido entre 1 y 100 para la simulación.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const res = await onPreview({
          transporteId: Number(transporteId),
          modo: modoCarga,
          cargaPct:
            modoCarga === "SIMULACION_CAMION_PCT"
              ? Number(cargaPct)
              : undefined,
        });
        setPreview(res);
        setSelected(res.recommended_strategy);
      } catch (e) {
        console.error(e);
        setError("No se pudo calcular la cubicación en camión.");
      }
    });
  };

  const handleGuardar = (status: "BORRADOR" | "SELECCIONADO") => {
    if (!activePlan || !transporteId) return;

    setError(null);
    setMensaje(null);


    startSave(async () => {
      try {
        const res = await onGuardar({
          transporteId: Number(transporteId),
          strategy: selected,
          plan: activePlan,
          status,
        });

        setMensaje(
          `Guardado OK. CamionPlan ID: ${res.camionPlanId} (${STRATEGY_LABEL[selected]})`
        );
      } catch (e) {
        console.error(e);
        setError("No se pudo guardar la cubicación en camión.");
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Columna izquierda: Config */}
      <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              3) Camión
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Elegí transporte y estrategia; previsualizá el layout y guardá.
            </p>
          </div>

          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
            Transporte
          </span>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {pill(`Lote #${lote.id}`)}
          {pill(`Pallets guardados: ${palletSummary.palletsGuardados}`)}
          {palletSummary.lastUpdatedAt
            ? pill(`Últ update: ${formatDateTime(palletSummary.lastUpdatedAt)}`)
            : pill("Sin update")}
          {lote.tipoBulto ? pill(`Tipo bulto: ${lote.tipoBulto}`) : null}
        </div>

        <div className="rounded-lg border bg-white p-3 space-y-2">
          <p className="text-sm font-semibold text-slate-900">
            Origen del cálculo
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={modoCarga === "GUARDADO"}
              onChange={() => setModoCarga("GUARDADO")}
            />
            <span>
              <strong>Usar pallets guardados</strong>
              <span className="block text-xs text-slate-500">
                Respeta la cubicación guardada en la base.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={modoCarga === "SIMULACION_CAMION_PCT"}
              onChange={() => setModoCarga("SIMULACION_CAMION_PCT")}
            />
            <span>
              <strong>Simular carga completa (%)</strong>
              <span className="block text-xs text-slate-500">
                Calcula capacidad del camión según un % de carga.
              </span>
            </span>
          </label>

          {modoCarga === "SIMULACION_CAMION_PCT" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                min={1}
                max={100}
                className="w-20 border rounded-md px-2 py-1"
                value={cargaPct}
                onChange={(e) => setCargaPct(e.target.value)}
              />
              <span className="text-xs text-slate-500">
                % de carga simulada
              </span>
            </div>
          )}
        </div>


        {/* Transporte + acciones */}
        <div className="rounded-lg border bg-white p-3 space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Transporte
            </label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              value={transporteId}
              onChange={(e) =>
                setTransporteId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <option value="">Seleccioná</option>
              {transportes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.denominacion_de_vehiculo}
                </option>
              ))}
            </select>

            {transporteSel && (
              <p className="text-xs text-slate-500">
                Dimensiones: {transporteSel.mt_largo_cub}×{transporteSel.mt_ancho_cub}×
                {transporteSel.mt_alto_cub} m · Peso máx:{" "}
                {transporteSel.max_peso_kg ?? "sin definir"} kg
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            {preview ? (
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                OK
              </span>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                Pendiente
              </span>
            )}

            <button
              type="button"
              onClick={handlePreview}
              disabled={isPending || !hasPallets}
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm disabled:opacity-50"
            >
              {isPending ? "Calculando..." : "Ver plan"}
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            “Ver plan” calcula el layout 3D para las estrategias disponibles.
          </p>
        </div>

        {/* Estrategia (cards) */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">
            Estrategia de cubicación
          </label>

          <div className="grid gap-2">
            {optionCard({
              title: STRATEGY_LABEL.ESTABLE,
              desc: STRATEGY_DESC.ESTABLE,
              active: selected === "ESTABLE",
              onClick: () => setSelected("ESTABLE"),
              badge: selected === "ESTABLE" ? "Seleccionado" : "Elegir",
            })}

            {optionCard({
              title: STRATEGY_LABEL.OPTIMIZAR,
              desc: STRATEGY_DESC.OPTIMIZAR,
              active: selected === "OPTIMIZAR",
              onClick: () => setSelected("OPTIMIZAR"),
              badge: selected === "OPTIMIZAR" ? "Seleccionado" : "Elegir",
            })}

            {optionCard({
              title: STRATEGY_LABEL.DESCARGA_RAPIDA,
              desc: STRATEGY_DESC.DESCARGA_RAPIDA,
              active: selected === "DESCARGA_RAPIDA",
              onClick: () => setSelected("DESCARGA_RAPIDA"),
              badge: selected === "DESCARGA_RAPIDA" ? "Seleccionado" : "Elegir",
            })}
          </div>
        </div>

        {/* Guardar */}
        <div className="rounded-lg border bg-white p-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => handleGuardar("BORRADOR")}
              disabled={!preview || !activePlan || isSaving || isPending}
              className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              {isSaving ? "Guardando..." : "Guardar alternativa"}
            </button>

            <button
              type="button"
              onClick={() => handleGuardar("SELECCIONADO")}
              disabled={!preview || !activePlan || isSaving || isPending}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 text-sm disabled:opacity-50"
            >
              {isSaving ? "Guardando..." : "Guardar y seleccionar"}
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            “Seleccionar” deja esta estrategia como la opción elegida para este transporte.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 p-3 text-sm text-red-700 rounded-md">
            {error}
          </div>
        )}

        {mensaje && (
          <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 rounded-md">
            {mensaje}
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
                {preview ? (
                  <span className="text-emerald-700">plan listo</span>
                ) : (
                  <span className="text-slate-500">sin calcular</span>
                )}
              </p>
            </div>

            {preview ? (
              <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                OK
              </span>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                Pendiente
              </span>
            )}
          </div>

          {!preview || !activePlan ? (
            <div className="mt-4 rounded-md border bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-700">Aún no hay resultado</p>
              <p className="mt-1 text-xs text-slate-500">
                Elegí transporte y usá <span className="font-medium">“Ver plan”</span>.
              </p>
            </div>
          ) : (
            (() => {
              const p = activePlan;

              const ocupBase = Number((p.ocupacionBasePct ?? 0).toFixed(2));
              const pesoKg = Number((p.pesoTotalKg ?? 0).toFixed(2));

              return (
                <div className="mt-4 space-y-4">
                  {preview.simulacion && (
                    <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700 space-y-2">
                      <p className="font-semibold">
                        Simulación de carga: {preview.simulacion.cargaPct}% del
                        camión
                      </p>
                      <div className="grid gap-2 md:grid-cols-3 text-xs">
                        <div>
                          <p className="text-slate-500">Pallets simulados</p>
                          <p className="font-semibold">
                            {
                              preview.simulacion.palletsSimuladosPorStrategy[
                                selected
                              ]
                            }{" "}
                            /{" "}
                            {
                              preview.simulacion.palletsMaxPorStrategy[
                                selected
                              ]
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Bultos estimados</p>
                          <p className="font-semibold">
                            {
                              preview.simulacion.bultosSimuladosPorStrategy[
                                selected
                              ]
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Productos (bultos)</p>
                          <p className="font-semibold">
                            {
                              preview.simulacion.productosSimuladosPorStrategy[
                                selected
                              ].length
                            }
                          </p>
                        </div>
                      </div>

                      {preview.simulacion.productosSimuladosPorStrategy[
                        selected
                      ].length > 0 && (
                        <ul className="text-xs text-slate-600 list-disc pl-4">
                          {preview.simulacion.productosSimuladosPorStrategy[
                            selected
                          ].map((prod) => (
                            <li key={prod.tipoProductoId}>
                              {prod.codigo}: {prod.bultos} bultos
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Resumen */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {STRATEGY_LABEL[selected]}
                      </p>
                      <p className="text-xs text-slate-500">
                        {STRATEGY_DESC[selected]}
                      </p>
                    </div>

                    {preview.recommended_strategy === selected ? (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Recomendada
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                        Alternativa
                      </span>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="grid gap-3 md:grid-cols-4 text-sm">
                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-slate-500">Camiones requeridos</p>
                      <p className="font-semibold text-lg">{p.camionesRequeridos}</p>
                    </div>

                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-slate-500">Pallets en camión</p>
                      <p className="font-semibold text-lg">
                        {p.palletsEnCamion} / {p.palletsTotales}
                      </p>
                    </div>

                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-slate-500">Ocupación base</p>
                      <p className="font-semibold text-lg">{ocupBase}%</p>
                    </div>

                    <div className="rounded-md border p-3 space-y-1">
                      <p className="text-slate-500">Peso total</p>
                      <p className="font-semibold text-lg">{pesoKg} kg</p>
                    </div>
                  </div>

                  {/* Warnings */}
                  {p.warnings?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 rounded-md">
                      <p className="font-semibold mb-1">Advertencias</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {p.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Viewer */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-700">
                        Previsualización 3D — Camión
                      </p>
                      <span className="text-[11px] text-slate-500">
                        Layout calculado
                      </span>
                    </div>

                    <div className="min-h-[360px] h-[420px] w-full overflow-hidden rounded-md border bg-white">
                      <CubicacionCamionViewer3D
                        camionDimMm={p.camionDimMm}
                        placements={p.placements}
                      />
                    </div>

                    <p className="text-xs text-slate-500">
                      La visualización representa el layout calculado para el camión seleccionado.
                    </p>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
