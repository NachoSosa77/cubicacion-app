"use client";

import { useMemo, useState } from "react";
import { PalletClient } from "../pallet/[loteId]/PalletClient";

type PresetKey = "A" | "B" | "C";

/** Tipos mínimos (podés dejarlos any si estás con apuro) */
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
}: {
  empresaId: number;
  lote: ClientLote;
  contenedores: ClientContenedor[];
}) {
  const [preset, setPreset] = useState<PresetKey>("A");

  const subtitle = useMemo(() => {
    if (preset === "A") return "A · Operativo estable (baseline)";
    if (preset === "B") return "B · Optimizar volumen (más agresivo)";
    return "C · Cuidado producto / simulación (objetivos)";
  }, [preset]);

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">2) Pallet</h2>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
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
        {/* key: al cambiar preset, resetea estados internos del PalletClient sin modificarlo */}
        <PalletClient
          key={`pallet-v2-${preset}`}
          empresaId={empresaId}
          lote={lote}
          contenedores={contenedores}
        />
      </div>
    </div>
  );
}
