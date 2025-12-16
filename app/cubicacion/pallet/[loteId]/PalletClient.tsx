"use client";

import { CubicacionPalletViewer3D } from "@/app/cubicacion/components/CubicacionPalletViewer3D";
import { useState, useTransition } from "react";

/* =========================
   Types (plain, client-safe)
========================= */

type DimMm = {
  largo: number;
  ancho: number;
  alto: number;
};

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

interface Props {
  lote: {
    id: number;
    descripcion?: string | null;
    items: {
      id: number;
      cantidad_bultos: number;
      tipoProducto: {
        id: number;
        codigo: string;
        descripcion: string;
      };
    }[];
  };

  contenedores: {
    id: number;
    codigo: string;
    descripcion: string;
    largo_mts: number;
    ancho_mts: number;
    alto_mts: number;
    peso_max_kg: number;
  }[];

  onEvaluar: (params: {
    tipoContenedorId: number;
    mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";
    objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";
  }) => Promise<{
    plan: PalletPlanResult;
  }>;
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
        <h2 className="text-xl font-semibold text-slate-900">
          Cubicación en pallet
        </h2>
        <p className="text-sm text-slate-600">
          A partir de los bultos ya armados, el sistema calcula la mejor forma de
          acomodarlos en un pallet.
        </p>
      </header>

      {/* Lote info */}
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-800">Lote #{lote.id}</p>
        {lote.descripcion && (
          <p className="text-slate-600 mt-1">{lote.descripcion}</p>
        )}

        <ul className="mt-2 list-disc pl-5 text-slate-700 text-xs space-y-1">
          {lote.items.map((it) => (
            <li key={it.id}>
              {it.tipoProducto.codigo} — {it.cantidad_bultos} bultos
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
              setTipoContenedorId(
                e.target.value === "" ? "" : Number(e.target.value)
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
        </div>

        {/* Mezcla */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Mezcla de productos
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={mixPolicy}
            onChange={(e) =>
              setMixPolicy(e.target.value as "NO_MEZCLAR" | "PERMITIR_MEZCLA")
            }
          >
            <option value="PERMITIR_MEZCLA">Permitir mezcla</option>
            <option value="NO_MEZCLAR">No mezclar (1 SKU por pallet)</option>
          </select>
        </div>

        {/* Objetivo */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Objetivo de cubicación
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={objective}
            onChange={(e) =>
              setObjective(
                e.target.value as
                  | "OPERATIVO_ESTABLE"
                  | "OPTIMIZAR_VOLUMEN"
                  | "CUIDADO_PRODUCTO"
              )
            }
          >
            <option value="OPERATIVO_ESTABLE">
              Operativo / estable (capas homogéneas)
            </option>
            <option value="OPTIMIZAR_VOLUMEN">
              Optimizar volumen (mayor ocupación)
            </option>
            <option value="CUIDADO_PRODUCTO">
              Cuidado del producto (pesados abajo)
            </option>
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
              <p className="font-semibold text-lg">
                {result.pallet1.cajasTotales}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-slate-500">Capas</p>
              <p className="font-semibold text-lg">
                {result.pallet1.capas}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-slate-500">Ocupación volumen</p>
              <p className="font-semibold text-lg">
                {result.pallet1.ocupacionVolumenPct.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-slate-500">Peso total</p>
              <p className="font-semibold text-lg">
                {result.pallet1.pesoTotalKg.toFixed(1)} kg
              </p>
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
              La visualización representa el layout real calculado para el primer
              pallet.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
