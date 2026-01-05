"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CubicacionCamionViewer3D } from "../../components/CubicacionCamionViewer3D";

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

type VarianteKey = "A" | "B" | "C";

type PreviewResponse = {
  recommended: VarianteKey;
  plans: Record<VarianteKey, CamionPlanResult>;
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
   Helpers
========================= */

const STRATEGY_LABEL: Record<VarianteKey, string> = {
  A: "Operativo / estable",
  B: "Optimizar ocupación",
  C: "Descarga rápida",
};

const STRATEGY_DESC: Record<VarianteKey, string> = {
  A: "Layout simple y estable. Prioriza orden y facilidad operativa.",
  B: "Maximiza la ocupación del camión. Ideal para reducir viajes.",
  C: "Optimiza el orden de descarga. Mejora tiempos en destino.",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

/* =========================
   Component
========================= */

export function CamionClient({
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
    strategy: VarianteKey;
    plan: CamionPlanResult;
  }) => Promise<{ camionPlanId: number }>;
}) {
  const router = useRouter();

  const [transporteId, setTransporteId] = useState<number | "">("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selected, setSelected] = useState<VarianteKey>("A");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modoSimulacion, setModoSimulacion] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [isSaving, startSave] = useTransition();

  const transporteSel = useMemo(() => {
    if (!transporteId) return null;
    return transportes.find((t) => t.id === transporteId) ?? null;
  }, [transporteId, transportes]);

  const activePlan = preview?.plans[selected];
  const hasPallets = (palletSummary?.palletsGuardados ?? 0) > 0;

  /* =========================
     Actions
  ========================= */

  const handlePreview = () => {
    setError(null);
    setMensaje(null);
    setPreview(null);

    if (!hasPallets) {
      return setError(
        "Este lote no tiene planes de pallet guardados. Primero evaluá y guardá pallets."
      );
    }

    if (!transporteId) return setError("Seleccioná un transporte.");
    if (!transporteSel) return setError("Transporte inválido.");

    startTransition(async () => {
      try {
        const res = await onPreview({ transporteId: Number(transporteId) });
        setPreview(res);
        setSelected(res.recommended);
      } catch (e) {
        console.error(e);
        setError("No se pudo calcular la cubicación en camión.");
      }
    });
  };

  const handleGuardar = () => {
    if (!activePlan || !transporteId) return;

    setError(null);
    setMensaje(null);

    if (modoSimulacion) {
      setMensaje(
        "Simulación realizada. La estrategia elegida no se guardó en la base."
      );
      return;
    }

    startSave(async () => {
      try {
        const res = await onGuardar({
          transporteId: Number(transporteId),
          strategy: selected,
          plan: activePlan,
        });

        router.push(`/cubicacion/camion/camion-plan/${res.camionPlanId}`);
      } catch (e) {
        console.error(e);
        setError("No se pudo guardar la cubicación en camión.");
      }
    });
  };

  /* =========================
     Render
  ========================= */

  return (
    <section className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">
          Cubicación en camión
        </h2>
        <p className="text-sm text-slate-600">
          Compará distintas estrategias y elegí la mejor opción.
        </p>
      </header>

      <div className="flex flex-col gap-1 rounded-md border border-dashed border-indigo-200 bg-indigo-50 p-3 text-sm">
        <label className="inline-flex items-center gap-2 font-medium text-indigo-900">
          <input
            type="checkbox"
            checked={modoSimulacion}
            onChange={(e) => setModoSimulacion(e.target.checked)}
          />
          Activar modo simulación (pallet → camión)
        </label>
        <p className="text-xs text-indigo-800">
          Probá distintas estrategias sin generar un plan definitivo. El modo
          simulación te deja previsualizar y comunicar la opción elegida sin
          guardarla.
        </p>
      </div>

      {/* Lote */}
      <div className="rounded-md border bg-slate-50 p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold text-slate-900">Lote #{lote.id}</p>

            {lote.descripcion ? (
              <p className="text-slate-700">{lote.descripcion}</p>
            ) : (
              <p className="text-slate-500 italic">Sin descripción.</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs text-slate-700">
                Empresa: <span className="ml-1 font-semibold">{lote.empresaId}</span>
              </span>

              {lote.tipoBulto && (
                <span className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs text-slate-700">
                  Tipo bulto: <span className="ml-1 font-semibold">{lote.tipoBulto}</span>
                </span>
              )}

              {!hasPallets ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                  Sin pallets guardados
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                  Pallets listos para evaluar
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              Última actualización:{" "}
              <span className="text-slate-700">
                {formatDateTime(palletSummary.lastUpdatedAt)}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border bg-white px-3 py-2">
              <p className="text-xs text-slate-500">Pallets guardados</p>
              <p className="text-base font-semibold text-slate-900">
                {palletSummary.palletsGuardados}
              </p>
            </div>

            <div className="rounded-md border bg-white px-3 py-2">
              <p className="text-xs text-slate-500">Peso estimado</p>
              <p className="text-base font-semibold text-slate-900">
                {palletSummary.palletsGuardados > 0
                  ? `${palletSummary.pesoEstimadoKg.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transporte */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Transporte
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={transporteId}
            onChange={(e) =>
              setTransporteId(e.target.value === "" ? "" : Number(e.target.value))
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

        <div className="flex items-end justify-end gap-2">
          <button
            onClick={handlePreview}
            disabled={isPending || !hasPallets}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
          >
            {isPending ? "Calculando..." : "Evaluar camión"}
          </button>

          {preview && activePlan && (
            <button
              onClick={handleGuardar}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md disabled:opacity-50"
            >
              {isSaving
                ? "Guardando..."
                : modoSimulacion
                ? "Simular (no guarda)"
                : "Guardar opción"}
            </button>
          )}
        </div>
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

      {/* Resultados */}
      {preview && activePlan && (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(preview.plans) as VarianteKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={`px-3 py-1 rounded-md text-sm border ${
                  selected === k
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-700"
                }`}
              >
                {STRATEGY_LABEL[k]}
                {preview.recommended === k && (
                  <span className="ml-2 text-xs bg-emerald-500 text-white px-2 rounded">
                    Recomendada
                  </span>
                )}
              </button>
            ))}
          </div>

          <p className="text-sm text-slate-600">{STRATEGY_DESC[selected]}</p>

          <CubicacionCamionViewer3D
            camionDimMm={activePlan.camionDimMm}
            placements={activePlan.placements}
          />
        </>
      )}
    </section>
  );
}
