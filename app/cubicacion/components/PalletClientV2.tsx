"use client";

import { useMemo, useState } from "react";
import { BultoSimSnapshot } from "../simulacion/types/types";
import { PalletClientSimV2 } from "./PalletClientSimV2";

type PresetKey = "A" | "B" | "C";

/** Tipos mínimos (dejamos any por velocidad) */
type ClientContenedor = any;
type ClientLote = any;

function btnClass(active: boolean) {
  return [
    "px-3 py-2 rounded-md border text-sm",
    active
      ? "bg-indigo-600 text-white border-indigo-600"
      : "bg-white text-slate-900 border-slate-300 hover:bg-slate-50",
  ].join(" ");
}

export function PalletClientV2({
  empresaId,
  lote,
  contenedores,
  bultoSnap, // ✅ NUEVO
  onSaved,
}: {
  empresaId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
  bultoSnap: BultoSimSnapshot | null; // ✅ NUEVO
   onSaved?: (palletPlanId: number) => void;
}) {
  const [preset, setPreset] = useState<PresetKey>("A");

  const subtitle = useMemo(() => {
    if (preset === "A") return "A · Operativo estable (baseline)";
    if (preset === "B") return "B · Optimizar volumen (más agresivo)";
    return "C · Cuidado producto / simulación (objetivos)";
  }, [preset]);

  // ✅ Lote simulado: reemplaza cantidades según bultoSnap
  const loteSimulado = useMemo(() => {
    if (!bultoSnap) return lote;

    const map = new Map(
      bultoSnap.items.map((x) => [x.tipo_producto_id, x])
    );

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
        // opcional: si tu PalletClient usa dim_unidad_mm o algo, no lo tocamos
      };
    });

    const unidades_totales = bultoSnap.totales.unidades;
    const bultos_totales = bultoSnap.totales.bultos;

    return {
      ...lote,
      unidades_totales,
      bultos_totales,
      items,
      // opcional: si querés “marcar” que es simulado
      __simulacion: {
        candidateKey: bultoSnap.candidateKey,
        titulo: bultoSnap.titulo,
      },
    };
  }, [lote, bultoSnap]);

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">2) Pallet</h2>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>

            {/* ✅ Estado de fuente */}
            <p className="mt-2 text-xs text-slate-600">
              Fuente bulto:{" "}
              <span className="font-medium">
                {bultoSnap ? bultoSnap.titulo : "Sin aplicar (lote original)"}
              </span>
            </p>
          </div>

          <div className="flex gap-2">
            <button type="button" className={btnClass(preset === "A")} onClick={() => setPreset("A")}>
              A
            </button>
            <button type="button" className={btnClass(preset === "B")} onClick={() => setPreset("B")}>
              B
            </button>
            <button type="button" className={btnClass(preset === "C")} onClick={() => setPreset("C")}>
              C
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          Nota: hoy los presets resetean el panel para probar escenarios. Mañana
          hacemos que A/B/C precarguen mix/objetivo/simulación sin tocar el flujo actual.
        </p>
      </div>

      <div className="p-4">
        <PalletClientSimV2
          key={`pallet-v2-${preset}-${bultoSnap?.candidateKey ?? "NONE"}`}
          empresaId={empresaId}
          lote={loteSimulado}
          contenedores={contenedores}
          bultoSnap={bultoSnap}
        />
      </div>
    </div>
  );
}
