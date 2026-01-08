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
    referencias: {
      alturaFisicaMm: number;
      alturaUtilMm: number;
      alturaUsadaMm: number;
      volumenMaxMm3: number;
      volumenUsadoAlturaMm3: number;
      volumenCajasMm3: number;
      objetivoOcupacion01?: number | null;
      objetivoUnidades?: number | null;
      modoSimulacion: boolean;
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
    objetivoUnidades?: number;
    objetivoOcupacion?: number;
    modoSimulacion?: boolean;
  }) => Promise<{ plan: PalletPlanResult }>;

  // ✅ Guardar: persiste el plan ya calculado
  onGuardar: (params: {
    tipoContenedorId: number;
    mixPolicy: MixPolicy;
    objective: Objective;
    objetivoUnidades?: number;
    objetivoOcupacion?: number;
    modoSimulacion?: boolean;
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

function formatVolumenMm3ToM3(volumenMm3: number) {
  return `${(volumenMm3 / 1_000_000_000).toFixed(3)} m³`;
}

function mmToM(mm: number) {
  return (mm / 1000).toFixed(3);
}

/* =========================
   Component
========================= */

export function PalletClient({
  lote,
  contenedores,
  onPreview,
  onGuardar,
}: Props) {
  const router = useRouter();
  const [tipoContenedorId, setTipoContenedorId] = useState<number | "">("");
  const [mixPolicy, setMixPolicy] = useState<MixPolicy>("PERMITIR_MEZCLA");
  const [objective, setObjective] = useState<Objective>("OPERATIVO_ESTABLE");
  const [modoSimulacion, setModoSimulacion] = useState<boolean>(false);
  const [objetivoUnidades, setObjetivoUnidades] = useState<string>("");
  const [objetivoOcupacion, setObjetivoOcupacion] = useState<string>("");

  const [result, setResult] = useState<PalletPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPendingPreview, startPreview] = useTransition();
  const [isPendingSave, startSave] = useTransition();
  const [savedId, setSavedId] = useState<number | null>(null);

  const contenedorSeleccionado = useMemo(() => {
    if (!tipoContenedorId) return null;
    return contenedores.find((c) => c.id === tipoContenedorId) ?? null;
  }, [tipoContenedorId, contenedores]);

  const [compare, setCompare] = useState<{
    off: PalletPlanResult | null;
    on: PalletPlanResult | null;
  }>(() => ({ off: null, on: null }));

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

  const simulacionActiva =
    modoSimulacion &&
    (objetivoUnidades.trim() !== "" || objetivoOcupacion.trim() !== "");

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

    const objetivoUnidadesNum = objetivoUnidades.trim()
      ? Number(objetivoUnidades)
      : undefined;
    if (
      objetivoUnidadesNum !== undefined &&
      !Number.isFinite(objetivoUnidadesNum)
    ) {
      setError("Indicá un número válido en unidades deseadas.");
      return null;
    }

    const objetivoOcupacionPct = objetivoOcupacion.trim()
      ? Number(objetivoOcupacion)
      : undefined;
    if (
      objetivoOcupacionPct !== undefined &&
      (!Number.isFinite(objetivoOcupacionPct) ||
        objetivoOcupacionPct < 0 ||
        objetivoOcupacionPct > 100)
    ) {
      setError("El % de ocupación deseada debe estar entre 0 y 100.");
      return null;
    }

    return {
      tipoContenedorId: Number(tipoContenedorId),
      mixPolicy,
      objective,
      modoSimulacion,
      objetivoUnidades:
        modoSimulacion && objetivoUnidadesNum && objetivoUnidadesNum > 0
          ? objetivoUnidadesNum
          : undefined,
      objetivoOcupacion:
        modoSimulacion && objetivoOcupacionPct !== undefined
          ? objetivoOcupacionPct / 100
          : undefined,
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

  const handleCompareMix = () => {
    const form = validateForm();
    if (!form) return;

    // limpiamos comparación previa
    setCompare({ off: null, on: null });

    startPreview(async () => {
      try {
        // 1) OFF
        const offRes = await onPreview({
          ...form,
          mixPolicy: "NO_MEZCLAR",
        });

        // 2) ON
        const onRes = await onPreview({
          ...form,
          mixPolicy: "PERMITIR_MEZCLA",
        });

        setCompare({ off: offRes.plan, on: onRes.plan });

        // opcional: dejar como "result" el mejor (por ocupación total)
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
      {/* Header */}
      <header className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">
          Cubicación en pallet
        </h2>
        <p className="text-sm text-slate-600">
          Previsualizá el layout 3D y guardalo cuando estés conforme.
        </p>
      </header>

      {/* Lote info */}
      <div className="rounded-md border bg-slate-50 p-3 text-sm">
        <p className="font-semibold text-slate-800">Lote #{lote.id}</p>
        {lote.descripcion && (
          <p className="text-slate-600 mt-1">{lote.descripcion}</p>
        )}

        <ul className="mt-2 list-disc pl-5 text-slate-700 text-xs space-y-1">
          {loteResumen.map((it) => (
            <li key={it.id}>
              <span className="font-medium">{it.codigo}</span>
              {" — "}
              {it.cantidadUnidades} un
              {it.unPorBulto > 0 ? (
                <>
                  {" ("}
                  {it.bultosEstimados} bultos estimados · {it.unPorBulto}{" "}
                  un/bulto · {formatDimMm(it.dimBultoStd)}
                  {")"}
                </>
              ) : (
                <span className="text-slate-500">
                  {" "}
                  (sin unidad_entra_por_bulto)
                </span>
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

              {/* ✅ Bonus opcional: solo si ya hay resultado */}
              {result?.pallet1?.referencias && (
                <p className="text-slate-600">
                  Altura física:{" "}
                  {mmToM(result.pallet1.referencias.alturaFisicaMm)} m · Altura
                  útil: {mmToM(result.pallet1.referencias.alturaUtilMm)} m ·
                  Altura usada:{" "}
                  {mmToM(result.pallet1.referencias.alturaUsadaMm)} m
                </p>
              )}

              {/* ✅ Si querés remarcar cuando hay regla */}
              {result?.pallet1?.referencias &&
                result.pallet1.referencias.alturaUtilMm <
                  result.pallet1.referencias.alturaFisicaMm && (
                  <p className="text-slate-500">
                    Nota: la altura útil puede limitarse por reglas operativas.
                  </p>
                )}
            </div>
          )}
        </div>

        {/* Mezcla */}
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

        {/* Objetivo */}
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

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Modo simulación
          </label>
          <div className="flex items-center gap-2">
            <input
              id="modo-simulacion"
              type="checkbox"
              className="h-4 w-4"
              checked={modoSimulacion}
              onChange={(e) => setModoSimulacion(e.target.checked)}
            />
            <label htmlFor="modo-simulacion" className="text-sm text-slate-700">
              Limitar por objetivo sin perder el cálculo máximo por defecto.
            </label>
          </div>
          <p className="text-xs text-slate-500">
            Activá esta opción para simular un pallet parcial. Si la dejás
            apagada, el cálculo se mantiene como hasta ahora.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Unidades deseadas (Bultos)
          </label>
          <input
            type="number"
            min={0}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Ej: 40"
            value={objetivoUnidades}
            onChange={(e) => setObjetivoUnidades(e.target.value)}
            disabled={!modoSimulacion}
          />
          <p className="text-xs text-slate-500">
            Si completás este campo se detendrá la colocación cuando se alcance
            este número de bultos.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            % ocupación deseada (0-100)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Ej: 80"
            value={objetivoOcupacion}
            onChange={(e) => setObjetivoOcupacion(e.target.value)}
            disabled={!modoSimulacion}
          />
          <p className="text-xs text-slate-500">
            El objetivo de ocupación se calcula sobre el volumen completo del
            pallet y es opcional.
          </p>
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
          {isPendingPreview ? "Calculando..." : "Comparar ON/OFF"}
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
          Guardado OK. PalletPlan ID:{" "}
          <span className="font-semibold">{savedId}</span>
        </div>
      )}

      {/* Error */}
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
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                  {simulacionActiva
                    ? "Simulación activada: usando objetivos opcionales"
                    : "Modo estándar: calcula capacidad máxima"}
                </span>
              </div>

              {/* KPIs */}
              <div className="grid gap-3 md:grid-cols-5 text-sm">
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-slate-500">Bultos colocados</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      Simulación
                    </span>
                  </div>
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
                    Se mantiene la estimación base; la simulación no altera la
                    propuesta máxima.
                  </p>
                </div>
              </div>

              {compare.off &&
                compare.on &&
                (() => {
                  const off = compare.off.pallet1;
                  const on = compare.on.pallet1;

                  const delta = (a: number, b: number) => b - a;

                  return (
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-800">
                          Comparación mezcla: OFF vs ON
                        </h3>
                        <p className="text-xs text-slate-500">
                          Mismos parámetros, solo cambia la política de mezcla.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 text-sm">
                        {/* OFF */}
                        <div className="rounded-md border p-3">
                          <p className="text-slate-500 text-xs mb-2">
                            OFF — No mezclar (1 SKU por pallet)
                          </p>

                          <ul className="space-y-1">
                            <li>
                              <span className="text-slate-500">Pallets:</span>{" "}
                              <span className="font-medium">
                                {compare.off.palletsRequeridos}
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">
                                Ocupación total:
                              </span>{" "}
                              <span className="font-medium">
                                {off.ocupacionLogradaPct.toFixed(1)}%
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">
                                Ocupación altura usada:
                              </span>{" "}
                              <span className="font-medium">
                                {off.ocupacionVolumenPct.toFixed(1)}%
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">Unidades:</span>{" "}
                              <span className="font-medium">
                                {off.unidadesColocadas}
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">
                                Altura usada:
                              </span>{" "}
                              <span className="font-medium">
                                {off.alturaTotalM.toFixed(3)} m
                              </span>
                            </li>
                          </ul>

                          {off.warnings?.length > 0 && (
                            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                              <p className="font-semibold mb-1">Warnings</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                {off.warnings.slice(0, 3).map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                              {off.warnings.length > 3 && (
                                <p className="mt-1 text-amber-700">
                                  +{off.warnings.length - 3} más…
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ON */}
                        <div className="rounded-md border p-3">
                          <p className="text-slate-500 text-xs mb-2">
                            ON — Permitir mezcla
                          </p>

                          <ul className="space-y-1">
                            <li>
                              <span className="text-slate-500">Pallets:</span>{" "}
                              <span className="font-medium">
                                {compare.on.palletsRequeridos}
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">
                                Ocupación total:
                              </span>{" "}
                              <span className="font-medium">
                                {on.ocupacionLogradaPct.toFixed(1)}%
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">
                                Ocupación altura usada:
                              </span>{" "}
                              <span className="font-medium">
                                {on.ocupacionVolumenPct.toFixed(1)}%
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">Unidades:</span>{" "}
                              <span className="font-medium">
                                {on.unidadesColocadas}
                              </span>
                            </li>
                            <li>
                              <span className="text-slate-500">
                                Altura usada:
                              </span>{" "}
                              <span className="font-medium">
                                {on.alturaTotalM.toFixed(3)} m
                              </span>
                            </li>
                          </ul>

                          {on.warnings?.length > 0 && (
                            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                              <p className="font-semibold mb-1">Warnings</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                {on.warnings.slice(0, 3).map((w, i) => (
                                  <li key={i}>{w}</li>
                                ))}
                              </ul>
                              {on.warnings.length > 3 && (
                                <p className="mt-1 text-amber-700">
                                  +{on.warnings.length - 3} más…
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Delta */}
                      <div className="text-xs text-slate-700 bg-slate-50 border rounded p-3">
                        <p className="font-semibold mb-2">
                          Diferencia (ON - OFF)
                        </p>
                        <ul className="grid gap-1 md:grid-cols-2">
                          <li>
                            Δ Pallets:{" "}
                            <span className="font-medium">
                              {delta(
                                compare.off.palletsRequeridos,
                                compare.on.palletsRequeridos
                              )}
                            </span>
                          </li>
                          <li>
                            Δ Ocupación total:{" "}
                            <span className="font-medium">
                              {delta(
                                off.ocupacionLogradaPct,
                                on.ocupacionLogradaPct
                              ).toFixed(1)}
                              %
                            </span>
                          </li>
                          <li>
                            Δ Ocupación altura usada:{" "}
                            <span className="font-medium">
                              {delta(
                                off.ocupacionVolumenPct,
                                on.ocupacionVolumenPct
                              ).toFixed(1)}
                              %
                            </span>
                          </li>
                          <li>
                            Δ Unidades:{" "}
                            <span className="font-medium">
                              {delta(
                                off.unidadesColocadas,
                                on.unidadesColocadas
                              )}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  );
                })()}

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
