"use client";

import { useMemo, useState } from "react";
import { BultoPanel } from "../simulacion/[loteId]/BultoPanel";
import { BultoSimSnapshot } from "../simulacion/types/types";
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
}: {
  empresaId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
  empresaBultos: EmpresaBulto[];
}) {
  const [bultoSnap, setBultoSnap] = useState<BultoSimSnapshot | null>(null);
  const [palletPlanId, setPalletPlanId] = useState<number | null>(null);

  const loteForPallet = useMemo(() => {
    if (!bultoSnap) return lote;

    const itemsByTipoProductoId = new Map(
      bultoSnap.items.map((x) => [x.tipo_producto_id, x])
    );

    return {
      ...lote,
      // opcional: “marcar” que es simulado
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
          // opcional: transportar dims si las necesitás luego
          dim_bulto_mm: sim.dim_bulto_mm ?? null,
        };
      }),
    };
  }, [lote, bultoSnap]);

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
                  {pill(`Lote #${lote.id}`)}
                  {pill(`${lote.items.length} productos`)}
                  {pill(`${lote.unidades_totales} unidades`)}
                  {pill(`${lote.bultos_totales} bultos (snapshot)`)}
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

          {/* Panels */}
          <div
            className="
    grid gap-5
    lg:grid-cols-10
    items-start
            "
          >
            {/* Panel 1 */}
            <aside className="lg:col-span-4 xl:col-span-4">
              <div className="rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-5">
                <BultoPanel
                  lote={lote}
                  empresaBultos={empresaBultos}
                  onApply={(snap) => {
                    setBultoSnap(snap);
                    console.log("BULTO SNAP APLICADO:", snap);
                  }}
                />

                {bultoSnap && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    Aplicado:{" "}
                    <span className="font-semibold">{bultoSnap.titulo}</span>
                  </div>
                )}
              </div>
            </aside>

            {/* Panel 2 */}
            <main className="lg:col-span-6 xl:col-span-6">
              <div className="rounded-2xl border bg-white shadow-sm">
                <div className="border-b p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        2) Pallet
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Panel activo (reusa el cálculo actual).
                      </p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Activo
                    </span>
                  </div>
                </div>

                {/* Más aire para el componente grande */}
                <div className="p-4 lg:p-5">
                  <PalletClientV2
                    empresaId={empresaId}
                    lote={loteForPallet as any}
                    contenedores={contenedores as any}
                    bultoSnap={bultoSnap} // ✅
                    onSaved={(id: number) => setPalletPlanId(id)}
                  />
                </div>
              </div>
            </main>

            {palletPlanId != null && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                PalletPlan guardado:{" "}
                <span className="font-semibold">#{palletPlanId}</span>
              </div>
            )}

            {/* Panel 3 */}
            <aside className="lg:col-span-10 xl:col-span-10">
              <div className="rounded-2xl border bg-white p-4 shadow-sm xl:sticky xl:top-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      3) Camión
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      (Placeholder) Luego: A/B/C por strategy + selector.
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
                    Draft
                  </span>
                </div>

                <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-800">Siguiente paso</p>
                  <p className="mt-1 text-xs text-slate-600 wrap-break-word">
                    Una vez elegido el plan de pallet, evaluamos el transporte y
                    proponemos camiones requeridos.
                  </p>

                  <a
                    href={`/cubicacion/camion/${lote.id}`}
                    className="mt-3 inline-flex w-full justify-center px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm"
                  >
                    Abrir camión (flujo actual)
                  </a>

                  <p className="mt-3 text-xs text-slate-500">
                    En V2 esto se integrará en el mismo workflow.
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-medium text-slate-600 mb-2">
                    Estado
                  </p>
                  <div className="rounded-lg border p-3 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Bulto</span>
                      <span className="px-2 py-0.5 rounded-full border bg-white">
                        Pendiente
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pallet</span>
                      <span className="px-2 py-0.5 rounded-full border bg-white">
                        Disponible
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Camión</span>
                      <span className="px-2 py-0.5 rounded-full border bg-white">
                        Pendiente
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
