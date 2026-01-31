"use client";

import { useMemo } from "react";
import { BultoSimSnapshot } from "../simulacion/types/types";
import { PalletClientSimV2 } from "./PalletClientSimV2";

/** Tipos mínimos (dejamos any por velocidad) */
type ClientContenedor = any;
type ClientLote = any;

export function PalletClientV2({
  empresaId,
  simulacionId,
  lote,
  contenedores,
  bultoSnap,
  onSaved,
}: {
  empresaId: number;
  simulacionId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
  bultoSnap: BultoSimSnapshot | null;
  onSaved?: (palletPlanId: number) => void;
}) {
  // ✅ Lote simulado: reemplaza cantidades según bultoSnap
  const loteSimulado = useMemo(() => {
    if (!bultoSnap) return lote;

    const map = new Map(bultoSnap.items.map((x) => [x.tipo_producto_id, x]));

    const items = (lote.items ?? []).map((it: any) => {
      const s = map.get(it.tipo_producto_id);
      if (!s) return it;

      return {
        ...it,
        // demanda simulada
        cantidad_unidades: s.unidades_planificadas,
        // packaging simulado
        unidades_por_bulto: s.unidades_por_bulto,
        cantidad_bultos: s.cantidad_bultos,
      };
    });

    return {
      ...lote,
      unidades_totales: bultoSnap.totales.unidades,
      bultos_totales: bultoSnap.totales.bultos,
      items,
      __simulacion: {
        candidateKey: bultoSnap.candidateKey,
        titulo: bultoSnap.titulo,
      },
    };
  }, [lote, bultoSnap]);

  return (
    <section className="bg-slate-50/40">
      <div className="mx-auto w-full max-w-350 px-4 py-5 md:px-6 md:py-6">
        <div className="rounded-2xl border bg-white shadow-sm">
          {/* Header */}
          <div className="border-b p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    2) Pallet
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    V2
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Configurá el pallet, previsualizá el layout y guardalo cuando
                  estés conforme.
                </p>

                <p className="text-xs text-slate-600">
                  Fuente bulto:{" "}
                  <span className="font-medium">
                    {bultoSnap ? bultoSnap.titulo : "Sin aplicar (lote original)"}
                  </span>
                </p>
              </div>

              {/* <div className="flex items-center gap-2">
                <a
                  href={`/cubicacion/camion/${lote.id}`}
                  className="px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 text-sm"
                >
                  Ir a Camión
                </a>
              </div> */}
            </div>
          </div>

          {/* Body */}
          <div className="p-4 md:p-5">
            <PalletClientSimV2
              key={`pallet-v2-lote-${lote?.id ?? "X"}-bulto-${bultoSnap?.candidateKey ?? "NONE"
                }`}
              empresaId={empresaId}
              simulacionId={simulacionId}
              lote={loteSimulado}
              contenedores={contenedores}
              bultoSnap={bultoSnap}
              onSaved={onSaved}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
