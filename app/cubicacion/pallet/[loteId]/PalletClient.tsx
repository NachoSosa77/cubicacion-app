"use client";

import { CubicacionPalletViewer3D } from "@/app/cubicacion/components/CubicacionPalletViewer3D";
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

      // Para poder estimar bultos y mostrar dims estándar
      unidad_entra_por_bulto: number;
      largo_por_bulto: number;
      ancho_por_bulto: number;
      alto_por_bulto: number;
    };
  }>;
};

interface Props {
  lote: ClientLote;
  contenedores: ClientContenedor[];
  onEvaluar: (params: {
    tipoContenedorId: number;
    mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
    objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  }) => Promise<{ plan: PalletPlanResult }>;
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

export function PalletClient({ lote, contenedores, onEvaluar }: Props) {
  const [tipoContenedorId, setTipoContenedorId] = useState<number | "">("");
  const [mixPolicy, setMixPolicy] =
    useState<"NO_MEZCLAR" | "PERMITIR_MEZCLA">("PERMITIR_MEZCLA");
  const [objective, setObjective] =
    useState<"OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO">(
      "OPERATIVO_ESTABLE"
    );

  const [result, setResult] = useState<PalletPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const contenedorSeleccionado = useMemo(() => {
    if (!tipoContenedorId) return null;
    return contenedores.find((c) => c.id === tipoContenedorId) ?? null;
  }, [tipoContenedorId, contenedores]);

  const loteResumen = useMemo(() => {
    return lote.items.map((it) => {
      const unPorBulto = safeNumber(it.tipoProducto.unidad_entra_por_bulto, 0);
      const bultosEstimados = unPorBulto > 0 ? ceilDiv(it.cantidad_unidades, unPorBulto) : 0;

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
     Handlers
  ========================= */

  const handleEvaluar = () => {
    setError(null);
    setResult(null);

    if (!tipoContenedorId) {
      setError("Seleccioná un tipo de pallet / contenedor.");
      return;
    }

    const c = contenedorSeleccionado;
    if (!c) {
      setError("Contenedor inválido.");
      return;
    }

    // Validación defensiva (tu schema permite null)
    if (!c.largo_mts || !c.ancho_mts || !c.alto_mts) {
      setError(
        "El contenedor seleccionado no tiene dimensiones completas (largo/ancho/alto). Completá esos datos para poder calcular."
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await onEvaluar({
          tipoContenedorId: Number(tipoContenedorId),
          mixPolicy,
          objective,
        });

        setResult(res.plan);
      } catch (e) {
        console.error(e);
        setError("No se pudo calcular la cubicación en pallet.");
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
          A partir del lote, el sistema calcula un layout de pallet para los ítems cargados.
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
          <label className="text-sm font-medium text-slate-700">Tipo de pallet / contenedor</label>
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
              {contenedorSeleccionado.largo_mts && contenedorSeleccionado.ancho_mts && contenedorSeleccionado.alto_mts
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
            onChange={(e) => setMixPolicy(e.target.value as "NO_MEZCLAR" | "PERMITIR_MEZCLA")}
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
            onChange={(e) =>
              setObjective(
                e.target.value as "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO"
              )
            }
          >
            <option value="OPERATIVO_ESTABLE">Operativo / estable</option>
            <option value="OPTIMIZAR_VOLUMEN">Optimizar volumen</option>
            <option value="CUIDADO_PRODUCTO">Cuidado del producto</option>
          </select>
        </div>
      </div>

      {/* Acción */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleEvaluar}
          disabled={isPending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
        >
          {isPending ? "Calculando..." : "Evaluar pallet"}
        </button>
      </div>

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
              <p className="font-semibold text-lg">{result.pallet1.ocupacionVolumenPct.toFixed(1)}%</p>
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
            <p className="text-sm font-medium text-slate-700">Previsualización 3D — Pallet #1</p>

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
