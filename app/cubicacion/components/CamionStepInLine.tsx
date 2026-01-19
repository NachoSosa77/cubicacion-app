"use client";

import { useState } from "react";
import { CamionClient } from "../camion/[loteId]/CamionClient";

type Props = {
  lote: any;
  transportes: any[];
  palletSummary: any;
  onPreview: any;
  onGuardar: any;
};

export function CamionStepInline({
  lote,
  transportes,
  palletSummary,
  onPreview,
  onGuardar,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">3) Camión</h2>
            <p className="mt-1 text-xs text-slate-500">
              Próximo: evaluar transporte y proponer camiones requeridos.
            </p>
          </div>

          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
            Draft
          </span>
        </div>
      </div>

      <div className="p-4 md:p-5 space-y-3">
        {/* Gate / explicación */}
        <div className="rounded-lg border bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Siguiente paso</p>
          <p className="mt-1 text-sm text-slate-600">
            Una vez elegido el plan de pallet, evaluamos el transporte y proponemos camiones requeridos.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={[
                "w-full sm:w-auto px-4 py-2 rounded-md text-sm font-medium border",
                open
                  ? "bg-white text-slate-900 border-slate-300 hover:bg-slate-50"
                  : "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500",
              ].join(" ")}
            >
              {open ? "Ocultar camión" : "Abrir camión (en esta pantalla)"}
            </button>

            <p className="text-[11px] text-slate-500">
              No navega a otra página. El cálculo y el visor se muestran acá.
            </p>
          </div>
        </div>

        {/* Panel embebido */}
        {open ? (
          <div className="rounded-lg border bg-white p-4">
            <CamionClient
              lote={lote}
              transportes={transportes}
              palletSummary={palletSummary}
              onPreview={onPreview}
              onGuardar={onGuardar}
              // ✅ opcional: podés pasar un callback si querés notificar arriba
              // onSaved={(id) => ...}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
