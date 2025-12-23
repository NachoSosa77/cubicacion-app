"use client";

import { CubicacionPalletViewer3D } from "@/app/cubicacion/components/CubicacionPalletViewer3D";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";


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
    cajasPorCapa: number;
    capas: number;
    ocupacionBasePct: number;
    ocupacionVolumenPct: number;
    pesoTotalKg: number;
    alturaTotalM: number;
    warnings: string[];
    placements: Placement[];
    palletDimMm: DimMm;
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
  items: Array<{
    id: number;
    tipoProductoId: number;
    cantidad_unidades: number;
    volumen_total_m3: number;
    dim_unidad_mm?: any | null;
    peso_unidad_kg?: number | null;

    tipoProducto: {
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
type Objective = "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";

interface Props {
  lote: ClientLote;
  contenedores: ClientContenedor[];

  // ✅ Preview: NO guarda
  onPreview: (params: {
    tipoContenedorId: number;
    mixPolicy: MixPolicy;
    objective: Objective;
  }) => Promise<{ plan: PalletPlanResult }>;

  // ✅ Guardar: persiste el plan ya calculado
  onGuardar: (params: {
    tipoContenedorId: number;
    mixPolicy: MixPolicy;
    objective: Objective;
    plan: unknown; // lo serializás en server
  }) => Promise<{ palletPlanId: number }>;
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

/* =========================
   Component
========================= */

export function PalletClient({ lote, contenedores, onPreview, onGuardar }: Props) {
  const router = useRouter();
  const [tipoContenedorId, setTipoContenedorId] = useState<number | "">("");
  const [mixPolicy, setMixPolicy] = useState<MixPolicy>("PERMITIR_MEZCLA");
  const [objective, setObjective] = useState<Objective>("OPERATIVO_ESTABLE");

  const [result, setResult] = useState<PalletPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPendingPreview, startPreview] = useTransition();
  const [isPendingSave, startSave] = useTransition();
  const [savedId, setSavedId] = useState<number | null>(null);

  const contenedorSeleccionado = useMemo(() => {
    if (!tipoContenedorId) return null;
    return contenedores.find((c) => c.id === tipoContenedorId) ?? null;
  }, [tipoContenedorId, contenedores]);

  const loteResumen = useMemo(() => {
    return lote.items.map((it) => {
      const unPorBulto = safeNumber(it.tipoProducto.unidad_entra_por_bulto, 0);
      const bultosEstimados =
        unPorBulto > 0 ? ceilDiv(it.cantidad_unidades, unPorBulto) : 0;

      const dimBultoStd = {
        largo: safeNumber(it.tipoProducto.largo_por_bulto, 0),
        ancho: safeNumber(it.tipoProducto.ancho_por_bulto, 0),
        alto: safeNumber(it.tipoProducto.alto_por_bulto, 0),
      };

      return {
        id: it.id,
        codigo: it.tipoProducto.codigo,
        descripcion: it.tipoProducto.descripcion,
        cantidadUnidades: it.cantidad_unidades,
        unPorBulto,
        bultosEstimados,
        volumenTotalM3: it.volumen_total_m3,
        dimBultoStd,
      };
    });
  }, [lote.items]);

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

    return {
      tipoContenedorId: Number(tipoContenedorId),
      mixPolicy,
      objective,
    };
  };

  /* =========================
     Handlers
  ========================= */

  const handlePreview = () => {
    const form = validateForm();
    if (!form) return;

    // al previsualizar, limpiamos resultado anterior para evitar confusión
    setResult(null);

    startPreview(async () => {
      try {
        const res = await onPreview(form);
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
      const res = await onGuardar({
        ...form,
        plan: result,
      });

      setSavedId(res.palletPlanId);

      // ✅ navegación automática a la vista de camión
      router.push(`/cubicacion/camion/${lote.id}`);
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el plan de pallet.");
    }
  });
};

  /* =========================
     Render
  ========================= */

  return (
    <section className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      {/* Header */}
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">Cubicación en pallet</h2>
        <p className="text-sm text-slate-600">
          Previsualizá el layout 3D y guardalo cuando estés conforme.
        </p>
      </header>

      {/* Lote info */}
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-800">Lote #{lote.id}</p>
        {lote.descripcion && <p className="text-slate-600 mt-1">{lote.descripcion}</p>}

        <ul className="mt-2 list-disc pl-5 text-slate-700 text-xs space-y-1">
          {loteResumen.map((it) => (
            <li key={it.id}>
              <span className="font-medium">{it.codigo}</span>
              {" — "}
              {it.cantidadUnidades} un
              {it.unPorBulto > 0 ? (
                <>
                  {" ("}
                  {it.bultosEstimados} bultos estimados · {it.unPorBulto} un/bulto ·{" "}
                  {formatDimMm(it.dimBultoStd)}
                  {")"}
                </>
              ) : (
                <span className="text-slate-500"> (sin unidad_entra_por_bulto)</span>
              )}
              {" — "}
              {it.volumenTotalM3.toFixed(4)} m³
            </li>
          ))}
        </ul>
      </div>

      {/* Configuración */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Contenedor */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Tipo de pallet / contenedor
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={tipoContenedorId}
            onChange={(e) =>
              setTipoContenedorId(e.target.value === "" ? "" : Number(e.target.value))
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
            <p className="text-xs text-slate-500 mt-1">
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
          )}
        </div>

        {/* Mezcla */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Mezcla de productos</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={mixPolicy}
            onChange={(e) => setMixPolicy(e.target.value as MixPolicy)}
          >
            <option value="PERMITIR_MEZCLA">Permitir mezcla</option>
            <option value="NO_MEZCLAR">No mezclar (1 SKU por pallet)</option>
          </select>
        </div>

        {/* Objetivo */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Objetivo de cubicación</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={objective}
            onChange={(e) => setObjective(e.target.value as Objective)}
          >
            <option value="OPERATIVO_ESTABLE">Operativo / estable</option>
            <option value="OPTIMIZAR_VOLUMEN">Optimizar volumen</option>
            <option value="CUIDADO_PRODUCTO">Cuidado del producto</option>
          </select>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPendingPreview || isPendingSave}
          className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPendingPreview ? "Calculando..." : "Previsualizar"}
        </button>

        <button
          type="button"
          onClick={handleGuardar}
          disabled={!result || isPendingPreview || isPendingSave}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPendingSave ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* Status guardado */}
      {savedId != null && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Guardado OK. PalletPlan ID: <span className="font-semibold">{savedId}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 p-3 text-sm text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-slate-500">Cajas en pallet #1</p>
              <p className="font-semibold text-lg">{result.pallet1.cajasTotales}</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-slate-500">Capas</p>
              <p className="font-semibold text-lg">{result.pallet1.capas}</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-slate-500">Ocupación volumen</p>
              <p className="font-semibold text-lg">
                {result.pallet1.ocupacionVolumenPct.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-slate-500">Peso total</p>
              <p className="font-semibold text-lg">{result.pallet1.pesoTotalKg.toFixed(1)} kg</p>
            </div>
          </div>

          {/* Warnings */}
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

          {/* Viewer */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Previsualización 3D — Pallet #1
            </p>

            <CubicacionPalletViewer3D
              palletDimMm={result.pallet1.palletDimMm}
              placements={result.pallet1.placements}
            />

            <p className="text-xs text-slate-500">
              La visualización representa el layout calculado para el primer pallet.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
