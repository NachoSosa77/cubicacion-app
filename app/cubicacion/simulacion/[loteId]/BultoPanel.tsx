"use client";

import { useMemo, useState } from "react";

type DimMm = { largo: number; ancho: number; alto: number };

type ClientLoteItem = {
  id: number;
  tipo_producto_id: number;
  cantidad_unidades: number;
  cantidad_bultos: number;
  unidades_por_bulto?: number | null;
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
};

type ClientLote = {
  id: number;
  tipo_bulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bulto_empresa_id?: number | null;
  unidades_totales: number;
  bultos_totales: number;
  items: ClientLoteItem[];
};

export type BultoSimSnapshot = {
  candidateKey: "A" | "B" | "C";
  titulo: string;
  // snapshot por SKU (para mañana alimentar pallet)
  items: Array<{
    tipo_producto_id: number;
    codigo: string;
    cantidad_unidades: number;
    unidades_por_bulto: number;
    cantidad_bultos: number;
    dim_bulto_mm?: DimMm | null;
  }>;
  totales: {
    unidades: number;
    bultos: number;
  };
};

function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function ceilDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.ceil(a / b);
}

function asDimBultoStd(it: ClientLoteItem): DimMm | null {
  const largo = safeInt(it.tipo_producto.largo_por_bulto, 0);
  const ancho = safeInt(it.tipo_producto.ancho_por_bulto, 0);
  const alto = safeInt(it.tipo_producto.alto_por_bulto, 0);
  if (largo > 0 && ancho > 0 && alto > 0) return { largo, ancho, alto };
  return null;
}

function fmtDim(d?: DimMm | null) {
  if (!d) return "—";
  return `${d.largo}×${d.ancho}×${d.alto} mm`;
}

function pill(text: string) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm">
      {text}
    </span>
  );
}

export function BultoPanel({
  lote,
  onApply,
}: {
  lote: ClientLote;
  onApply: (snap: BultoSimSnapshot) => void;
}) {
  const candidateA = useMemo<BultoSimSnapshot>(() => {
    const items = lote.items.map((it) => {
      const unPorBulto =
        it.unidades_por_bulto != null && Number(it.unidades_por_bulto) > 0
          ? Number(it.unidades_por_bulto)
          : safeInt(it.tipo_producto.unidad_entra_por_bulto, 0);

      const bultos =
        safeInt(it.cantidad_bultos, 0) > 0
          ? safeInt(it.cantidad_bultos, 0)
          : unPorBulto > 0
          ? ceilDiv(it.cantidad_unidades, unPorBulto)
          : 0;

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        cantidad_unidades: it.cantidad_unidades,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        dim_bulto_mm: lote.tipo_bulto === "PRODUCTO_ESTANDAR" ? asDimBultoStd(it) : null,
      };
    });

    return {
      candidateKey: "A",
      titulo: "A · Snapshot actual del lote",
      items,
      totales: {
        unidades: safeInt(lote.unidades_totales, 0),
        bultos: safeInt(lote.bultos_totales, 0),
      },
    };
  }, [lote]);

  const candidateB = useMemo<BultoSimSnapshot>(() => {
    const items = lote.items.map((it) => {
      const unPorBulto = Math.max(0, safeInt(it.tipo_producto.unidad_entra_por_bulto, 0));
      const bultos = unPorBulto > 0 ? ceilDiv(it.cantidad_unidades, unPorBulto) : 0;

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        cantidad_unidades: it.cantidad_unidades,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        dim_bulto_mm: asDimBultoStd(it),
      };
    });

    return {
      candidateKey: "B",
      titulo: "B · Estándar del producto (un/bulto + dims estándar)",
      items,
      totales: {
        unidades: items.reduce((a, x) => a + x.cantidad_unidades, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
      },
    };
  }, [lote.items]);

  // C = manual: por ahora aplicamos unPorBulto editable global y dims base editable (si aplica)
  const [cUnPorBulto, setCUnPorBulto] = useState<string>("");

  const [cDim, setCDim] = useState<DimMm>({ largo: 400, ancho: 300, alto: 300 });

  const candidateC = useMemo<BultoSimSnapshot>(() => {
    const unPorBultoGlobal = cUnPorBulto.trim() ? Number(cUnPorBulto) : NaN;
    const unPorBultoOk = Number.isFinite(unPorBultoGlobal) && unPorBultoGlobal > 0;

    const items = lote.items.map((it) => {
      const unPorBulto = unPorBultoOk
        ? Math.trunc(unPorBultoGlobal)
        : Math.max(0, safeInt(it.tipo_producto.unidad_entra_por_bulto, 0));

      const bultos = unPorBulto > 0 ? ceilDiv(it.cantidad_unidades, unPorBulto) : 0;

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        cantidad_unidades: it.cantidad_unidades,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        dim_bulto_mm: lote.tipo_bulto === "PRODUCTO_ESTANDAR" ? cDim : null,
      };
    });

    return {
      candidateKey: "C",
      titulo: "C · Operativo (manual: un/bulto + dims base)",
      items,
      totales: {
        unidades: items.reduce((a, x) => a + x.cantidad_unidades, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
      },
    };
  }, [lote.items, lote.tipo_bulto, cUnPorBulto, cDim]);

  const [selected, setSelected] = useState<"A" | "B" | "C">("A");

  const active = selected === "A" ? candidateA : selected === "B" ? candidateB : candidateC;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">1) Bulto</h2>
          <p className="mt-1 text-xs text-slate-500">
            Elegí un candidato (A/B/C). Mañana este output alimenta Pallet y Camión.
          </p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
          V2
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {pill(`Tipo bulto: ${lote.tipo_bulto}`)}
        {pill(`Lote #${lote.id}`)}
        {pill(`${lote.items.length} productos`)}
      </div>

      {/* Selector A/B/C */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">Candidatos</label>

        <div className="grid gap-2">
          {(["A", "B", "C"] as const).map((k) => {
            const snap = k === "A" ? candidateA : k === "B" ? candidateB : candidateC;
            const isActive = selected === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                className={[
                  "w-full text-left rounded-lg border p-3 transition",
                  isActive ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{snap.titulo}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Totales: {snap.totales.unidades} un · {snap.totales.bultos} bultos
                    </p>
                  </div>
                  <span
                    className={[
                      "text-[11px] px-2 py-0.5 rounded-full border",
                      isActive ? "bg-white border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-700",
                    ].join(" ")}
                  >
                    {isActive ? "Seleccionado" : "Elegir"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Config manual para C */}
      {selected === "C" && (
        <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
          <p className="text-xs font-medium text-slate-700">Ajustes manuales (C)</p>

          <div className="grid gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-600">Unidades por bulto (global)</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                type="number"
                min={0}
                placeholder="Ej: 12"
                value={cUnPorBulto}
                onChange={(e) => setCUnPorBulto(e.target.value)}
              />
            </div>

            {lote.tipo_bulto === "PRODUCTO_ESTANDAR" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600">Largo (mm)</label>
                  <input
                    className="w-full border rounded-md px-2 py-2 text-sm bg-white"
                    type="number"
                    min={1}
                    value={cDim.largo}
                    onChange={(e) => setCDim({ ...cDim, largo: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-600">Ancho (mm)</label>
                  <input
                    className="w-full border rounded-md px-2 py-2 text-sm bg-white"
                    type="number"
                    min={1}
                    value={cDim.ancho}
                    onChange={(e) => setCDim({ ...cDim, ancho: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-600">Alto (mm)</label>
                  <input
                    className="w-full border rounded-md px-2 py-2 text-sm bg-white"
                    type="number"
                    min={1}
                    value={cDim.alto}
                    onChange={(e) => setCDim({ ...cDim, alto: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              Nota: este ajuste es solo para simulación V2 (cliente). Mañana lo conectamos al resto del workflow.
            </p>
          </div>
        </div>
      )}

      {/* Detalle (compacto) */}
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-slate-700">Vista rápida</p>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border">
          <ul className="divide-y text-xs">
            {active.items.map((it) => (
              <li key={it.tipo_producto_id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{it.codigo}</p>
                    <p className="mt-1 text-slate-700">
                      {it.cantidad_unidades} un · {it.cantidad_bultos} bultos · {it.unidades_por_bulto} un/bulto
                    </p>
                    <p className="mt-1 text-slate-500">
                      Dim bulto: {fmtDim(it.dim_bulto_mm)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onApply(active)}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm"
          >
            Aplicar bulto al workflow
          </button>
        </div>
      </div>
    </div>
  );
}
