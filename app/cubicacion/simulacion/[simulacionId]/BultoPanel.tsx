"use client";

import { useEffect, useMemo, useState } from "react";

import { applyBultoSnapshotToLote } from "../../actions/applyBultoSnapshotToLote";
import { applyBultoSnapshotToSimulacion } from "../../actions/applyBultoSnapshotToSimulacion";
import { BultoViewerFromSnapshot } from "../../components/BultoViewerFromSnapshot";
import { previewBultoLayout3D } from "../actions/previewBultoLayout3D";
import type { BultoLayout3D, BultoSimSnapshot } from "../types/types";

type DimMm = { largo: number; ancho: number; alto: number };

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
  descripcion: string | null | undefined;
  tipo_bulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bulto_empresa_id?: number | null;
  unidades_totales: number;
  bultos_totales: number;
  items: ClientLoteItem[];
};

type SourceTag = "SNAPSHOT" | "CATALOGO" | "BULTO_EMPRESA" | "FALLBACK";

/* =========================
   Helpers
========================= */

function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safePosInt(v: unknown, fallback = 0) {
  const n = safeInt(v, fallback);
  return n > 0 ? n : fallback;
}

function ceilDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
  return Math.ceil(a / b);
}

function isValidDim(d: DimMm | null | undefined) {
  if (!d) return false;
  return d.largo > 0 && d.ancho > 0 && d.alto > 0;
}

function asDimBultoStd(it: ClientLoteItem): DimMm | null {
  const largo = safeInt(it.tipo_producto.largo_por_bulto, 0);
  const ancho = safeInt(it.tipo_producto.ancho_por_bulto, 0);
  const alto = safeInt(it.tipo_producto.alto_por_bulto, 0);
  if (largo > 0 && ancho > 0 && alto > 0) return { largo, ancho, alto };
  return null;
}

function tryDimUnidad(it: ClientLoteItem): DimMm | null {
  const v = it.dim_unidad_mm;
  if (!v) return null;
  const largo = safeInt(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = safeInt(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = safeInt(v.alto ?? v.alto_mm ?? v.h, 0);
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

/**
 * unidades_por_bulto por grilla (sin rotación).
 * Interior = dims - 2*espesor
 */
function calcUnidadesPorBultoGrid(args: {
  dimBulto: DimMm;
  dimUnidad: DimMm;
  espesorParedMm?: number;
}) {
  const { dimBulto, dimUnidad } = args;
  const esp = Math.max(0, safeInt(args.espesorParedMm ?? 0, 0));

  const inner = {
    largo: Math.max(0, dimBulto.largo - 2 * esp),
    ancho: Math.max(0, dimBulto.ancho - 2 * esp),
    alto: Math.max(0, dimBulto.alto - 2 * esp),
  };

  if (!isValidDim(inner)) return 0;

  const nx = Math.floor(inner.largo / dimUnidad.largo);
  const ny = Math.floor(inner.ancho / dimUnidad.ancho);
  const nz = Math.floor(inner.alto / dimUnidad.alto);

  if (nx <= 0 || ny <= 0 || nz <= 0) return 0;

  return nx * ny * nz;
}

function calcBultos(unidadesPlan: number, unPorBulto: number) {
  if (unPorBulto <= 0) return { bultos: 0, sobrante: 0, parcial: false };

  const bultos = ceilDiv(unidadesPlan, unPorBulto);

  // Si hay 1 solo bulto, operativamente NO lo marcamos como “parcial”
  if (bultos <= 1) {
    return { bultos: 1, sobrante: 0, parcial: false };
  }

  const rem = unidadesPlan % unPorBulto;
  const parcial = rem !== 0;
  const sobrante = parcial ? rem : 0;
  return { bultos, sobrante, parcial };
}

function isParcialRow(it: {
  cantidad_bultos: number;
  unidades_por_bulto: number;
  unidades_planificadas: number;
}) {
  if (it.cantidad_bultos <= 1) return false;
  if (it.unidades_por_bulto <= 0) return false;
  return it.unidades_planificadas % it.unidades_por_bulto !== 0;
}

/* =========================
   Component
========================= */

export function BultoPanel({
  lote,
  simulacionId,
  simulacionLoteId,
  empresaBultos,
  onApply,
}: {
  simulacionId: number;
  simulacionLoteId: number | null;
  lote: ClientLote;
  empresaBultos: EmpresaBulto[];
  onApply: (snap: BultoSimSnapshot) => void;
}) {
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // =========================
  // Estado Operativo (C)
  // =========================

  // demanda editable por SKU
  const [planUnitsBySku, setPlanUnitsBySku] = useState<Record<number, string>>(
    () =>
      Object.fromEntries(
        lote.items.map((it) => [
          it.tipo_producto_id,
          String(it.cantidad_unidades),
        ]),
      ),
  );

  // Selección de bulto empresa (global + por SKU)
  const defaultEmpresaBultoId =
    lote.bulto_empresa_id ??
    empresaBultos.find((b) => b.es_preferido)?.id ??
    empresaBultos[0]?.id ??
    null;

  const [bultoEmpresaIdGlobal, setBultoEmpresaIdGlobal] = useState<number | "">(
    defaultEmpresaBultoId ?? "",
  );

  const [appliedSnap, setAppliedSnap] = useState<BultoSimSnapshot | null>(null);

  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const [draftLayout, setDraftLayout] = useState<BultoLayout3D | null>(null);
  const [draftKey, setDraftKey] = useState<"A" | "B" | "C" | null>(null);

  // override por SKU (Avanzado)
  const [bultoEmpresaIdBySku, setBultoEmpresaIdBySku] = useState<
    Record<number, number | "">
  >({});

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const empresaBultoMap = useMemo(() => {
    const m = new Map<number, EmpresaBulto>();
    for (const b of empresaBultos) m.set(b.id, b);
    return m;
  }, [empresaBultos]);

  const pickBultoEmpresaForSku = (
    tipoProductoId: number,
  ): EmpresaBulto | null => {
    const skuId = bultoEmpresaIdBySku[tipoProductoId];
    if (typeof skuId === "number") return empresaBultoMap.get(skuId) ?? null;

    if (typeof bultoEmpresaIdGlobal === "number")
      return empresaBultoMap.get(bultoEmpresaIdGlobal) ?? null;

    if (typeof defaultEmpresaBultoId === "number")
      return empresaBultoMap.get(defaultEmpresaBultoId) ?? null;

    return null;
  };

  // =========================
  // Candidate A
  // =========================

  const candidateA = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      const unPorBultoSnapshot =
        it.unidades_por_bulto != null && Number(it.unidades_por_bulto) > 0
          ? Number(it.unidades_por_bulto)
          : null;

      const unPorBultoFallback = safePosInt(
        it.tipo_producto.unidad_entra_por_bulto,
        0,
      );
      const unPorBulto = unPorBultoSnapshot ?? unPorBultoFallback;

      const unidadesPlan = safePosInt(it.cantidad_unidades, 0);

      const bultosSnapshot = safePosInt(it.cantidad_bultos, 0);
      const { bultos: bultosCalc, sobrante } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );
      const bultos = bultosSnapshot > 0 ? bultosSnapshot : bultosCalc;

      // dims de bulto para Candidate A:
      // - PRODUCTO_ESTANDAR: catálogo (dims estándar)
      // - EMPRESA_BULTO: bulto empresa del lote (DB)
      let dim: DimMm | null = null;
      let sourceDim: SourceTag = "FALLBACK";
      let bultoEmpresaId: number | undefined = undefined;
      let bultoEmpresaCodigo: string | undefined = undefined;

      if (lote.tipo_bulto === "PRODUCTO_ESTANDAR") {
        dim = asDimBultoStd(it);
        sourceDim = isValidDim(dim) ? "CATALOGO" : "FALLBACK";

        if (!isValidDim(dim)) {
          warnings.push(`${it.tipo_producto.codigo}: faltan dims estándar.`);
        }
      } else {
        const beId =
          typeof lote.bulto_empresa_id === "number"
            ? lote.bulto_empresa_id
            : null;

        const b = beId != null ? (empresaBultoMap.get(beId) ?? null) : null;

        if (b) {
          dim = { largo: b.largo_mm, ancho: b.ancho_mm, alto: b.alto_mm };
          sourceDim = "BULTO_EMPRESA";
          bultoEmpresaId = b.id;
          bultoEmpresaCodigo = b.codigo;
        } else {
          warnings.push(
            `${it.tipo_producto.codigo}: lote EMPRESA_BULTO sin bulto_empresa_id válido (no hay dim_bulto_mm).`,
          );
        }
      }

      const sourceUn: SourceTag =
        unPorBultoSnapshot != null ? "SNAPSHOT" : "FALLBACK";

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dim,
        audit: {
          sourceUnPorBulto: sourceUn,
          sourceDims: sourceDim,
          bultoEmpresaId,
          bultoEmpresaCodigo,
        },
      };
    });

    const unidades =
      safePosInt(lote.unidades_totales, 0) ||
      items.reduce((a, x) => a + x.unidades_planificadas, 0);

    const bultos =
      safePosInt(lote.bultos_totales, 0) ||
      items.reduce((a, x) => a + x.cantidad_bultos, 0);

    const bultosParciales = items.reduce(
      (a, x) => a + (isParcialRow(x) ? 1 : 0),
      0
    );

    return {
      candidateKey: "A",
      titulo: "A - Plan vigente (catálogo / guardado)",
      scope: "SKU",
      items,
      warnings,
      totales: { unidades, bultos, bultosParciales },
    };
  }, [lote, empresaBultoMap]);

  // =========================
  // Candidate B (catálogo)
  // =========================

  const candidateB = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      const unidadesPlan = safePosInt(it.cantidad_unidades, 0);
      const unPorBulto = safePosInt(it.tipo_producto.unidad_entra_por_bulto, 0);

      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );
      const dim = asDimBultoStd(it);

      if (unPorBulto <= 0)
        warnings.push(
          `${it.tipo_producto.codigo}: un/bulto inválido catálogo.`,
        );
      if (!isValidDim(dim))
        warnings.push(`${it.tipo_producto.codigo}: faltan dims estándar.`);
      if (parcial)
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`,
        );

      const TAG_CATALOGO: SourceTag = "CATALOGO";

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dim,
        audit: { sourceUnPorBulto: TAG_CATALOGO, sourceDims: TAG_CATALOGO },
      };
    });

    return {
      candidateKey: "B",
      titulo: "B · Recalcular con catálogo",
      scope: "SKU",
      items,
      warnings,
      totales: {
        unidades: items.reduce((a, x) => a + x.unidades_planificadas, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
        bultosParciales: items.reduce(
          (a, x) =>
            a +
            (x.unidades_por_bulto > 0 &&
              x.unidades_planificadas % x.unidades_por_bulto !== 0
              ? 1
              : 0),
          0,
        ),
      },
    };
  }, [lote.items]);

  // =========================
  // Candidate C (operativo pro)
  // =========================

  const candidateC = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      const planStr =
        planUnitsBySku[it.tipo_producto_id] ?? String(it.cantidad_unidades);

      const unidadesPlan = safePosInt(
        planStr,
        safePosInt(it.cantidad_unidades, 0),
      );

      let dimBulto: DimMm | null = null;
      let sourceDim: SourceTag = "FALLBACK";
      let bultoEmpresaId: number | undefined = undefined;
      let bultoEmpresaCodigo: string | undefined = undefined;
      let espesorParedMm = 0;

      const b =
        empresaBultos.length > 0
          ? pickBultoEmpresaForSku(it.tipo_producto_id)
          : null;

      if (b) {
        dimBulto = { largo: b.largo_mm, ancho: b.ancho_mm, alto: b.alto_mm };
        sourceDim = "BULTO_EMPRESA";
        bultoEmpresaId = b.id;
        bultoEmpresaCodigo = b.codigo;
        espesorParedMm = b.espesor_pared_mm ?? 0;
      } else if (lote.tipo_bulto === "PRODUCTO_ESTANDAR") {
        dimBulto = asDimBultoStd(it);
        sourceDim = isValidDim(dimBulto) ? "CATALOGO" : "FALLBACK";
      } else {
        dimBulto = null;
        sourceDim = "FALLBACK";
      }

      const dimUnidad = tryDimUnidad(it);

      let unPorBulto = 0;
      let sourceUn: SourceTag = "FALLBACK";

      if (isValidDim(dimBulto) && isValidDim(dimUnidad)) {
        unPorBulto = calcUnidadesPorBultoGrid({
          dimBulto: dimBulto!,
          dimUnidad: dimUnidad!,
          espesorParedMm,
        });

        if (unPorBulto > 0) {
          sourceUn =
            sourceDim === "BULTO_EMPRESA" ? "BULTO_EMPRESA" : "CATALOGO";
        }
      }

      if (unPorBulto <= 0) {
        unPorBulto = safePosInt(it.tipo_producto.unidad_entra_por_bulto, 0);
        sourceUn = "CATALOGO";
        warnings.push(
          `${it.tipo_producto.codigo}: sin dim_unidad_mm o no entra por grilla; usando catálogo (unidad_entra_por_bulto).`,
        );
      }

      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );

      if (!isValidDim(dimBulto))
        warnings.push(
          `${it.tipo_producto.codigo}: faltan dimensiones de bulto para simular.`,
        );

      if (parcial)
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`,
        );

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dimBulto,
        audit: {
          sourceUnPorBulto: sourceUn,
          sourceDims: sourceDim,
          bultoEmpresaId,
          bultoEmpresaCodigo,
        },
      };
    });

    const bultosParciales = items.reduce(
      (a, x) => a + (isParcialRow(x) ? 1 : 0),
      0
    );

    return {
      candidateKey: "C",
      titulo: "C · Cálculo operativo editable",
      scope: "SKU",
      items,
      warnings,
      totales: {
        unidades: items.reduce((a, x) => a + x.unidades_planificadas, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
        bultosParciales,
      },
    };
  }, [
    lote.items,
    lote.tipo_bulto,
    planUnitsBySku,
    bultoEmpresaIdGlobal,
    bultoEmpresaIdBySku,
    empresaBultos,
    empresaBultoMap,
  ]);

  const [selected, setSelected] = useState<"A" | "B" | "C">("A");

  const active =
    selected === "A" ? candidateA : selected === "B" ? candidateB : candidateC;

  const setPlanForSku = (tipoProductoId: number, v: string) => {
    setPlanUnitsBySku((prev) => ({ ...prev, [tipoProductoId]: v }));
  };

  const setSkuBultoEmpresa = (tipoProductoId: number, v: string) => {
    setBultoEmpresaIdBySku((prev) => {
      const next = { ...prev };
      if (v === "") delete next[tipoProductoId];
      else next[tipoProductoId] = Number(v);
      return next;
    });
  };

  const canApply =
    draftKey === selected &&
    !!draftLayout &&
    Array.isArray(draftLayout.placements) &&
    draftLayout.placements.length > 0;

  const effectiveLoteId =
    typeof simulacionLoteId === "number" && simulacionLoteId > 0
      ? simulacionLoteId
      : typeof lote?.id === "number" && lote.id > 0
        ? lote.id
        : null;

  const canPublishToLote = effectiveLoteId != null;

  // =========================
  // Visor 3D
  // =========================

  const skuOptions = useMemo(
    () =>
      lote.items.map((it) => ({
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
      })),
    [lote.items],
  );

  const hasMultiSku = skuOptions.length > 1;

  const [viewerSkuId, setViewerSkuId] = useState<number>(
    () => skuOptions[0]?.tipo_producto_id ?? 0,
  );

  const loteItemBySku = useMemo(() => {
    const m = new Map<number, ClientLoteItem>();
    for (const it of lote.items) m.set(it.tipo_producto_id, it);
    return m;
  }, [lote.items]);

  const activeItemForViewer = useMemo(() => {
    return (
      active.items.find((x) => x.tipo_producto_id === viewerSkuId) ??
      active.items[0] ??
      null
    );
  }, [active.items, viewerSkuId]);

  const unidadDimForViewer = useMemo(() => {
    const it = loteItemBySku.get(activeItemForViewer?.tipo_producto_id ?? -1);
    return it ? tryDimUnidad(it) : null;
  }, [loteItemBySku, activeItemForViewer]);

  const layoutForViewer =
    draftKey === selected && draftLayout
      ? draftLayout
      : (appliedSnap?.layout3d ?? null);

  const clearLayouts = () => {
    setDraftLayout(null);
    setDraftKey(null);
  };

  // 1) Si cambio de candidato A/B/C, el layout previo ya no es válido
  useEffect(() => {
    clearLayouts();
  }, [selected]);

  // 2) Si cambio bulto empresa, invalido layout
  useEffect(() => {
    clearLayouts();
  }, [bultoEmpresaIdGlobal, bultoEmpresaIdBySku]);

  // 3) Si edito demanda en C, invalido layout
  useEffect(() => {
    if (selected !== "C") return;
    clearLayouts();
  }, [selected, planUnitsBySku]);

  // 4) Mantener viewerSkuId válido
  useEffect(() => {
    if (!skuOptions.length) return;
    const exists = skuOptions.some((s) => s.tipo_producto_id === viewerSkuId);
    if (!exists) setViewerSkuId(skuOptions[0].tipo_producto_id);
  }, [skuOptions, viewerSkuId]);

  console.log("lote", lote);
  console.log("simulacionId", simulacionId);
  console.log("simulacionLoteId", simulacionLoteId);

  // =========================
  // Render
  // =========================

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Columna izquierda: Config */}
      <div className="lg:col-span-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">1) Bulto</h2>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-700 border">
            V2
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {pill(`Tipo bulto: ${lote.tipo_bulto}`)}
          {pill(`Lote: ${lote.descripcion ?? "—"}`)}
          {pill(`Tipo de productos: ${lote.items.length}`)}
        </div>

        {/* Selector A/B/C */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">
            Opciones de cubicación.
          </label>

          <div className="grid gap-2">
            {(["A", "B", "C"] as const).map((k) => {
              const snap =
                k === "A" ? candidateA : k === "B" ? candidateB : candidateC;
              const isActive = selected === k;

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelected(k)}
                  className={[
                    "w-full text-left rounded-lg border p-3 transition",
                    isActive
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {snap.titulo}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Totales: {snap.totales.unidades} un ·{" "}
                        {snap.totales.bultos} bultos
                        {snap.totales.bultosParciales > 0 ? (
                          <span className="text-amber-700">
                            {" "}
                            · {snap.totales.bultosParciales} parciales
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <span
                      className={[
                        "text-[11px] px-2 py-0.5 rounded-full border",
                        isActive
                          ? "bg-white border-indigo-200 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-700",
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

        {/* Config operativa C */}
        {selected === "C" && (
          <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
            <p className="text-xs font-medium text-slate-700">Operativo (C)</p>

            {empresaBultos.length > 0 && (
              <div className="rounded-md border bg-white p-3 space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  Bulto empresa (simulación) — define dimensiones del bulto
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-600">
                    Bulto global
                  </label>
                  <select
                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                    value={bultoEmpresaIdGlobal}
                    onChange={(e) =>
                      setBultoEmpresaIdGlobal(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  >
                    <option value="">(sin seleccionar)</option>
                    {empresaBultos.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.codigo} — {b.largo_mm}×{b.ancho_mm}×{b.alto_mm} mm
                        {b.es_preferido ? " (preferido)" : ""}
                      </option>
                    ))}
                  </select>

                  <p className="text-[11px] text-slate-500">
                    En C, si elegís un bulto empresa (global o por SKU), se usan
                    sus dims aunque el lote sea PRODUCTO_ESTANDAR. El un/bulto
                    se deriva con dim_unidad_mm si existe; si falta, cae a
                    catálogo.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="mt-2 inline-flex w-full justify-center px-3 py-2 rounded-md border bg-white text-slate-900 hover:bg-slate-50 text-sm"
                  >
                    {showAdvanced ? "Ocultar avanzado" : "Avanzado"}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-md border bg-white p-3">
              <p className="text-xs font-medium text-slate-700">
                Demanda por SKU (editable)
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Esto no toca la base. Sirve para simular escenarios de pedido.
              </p>

              <div className="mt-3 max-h-72 overflow-auto rounded-md border">
                <ul className="divide-y text-xs">
                  {lote.items.map((it) => {
                    const id = it.tipo_producto_id;
                    const chosenBulto =
                      empresaBultos.length > 0
                        ? pickBultoEmpresaForSku(id)
                        : null;

                    return (
                      <li key={id} className="p-3 space-y-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {it.tipo_producto.codigo}
                          </p>
                          <p className="text-slate-600">
                            {it.tipo_producto.descripcion}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] text-slate-600">
                              Unidades planificadas
                            </label>
                            <input
                              className="w-full border rounded-md px-2 py-2 text-sm bg-white"
                              type="number"
                              min={0}
                              value={planUnitsBySku[id] ?? ""}
                              onChange={(e) =>
                                setPlanForSku(id, e.target.value)
                              }
                            />
                          </div>

                          {showAdvanced && empresaBultos.length > 0 ? (
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-600">
                                Bulto empresa (SKU)
                              </label>
                              <select
                                className="w-full border rounded-md px-2 py-2 text-sm bg-white"
                                value={bultoEmpresaIdBySku[id] ?? ""}
                                onChange={(e) =>
                                  setSkuBultoEmpresa(id, e.target.value)
                                }
                              >
                                <option value="">(usar global)</option>
                                {empresaBultos.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.codigo} — {b.largo_mm}×{b.ancho_mm}×
                                    {b.alto_mm} mm
                                  </option>
                                ))}
                              </select>
                              {chosenBulto ? (
                                <p className="text-[11px] text-slate-500">
                                  Activo: {chosenBulto.codigo}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <label className="text-[11px] text-slate-600">
                                Bulto (SKU)
                              </label>
                              <div className="w-full border rounded-md px-2 py-2 text-sm bg-slate-50 text-slate-500">
                                {empresaBultos.length > 0
                                  ? "(usar global)"
                                  : "—"}
                              </div>
                            </div>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500">
                          Unidad (dim_unidad_mm): {fmtDim(tryDimUnidad(it))} ·
                          Bulto:{" "}
                          {chosenBulto
                            ? `${chosenBulto.largo_mm}×${chosenBulto.ancho_mm}×${chosenBulto.alto_mm} mm`
                            : fmtDim(asDimBultoStd(it))}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              En C, el usuario decide la demanda; el sistema deriva un/bulto en
              función del bulto elegido (si hay) y los datos de unidad.
            </p>
          </div>
        )}
      </div>

      {/* Columna derecha: Preview */}
      <div className="lg:col-span-7 space-y-4">
        {/* Visor 3D */}
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700">Visor 3D</p>

            {hasMultiSku ? (
              <select
                className="border rounded-md px-2 py-1 text-xs bg-white"
                value={viewerSkuId}
                onChange={(e) => setViewerSkuId(Number(e.target.value))}
              >
                {skuOptions.map((x) => (
                  <option key={x.tipo_producto_id} value={x.tipo_producto_id}>
                    {x.codigo}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-slate-700">
                {skuOptions[0]?.codigo ?? "SKU"}
              </span>
            )}
          </div>

          {/* Indicador */}
          {layoutForViewer?.placements?.length ? (
            <div className="text-[11px] text-emerald-700">
              Layout listo: {layoutForViewer.placements.length} unidades de
              producto.
            </div>
          ) : (
            <div className="text-[11px] text-slate-500">
              El layout no está generado o quedó desactualizado. Usá{" "}
              <span className="font-medium">“Ver layout en visor”</span> para
              calcular la ubicación de las unidades.
            </div>
          )}

          {isValidDim(activeItemForViewer?.dim_bulto_mm) ? (
            <BultoViewerFromSnapshot
              bultoDimMm={activeItemForViewer!.dim_bulto_mm!}
              unidadDimMm={unidadDimForViewer}
              productoId={activeItemForViewer!.tipo_producto_id}
              codigo={activeItemForViewer!.codigo}
              unidades={activeItemForViewer!.unidades_planificadas}
              placements={layoutForViewer?.placements ?? null}
            />
          ) : (
            <div className="rounded-md border bg-slate-50 p-3 text-xs text-slate-600">
              No hay dimensiones de bulto válidas para este SKU en el candidato
              activo.
            </div>
          )}
        </div>

        {/* Warnings */}
        {active.warnings && active.warnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-900">
            <p className="font-semibold mb-1">Advertencias</p>
            <ul className="list-disc pl-5 space-y-1">
              {active.warnings.slice(0, 10).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            {active.warnings.length > 10 ? (
              <p className="mt-2 text-[11px] text-amber-800">
                Se muestran 10 de {active.warnings.length}.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] text-slate-500">
              Totales: {active.totales.unidades} un · {active.totales.bultos}{" "}
              bultos
              {active.totales.bultosParciales > 0 ? (
                <span className="text-amber-700">
                  {" "}
                  · {active.totales.bultosParciales} parciales
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* 1) Ver layout */}
              <button
                type="button"
                disabled={layoutLoading}
                onClick={async () => {
                  setLayoutError(null);
                  setApplyError(null);
                  setLayoutLoading(true);
                  try {
                    const res = await previewBultoLayout3D({
                      loteId: effectiveLoteId ?? undefined,
                      simulacionId: typeof simulacionId === "number" ? simulacionId : undefined,
                      snap: active,
                    });


                    setDraftLayout(res.layout);
                    setDraftKey(selected);

                    console.log("DRAFT LAYOUT:", {
                      key: selected,
                      contenido: res.layout?.contenido?.length,
                      placements: res.layout?.placements?.length,
                      w: res.layout?.warnings?.slice(0, 5),
                    });
                  } catch (e) {
                    console.error(e);
                    setLayoutError(
                      "No se pudo generar el layout 3D del bulto.",
                    );
                  } finally {
                    setLayoutLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 text-sm disabled:opacity-50"
              >
                {layoutLoading ? "Generando layout..." : "Ver layout en visor"}
              </button>

              {/* 2) Aplicar (solo simulación) */}
              <button
                type="button"
                disabled={!canApply || applyLoading}
                onClick={async () => {
                  if (!draftLayout) return;

                  setApplyError(null);
                  setApplyLoading(true);

                  try {
                    const snapToApply = { ...active, layout3d: draftLayout };

                    await applyBultoSnapshotToSimulacion({
                      simulacionId,
                      snap: snapToApply,
                    });

                    setAppliedSnap(snapToApply);
                    onApply(snapToApply);
                  } catch (e: any) {
                    console.error(e);
                    setApplyError(
                      e?.message ??
                      "No se pudo aplicar el snapshot en simulación.",
                    );
                  } finally {
                    setApplyLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyLoading ? "Aplicando..." : "Aplicar y continuar"}
              </button>



              {/* 3) Publicar al lote (simulación + lote) */}
              {canPublishToLote ? (
                <button
                  type="button"
                  disabled={!canApply || applyLoading}
                  onClick={async () => {
                    if (!draftLayout) return;

                    setApplyError(null);
                    setApplyLoading(true);
                    console.log("[PUBLICAR] simulacionLoteId =", simulacionLoteId, "lote.id =", lote.id);

                    try {
                      const snapToApply = { ...active, layout3d: draftLayout };

                      await applyBultoSnapshotToSimulacion({
                        simulacionId,
                        snap: snapToApply,
                      });

                      if (!effectiveLoteId) throw new Error("No hay lote asociado para publicar.");

                      await applyBultoSnapshotToLote({
                        loteId: effectiveLoteId,
                        snap: snapToApply,
                      });

                      setAppliedSnap(snapToApply);
                      onApply(snapToApply);
                    } catch (e: any) {
                      console.error(e);
                      setApplyError(
                        e?.message ??
                        "No se pudo publicar el snapshot al lote.",
                      );
                    } finally {
                      setApplyLoading(false);
                    }
                  }}
                  className="px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applyLoading ? "Publicando..." : "Publicar al lote"}
                </button>
              ) : null}
            </div>
          </div>

          {/* Hint */}
          <p className="text-[11px] text-slate-500">
            {canApply ? (
              <>
                Layout verificado para{" "}
                <span className="font-medium">candidato {selected}</span>. Podés
                aplicar al workflow.
              </>
            ) : (
              <>
                Para aplicar, primero generá y verificá el layout con{" "}
                <span className="font-medium">“Ver layout en visor”</span>.
              </>
            )}
          </p>

          {layoutError && (
            <p className="text-[11px] text-red-600">{layoutError}</p>
          )}

          {applyError && (
            <p className="text-[11px] text-red-600">{applyError}</p>
          )}
        </div>

        {/* Vista rápida */}
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">
            Vista rápida
            <span className="ml-2 text-[11px] text-slate-500">
              ({active.items.length} SKUs)
            </span>
          </summary>

          <div className="mt-2 max-h-72 overflow-auto rounded-md border">
            <ul className="divide-y text-xs">
              {active.items.map((it) => (
                <li key={it.tipo_producto_id} className="p-3">
                  <p className="font-semibold text-slate-900">{it.codigo}</p>




                  <p className="mt-1 text-slate-700">
                    Unidades planificadas: {it.unidades_planificadas}
                    {isParcialRow(it) ? (
                      <span className="text-amber-700">
                        {" "}
                        · parcial ({it.sobrante_unidades} un)
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-slate-700">
                    Bultos: {it.cantidad_bultos}
                  </p>
                  <p className="mt-1 text-slate-700">Capacidad por bulto:{it.unidades_por_bulto}</p>
                  {/* <p className="mt-1 text-slate-500">
                    Dim bulto: {fmtDim(it.dim_bulto_mm)} ·{" "}
                    <span className="text-[11px]">
                      un/bulto:{" "}
                      <span className="font-medium">
                        {it.audit.sourceUnPorBulto}
                      </span>{" "}
                      · dims:{" "}
                      <span className="font-medium">{it.audit.sourceDims}</span>
                      {it.audit.bultoEmpresaCodigo ? (
                        <>
                          {" "}
                          · bulto:{" "}
                          <span className="font-medium">
                            {it.audit.bultoEmpresaCodigo}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </p> */}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}
