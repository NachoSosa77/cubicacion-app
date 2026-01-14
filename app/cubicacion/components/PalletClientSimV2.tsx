"use client";

import { CubicacionPalletViewer3D } from "@/app/cubicacion/components/CubicacionPalletViewer3D";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

// server actions
import { guardarPalletPlan } from "../actions/guardarPalletPlan";
import { previewPalletPlan } from "../actions/previewPalletPlan";
import { BultoSimSnapshot } from "../simulacion/types/types";

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
type Objective = "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";

interface Props {
  empresaId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
  bultoSnap: BultoSimSnapshot | null;
  onSaved?: (palletPlanId: number) => void; // ✅
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

function mmToM(mm: number) {
  return (mm / 1000).toFixed(3);
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

  const [result, setResult] = useState<PalletPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPendingPreview, startPreview] = useTransition();
  const [isPendingSave, startSave] = useTransition();
  const [savedId, setSavedId] = useState<number | null>(null);

  const [showLoteDetalle, setShowLoteDetalle] = useState<boolean>(false);

  const contenedorSeleccionado = useMemo(() => {
    if (!tipoContenedorId) return null;
    return contenedores.find((c) => c.id === tipoContenedorId) ?? null;
  }, [tipoContenedorId, contenedores]);

  const loteResumen = useMemo(() => {
    return lote.items.map((it) => {
      const unPorBultoSnapshot =
        it.unidades_por_bulto != null && Number(it.unidades_por_bulto) > 0
          ? Number(it.unidades_por_bulto)
          : null;

      const unPorBultoFallback = safeNumber(
        it.tipo_producto.unidad_entra_por_bulto,
        0
      );
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
      empresaId,
      loteId: lote.id,
      tipoContenedorId: Number(tipoContenedorId),
      mixPolicy,
      objective,
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

        // ✅ quedate en simulación 
        setSavedId(res.palletPlanId);
        onSaved?.(res.palletPlanId);

        // opcional: refrescar data sin navegar
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

  /* =========================
     Render
  ========================= */

  return (
    <section className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">
          Cubicación en pallet
        </h2>
        <p className="text-sm text-slate-600">
          Previsualizá el layout 3D y guardalo cuando estés conforme.
        </p>
      </header>

      {/* Lote info (snapshot) — compacto */}
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-800">Lote #{lote.id}</p>
            {lote.descripcion ? (
              <p className="text-slate-600 mt-1">{lote.descripcion}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-700 px-2 py-1 rounded-full bg-white border">
              Snapshot: {safeNumber(lote.unidades_totales, 0)} un ·{" "}
              {safeNumber(lote.bultos_totales, 0)} bultos
            </span>

            <button
              type="button"
              onClick={() => setShowLoteDetalle((v) => !v)}
              className="text-xs px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50"
            >
              {showLoteDetalle ? "Ocultar detalle" : "Ver detalle"}
            </button>
          </div>
        </div>

        {showLoteDetalle && (
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
        )}
      </div>

      {/* Configuración */}
      <div className="grid gap-4 md:grid-cols-3">
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

          {contenedorSeleccionado && (
            <div className="text-xs text-slate-500 mt-1 space-y-1">
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

              {result?.pallet1?.referencias ? (
                <p className="text-slate-600">
                  Altura física:{" "}
                  {mmToM(result.pallet1.referencias.alturaFisicaMm)} m · Altura
                  útil: {mmToM(result.pallet1.referencias.alturaUtilMm)} m ·
                  Altura usada:{" "}
                  {mmToM(result.pallet1.referencias.alturaUsadaMm)} m
                </p>
              ) : null}

              {result?.pallet1?.referencias &&
              result.pallet1.referencias.alturaUtilMm <
                result.pallet1.referencias.alturaFisicaMm ? (
                <p className="text-slate-500">
                  Nota: la altura útil puede limitarse por reglas operativas.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Mezcla de productos
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={mixPolicy}
            onChange={(e) => setMixPolicy(e.target.value as MixPolicy)}
          >
            <option value="PERMITIR_MEZCLA">Permitir mezcla</option>
            <option value="NO_MEZCLAR">No mezclar (1 SKU por pallet)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Objetivo de cubicación
          </label>
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
          onClick={handleCompareMix}
          disabled={isPendingPreview || isPendingSave}
          className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          {isPendingPreview ? "Calculando..." : "Comparar mezcla"}
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

      {/* Resultado */}
      {result &&
        (() => {
          const capacidadTotal = Math.max(1, result.pallet1.cajasTotales);
          const progresoUnidades = Math.min(
            100,
            (result.pallet1.unidadesColocadas / capacidadTotal) * 100
          );
          const ocupacionLibrePct = Math.max(
            0,
            100 - result.pallet1.ocupacionLogradaPct
          );

          return (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-5 text-sm">
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-slate-500">Bultos colocados</p>
                  <p className="font-semibold text-lg">
                    {result.pallet1.unidadesColocadas}
                  </p>
                  <p className="text-xs text-slate-500">
                    Capacidad calculada: {result.pallet1.cajasTotales}
                  </p>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${progresoUnidades}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-slate-500">Capas</p>
                  <p className="font-semibold text-lg">
                    {result.pallet1.capas}
                  </p>
                  <p className="text-xs text-slate-500">
                    {result.pallet1.cajasPorCapa} cajas por capa (máx.)
                  </p>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-slate-500">
                    Ocupación volumen (altura usada)
                  </p>
                  <p className="font-semibold text-lg">
                    {result.pallet1.ocupacionVolumenPct.toFixed(1)}%
                  </p>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{
                        width: `${Math.min(
                          100,
                          result.pallet1.ocupacionVolumenPct
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-slate-500">Ocupación total del pallet</p>
                  <p className="font-semibold text-lg">
                    {result.pallet1.ocupacionLogradaPct.toFixed(1)}%
                  </p>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500"
                      style={{
                        width: `${Math.min(
                          100,
                          result.pallet1.ocupacionLogradaPct
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Referencia: volumen completo del pallet.
                  </p>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-slate-500">Peso total</p>
                  <p className="font-semibold text-lg">
                    {result.pallet1.pesoTotalKg.toFixed(1)} kg
                  </p>
                  <p className="text-xs text-slate-500">
                    Altura usada: {result.pallet1.alturaTotalM.toFixed(3)} m
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-slate-500">Volumen libre estimado</p>
                  <p className="font-semibold text-lg">
                    {formatVolumenMm3ToM3(result.pallet1.volumenLibreMm3)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Aproximadamente {ocupacionLibrePct.toFixed(1)}% del pallet
                    queda disponible.
                  </p>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-slate-400"
                      style={{ width: `${Math.min(100, ocupacionLibrePct)}%` }}
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

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Previsualización 3D — Pallet #1
                </p>

                <CubicacionPalletViewer3D
                  palletDimMm={result.pallet1.palletDimMm}
                  placements={result.pallet1.placements}
                />

                <p className="text-xs text-slate-500">
                  La visualización representa el layout calculado para el primer
                  pallet.
                </p>
              </div>
            </div>
          );
        })()}
    </section>
  );
}
