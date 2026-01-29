"use client";

import { useMemo, useState, useTransition } from "react";
import { CubicacionCamionViewer3D } from "./CubicacionCamionViewer3D";

/* =========================
   Types
========================= */

type DimMm = { largo: number; ancho: number; alto: number };

type CamionPlacement = {
  id: string; // ✅ unico para React
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

function buildGridPlacements(args: {
  pallets: number;
  camionDimMm: DimMm;
  palletDimMm: DimMm;
}): CamionPlacement[] {
  const { pallets, camionDimMm, palletDimMm } = args;
  if (pallets <= 0) return [];

  // elegir orientación que maximiza por piso
  const normal = {
    rot90: false,
    nx: Math.floor(camionDimMm.largo / palletDimMm.largo),
    ny: Math.floor(camionDimMm.ancho / palletDimMm.ancho),
    dx: palletDimMm.largo,
    dy: palletDimMm.ancho,
  };

  const rot = {
    rot90: true,
    nx: Math.floor(camionDimMm.largo / palletDimMm.ancho),
    ny: Math.floor(camionDimMm.ancho / palletDimMm.largo),
    dx: palletDimMm.ancho,
    dy: palletDimMm.largo,
  };

  const capNormal = Math.max(0, normal.nx) * Math.max(0, normal.ny);
  const capRot = Math.max(0, rot.nx) * Math.max(0, rot.ny);

  const best = capRot > capNormal ? rot : normal;
  const perFloor = Math.max(0, best.nx) * Math.max(0, best.ny);
  if (perFloor <= 0) return [];

  const floors = Math.max(1, Math.floor(camionDimMm.alto / palletDimMm.alto));
  const maxTotal = perFloor * floors;
  const count = Math.min(pallets, maxTotal);

  const placements: CamionPlacement[] = [];
  let i = 0;

  for (let f = 0; f < floors && i < count; f++) {
    for (let y = 0; y < best.ny && i < count; y++) {
      for (let x = 0; x < best.nx && i < count; x++) {
        const centerX = x * best.dx + best.dx / 2;
        const centerY = y * best.dy + best.dy / 2;
        const centerZ = f * palletDimMm.alto + palletDimMm.alto / 2;

        placements.push({
          id: `sim-${i}`,
          palletPlanId: 0, // en simulación no importa
          dimMm: palletDimMm,
          posCentroMm: { x: centerX, y: centerY, z: centerZ },
          rot90: best.rot90,
        });

        i++;
      }
    }
  }

  return placements;
}


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

function floorDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.floor(a / b);
}

function calcMaxPalletsPorPiso(camion: DimMm, pallet: DimMm) {
  // caso normal
  const nx = floorDiv(camion.largo, pallet.largo);
  const ny = floorDiv(camion.ancho, pallet.ancho);
  const normal = nx * ny;

  // caso rotado 90°
  const nxR = floorDiv(camion.largo, pallet.ancho);
  const nyR = floorDiv(camion.ancho, pallet.largo);
  const rot = nxR * nyR;

  if (rot > normal) {
    return { palletsPorPiso: rot, usarRot90: true, nx: nxR, ny: nyR };
  }
  return { palletsPorPiso: normal, usarRot90: false, nx, ny };
}

function clampInt(v: number, min: number, max: number) {
  const n = Math.trunc(v);
  return Math.max(min, Math.min(max, n));
}


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
  onPreview: (params: { transporteId: number }) => Promise<PreviewResponse>;
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
  const [ocupacionObjetivoPct, setOcupacionObjetivoPct] = useState<number>(100);

  const [isPending, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();

  const transporteSel = useMemo(() => {
    if (!transporteId) return null;
    return transportes.find((t) => t.id === transporteId) ?? null;
  }, [transporteId, transportes]);

  const hasPallets = (palletSummary?.palletsGuardados ?? 0) > 0;




  const palletSpec = useMemo(() => {
    // 1) necesito un preview o al menos un plan con placements
    const anyPlan =
      preview?.plans_by_strategy?.ESTABLE ??
      preview?.plans_by_strategy?.OPTIMIZAR ??
      null;

    const first = anyPlan?.placements?.[0] ?? null;
    if (!first) return null;

    const dim = first.dimMm;
    const pesoPorPallet =
      palletSummary.palletsGuardados > 0
        ? palletSummary.pesoEstimadoKg / palletSummary.palletsGuardados
        : null;

    return { dim, pesoPorPallet };
  }, [preview, palletSummary]);

  const capacidadCamion = useMemo(() => {
    if (!transporteSel || !palletSpec) return null;

    const camion: DimMm = {
      largo: Math.round(transporteSel.mt_largo_cub * 1000),
      ancho: Math.round(transporteSel.mt_ancho_cub * 1000),
      alto: Math.round(transporteSel.mt_alto_cub * 1000),
    };

    // altura
    if (palletSpec.dim.alto > camion.alto) {
      return {
        camion,
        maxPorGeometria: 0,
        maxPorPeso: 0,
        max: 0,
        usarRot90: false,
        motivo: "El pallet no entra por altura.",
      };
    }

    // grilla piso
    const g = calcMaxPalletsPorPiso(camion, palletSpec.dim);
    const maxPorGeometria = g.palletsPorPiso;

    // peso
    const maxPeso = transporteSel.max_peso_kg ?? null;
    const pesoPorPallet = palletSpec.pesoPorPallet ?? null;

    let maxPorPeso = maxPorGeometria;
    if (maxPeso != null && pesoPorPallet != null && pesoPorPallet > 0) {
      maxPorPeso = Math.floor(maxPeso / pesoPorPallet);
    }

    const max = Math.max(0, Math.min(maxPorGeometria, maxPorPeso));

    return {
      camion,
      maxPorGeometria,
      maxPorPeso,
      max,
      usarRot90: g.usarRot90,
      motivo: null as string | null,
    };
  }, [transporteSel, palletSpec]);

  const palletsCapacidadPct = useMemo(() => {
    if (!capacidadCamion) return 0;
    const raw = (capacidadCamion.max * ocupacionObjetivoPct) / 100;
    return clampInt(Math.floor(raw), 0, capacidadCamion.max);
  }, [capacidadCamion, ocupacionObjetivoPct]);

  const activePlan = useMemo<CamionPlanResult | null>(() => {
  if (!preview) return null;

  // ESTABLE y DESCARGA_RAPIDA = lo que venga del server
  if (selected !== "OPTIMIZAR") {
    return preview.plans_by_strategy[selected] ?? null;
  }

  // =========================
  // OPTIMIZAR = simulador por %
  // =========================

  const base =
    preview.plans_by_strategy.ESTABLE ??
    preview.plans_by_strategy.OPTIMIZAR;

  if (!base || !capacidadCamion || !palletSpec?.dim) return base ?? null;

  const camionDimMm = capacidadCamion.camion;
  const palletDimMm = palletSpec.dim;

  const palletsEnCamion = palletsCapacidadPct;

  const palletsTotales = base.palletsTotales;
  const camionesRequeridos =
    palletsEnCamion > 0
      ? Math.ceil(palletsTotales / palletsEnCamion)
      : palletsTotales;

  const pesoPorPallet = palletSpec.pesoPorPallet ?? 0;
  const pesoTotalKg = palletsEnCamion * pesoPorPallet;

  // 👉 generar placements en grilla SOLO para visualizar
  const placements = buildGridPlacements({
    pallets: palletsEnCamion,
    camionDimMm,
    palletDimMm,
  });

  return {
    ...base,
    palletsEnCamion,
    camionesRequeridos,
    pesoTotalKg,
    camionDimMm,
    placements,
    warnings: [
      ...(base.warnings ?? []),
      `Simulación por ocupación objetivo: ${ocupacionObjetivoPct}%.`,
      placements.length < palletsEnCamion
        ? "Limitado por altura: no entran todas las capas."
        : "",
    ].filter(Boolean),
  };
}, [
  preview,
  selected,
  capacidadCamion,
  palletsCapacidadPct,
  ocupacionObjetivoPct,
  palletSpec,
]);



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

    startTransition(async () => {
      try {
        const res = await onPreview({ transporteId: Number(transporteId) });
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

        {selected === "OPTIMIZAR" && (
          <div className="rounded-lg border bg-white p-3 space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Ocupación objetivo del camión
            </label>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={ocupacionObjetivoPct}
                onChange={(e) => setOcupacionObjetivoPct(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm font-semibold w-14 text-right">
                {ocupacionObjetivoPct}%
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Simula cuántos pallets iguales al pallet actual entran, respetando medidas/altura/peso.
            </p>

            {capacidadCamion && (
              <div className="text-xs text-slate-600 space-y-1">
                <div>Cap. máx geométrica: <b>{capacidadCamion.maxPorGeometria}</b></div>
                <div>Cap. máx por peso: <b>{capacidadCamion.maxPorPeso}</b></div>
                <div>Capacidad máx final: <b>{capacidadCamion.max}</b></div>
                <div>A {ocupacionObjetivoPct}%: <b>{palletsCapacidadPct}</b> pallets</div>
                {capacidadCamion.motivo ? (
                  <div className="text-amber-700">{capacidadCamion.motivo}</div>
                ) : null}
              </div>
            )}
          </div>
        )}


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
