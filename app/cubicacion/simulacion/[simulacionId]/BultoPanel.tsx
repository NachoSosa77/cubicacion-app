"use client";

import { useEffect, useMemo, useState } from "react";

import { applyBultoSnapshotToLote } from "../../actions/applyBultoSnapshotToLote";
import { applyBultoSnapshotToSimulacion } from "../../actions/applyBultoSnapshotToSimulacion";
import { BultoViewerFromSnapshot } from "../../components/BultoViewerFromSnapshot";
import { previewBultoLayout3D } from "../actions/previewBultoLayout3D";
import type {
  BultoLayout3D,
  BultoSimSnapshot,
  BultoSimSnapshotItem,
  SourceTag,
} from "../types/types";

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
  const [draftKey, setDraftKey] = useState<"A" | "B" | "C" | "D" | null>(null);

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
  // Candidate A (estricto catálogo)
  // =========================

  const candidateA = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      // 1) unidades planificadas (base)
      const unidadesPlan = safePosInt(it.cantidad_unidades, 0);

      // 2) REGLA A: capacidad SOLO desde catálogo (restricción)
      const unPorBulto = safePosInt(it.tipo_producto.unidad_entra_por_bulto, 0);
      if (unPorBulto <= 0) {
        warnings.push(
          `${it.tipo_producto.codigo}: unidad_entra_por_bulto inválido en catálogo.`,
        );
      }

      // 3) bultos calculados SOLO con la restricción catálogo
      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );
      if (parcial) {
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`,
        );
      }

      // 4) REGLA A: dimensiones SOLO desde catálogo
      const dim: DimMm | null = asDimBultoStd(it); // usa largo/ancho/alto_por_bulto
      if (!isValidDim(dim)) {
        warnings.push(
          `${it.tipo_producto.codigo}: faltan dims estándar (largo/ancho/alto_por_bulto).`,
        );
      }

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dim,
        audit: {
          sourceUnPorBulto: "CATALOGO" as const,
          sourceDims: "CATALOGO" as const,
        },
      };
    });

    const unidades =
      safePosInt(lote.unidades_totales, 0) ||
      items.reduce((a, x) => a + x.unidades_planificadas, 0);

    const bultosTot =
      safePosInt(lote.bultos_totales, 0) ||
      items.reduce((a, x) => a + x.cantidad_bultos, 0);

    const bultosParciales = items.reduce(
      (a, x) => a + (isParcialRow(x) ? 1 : 0),
      0,
    );

    return {
      candidateKey: "A",
      titulo: "A - Plan básico (restricciones del producto)",
      scope: "SKU",
      items,
      warnings,
      totales: { unidades, bultos: bultosTot, bultosParciales },
    };
  }, [lote.items, lote.unidades_totales, lote.bultos_totales]);

  // =========================
  // Candidate B (bulto empresa)
  // =========================

  const candidateB = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      const unidadesPlan = safePosInt(it.cantidad_unidades, 0);

      // 1) bulto empresa (global o por SKU)
      const b = pickBultoEmpresaForSku(it.tipo_producto_id);
      const dimBulto: DimMm | null = b
        ? { largo: b.largo_mm, ancho: b.ancho_mm, alto: b.alto_mm }
        : null;

      // 2) dim unidad (debe existir para recalcular)
      const dimUnidad = tryDimUnidad(it);

      let unPorBulto = 0;
      let sourceUn: SourceTag = "FALLBACK";
      let sourceDim: SourceTag = "FALLBACK";

      if (!isValidDim(dimBulto)) {
        warnings.push(
          `${it.tipo_producto.codigo}: en B debés seleccionar un bulto empresa válido (global o por SKU).`,
        );
      } else {
        sourceDim = "BULTO_EMPRESA";

        if (!isValidDim(dimUnidad)) {
          warnings.push(
            `${it.tipo_producto.codigo}: falta dim_unidad_mm; no se puede recalcular por bulto empresa.`,
          );
        } else {
          const espesor = b?.espesor_pared_mm ?? 0;

          const grid = calcUnidadesPorBultoGrid({
            dimBulto: dimBulto!,
            dimUnidad: dimUnidad!,
            espesorParedMm: espesor,
          });

          if (grid <= 0) {
            warnings.push(
              `${it.tipo_producto.codigo}: no entra por grilla con el bulto empresa seleccionado.`,
            );
          } else {
            unPorBulto = grid; // <- SIN tope por catálogo
            sourceUn = "BULTO_EMPRESA";
          }
        }
      }

      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );

      // warnings adicionales coherentes
      if (unPorBulto <= 0) {
        warnings.push(
          `${it.tipo_producto.codigo}: un/bulto inválido en B (revisar bulto empresa o dim_unidad_mm).`,
        );
      }
      if (parcial) {
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`,
        );
      }

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
          bultoEmpresaId: b?.id,
          bultoEmpresaCodigo: b?.codigo,
        },
      };
    });

    return {
      candidateKey: "B",
      titulo: "B · Recalcular con bultos de empresa",
      scope: "SKU",
      items,
      warnings,
      totales: {
        unidades: items.reduce((a, x) => a + x.unidades_planificadas, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
        bultosParciales: items.reduce(
          (a, x) => a + (isParcialRow(x) ? 1 : 0),
          0,
        ),
      },
    };
  }, [
    lote.items,
    pickBultoEmpresaForSku,
    bultoEmpresaIdGlobal,
    bultoEmpresaIdBySku,
    empresaBultos,
  ]);

  // =========================
  // Candidate C (catálogo + unidades editables)
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

      // 1) Bulto SIEMPRE catálogo (producto)
      const dimBulto = asDimBultoStd(it);
      if (!isValidDim(dimBulto)) {
        warnings.push(
          `${it.tipo_producto.codigo}: faltan dims catálogo (largo/ancho/alto_por_bulto).`,
        );
      }

      // 2) Capacidad SIEMPRE restricción del producto
      const unPorBulto = safePosInt(it.tipo_producto.unidad_entra_por_bulto, 0);
      if (unPorBulto <= 0) {
        warnings.push(
          `${it.tipo_producto.codigo}: unidad_entra_por_bulto inválido en catálogo.`,
        );
      }

      // 3) Recalcular bultos según nuevas unidades
      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );
      if (parcial) {
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`,
        );
      }

      const audit: BultoSimSnapshotItem["audit"] = {
        sourceUnPorBulto: "CATALOGO",
        sourceDims: "CATALOGO",
      };

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dimBulto,
        audit,
      };
    });

    const bultosParciales = items.reduce(
      (a, x) => a + (isParcialRow(x) ? 1 : 0),
      0,
    );

    return {
      candidateKey: "C",
      titulo: "C · Catálogo + unidades editables",
      scope: "SKU",
      items,
      warnings,
      totales: {
        unidades: items.reduce((a, x) => a + x.unidades_planificadas, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
        bultosParciales,
      },
    };
  }, [lote.items, planUnitsBySku]);

  // =========================
  // Candidate D (bulto empresa + unidades editables, MAXIMIZAR capacidad geométrica)
  // =========================

  const candidateD = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      const planStr =
        planUnitsBySku[it.tipo_producto_id] ?? String(it.cantidad_unidades);

      const unidadesPlan = safePosInt(
        planStr,
        safePosInt(it.cantidad_unidades, 0),
      );

      // 1) bulto empresa seleccionado
      const b = pickBultoEmpresaForSku(it.tipo_producto_id);
      const dimBulto: DimMm | null = b
        ? { largo: b.largo_mm, ancho: b.ancho_mm, alto: b.alto_mm }
        : null;

      const espesorParedMm = b?.espesor_pared_mm ?? 0;

      if (!isValidDim(dimBulto)) {
        warnings.push(
          `${it.tipo_producto.codigo}: en D debés seleccionar un bulto empresa válido (global o por SKU).`,
        );
      }

      // 2) dim unidad obligatoria para maximizar
      const dimUnidad = tryDimUnidad(it);
      if (!isValidDim(dimUnidad)) {
        warnings.push(
          `${it.tipo_producto.codigo}: falta dim_unidad_mm; no se puede maximizar ocupación.`,
        );
      }

      // 3) capacidad geométrica (grilla)
      let unPorBulto = 0;

      if (isValidDim(dimBulto) && isValidDim(dimUnidad)) {
        unPorBulto = calcUnidadesPorBultoGrid({
          dimBulto: dimBulto!,
          dimUnidad: dimUnidad!,
          espesorParedMm,
        });

        if (unPorBulto <= 0) {
          warnings.push(
            `${it.tipo_producto.codigo}: la unidad no entra por grilla con el bulto empresa seleccionado.`,
          );
        }
      }

      // 4) bultos según capacidad máxima
      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto,
      );

      if (unPorBulto <= 0) {
        warnings.push(
          `${it.tipo_producto.codigo}: un/bulto inválido en D (revisar bulto empresa o dim_unidad_mm).`,
        );
      }

      if (parcial) {
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`,
        );
      }

      const audit: BultoSimSnapshotItem["audit"] = {
        sourceUnPorBulto: unPorBulto > 0 ? "BULTO_EMPRESA" : "FALLBACK",
        sourceDims: isValidDim(dimBulto) ? "BULTO_EMPRESA" : "FALLBACK",
        bultoEmpresaId: b?.id,
        bultoEmpresaCodigo: b?.codigo,
      };

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dimBulto,
        audit,
      };
    });

    const bultosParciales = items.reduce(
      (a, x) => a + (isParcialRow(x) ? 1 : 0),
      0,
    );

    return {
      candidateKey: "D",
      titulo: "D · Maximizar ocupación (bulto empresa + unidades)",
      scope: "SKU",
      items,
      warnings,
      totales: {
        unidades: items.reduce((a, x) => a + x.unidades_planificadas, 0),
        bultos: items.reduce((a, x) => a + x.cantidad_bultos, 0),
        bultosParciales,
      },
    };
  }, [lote.items, planUnitsBySku, pickBultoEmpresaForSku]);

  const [selected, setSelected] = useState<"A" | "B" | "C" | "D">("A");

  const active =
    selected === "A"
      ? candidateA
      : selected === "B"
        ? candidateB
        : selected === "C"
          ? candidateC
          : candidateD;

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

  const guardarYContinuar = async () => {
    if (!draftLayout) return;

    setApplyError(null);
    setApplyLoading(true);

    try {
      const snapToApply = { ...active, layout3d: draftLayout };

      // 1) siempre: simulación
      await applyBultoSnapshotToSimulacion({
        simulacionId,
        snap: snapToApply,
      });

      // 2) si hay lote asociado: publicar también al lote
      if (effectiveLoteId != null) {
        await applyBultoSnapshotToLote({
          loteId: effectiveLoteId,
          snap: snapToApply,
        });
      }

      setAppliedSnap(snapToApply);
      onApply(snapToApply);
    } catch (e: any) {
      console.error(e);
      setApplyError(e?.message ?? "No se pudo guardar el bulto.");
    } finally {
      setApplyLoading(false);
    }
  };

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

  // 3) Si edito demanda en C o D, invalido layout
  useEffect(() => {
    if (selected !== "C" && selected !== "D") return;
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
        </div>

        <div className="flex flex-wrap gap-2">
          {pill(`Tipo de productos: ${lote.items.length}`)}
        </div>

        {/* Selector A/B/C */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-600">
            Opciones de cubicación.
          </label>

          <div className="grid gap-2">
            {(["A", "B", "C", "D"] as const).map((k) => {
              const snap =
                k === "A"
                  ? candidateA
                  : k === "B"
                    ? candidateB
                    : k === "C"
                      ? candidateC
                      : candidateD;
              const isActive = selected === k;

              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelected(k)}
                  className={[
                    "w-full text-left rounded-lg border p-3 transition",
                    "cursor-pointer",
                    isActive
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300",
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
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {(selected === "B" || selected === "C" || selected === "D") && (
          <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
            <p className="text-xs font-medium text-slate-700">
              {selected === "B"
                ? "Operativo (B)"
                : selected === "C"
                  ? "Operativo (C)"
                  : "Operativo (D)"}
            </p>

            {/* selector bulto empresa: B y D */}
            {(selected === "B" || selected === "D") &&
              empresaBultos.length > 0 && (
                <div className="rounded-md border bg-white p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-700">
                    Bultos empresa
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
                  </div>
                </div>
              )}

            {/* demanda editable: C y D */}
            {(selected === "C" || selected === "D") && (
              <div className="rounded-md border bg-white p-3">
                <p className="text-xs font-medium text-slate-700">
                  Demanda por SKU (editable)
                </p>

                <div className="mt-3 max-h-72 overflow-auto rounded-md border">
                  <ul className="divide-y text-xs">
                    {lote.items.map((it) => {
                      const id = it.tipo_producto_id;
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

                          <p className="text-[11px] text-slate-500">
                            Unidad (dim_unidad_mm): {fmtDim(tryDimUnidad(it))}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
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
                      simulacionId:
                        typeof simulacionId === "number"
                          ? simulacionId
                          : undefined,
                      snap: active,
                      bultoOverrideMm:
                        activeItemForViewer?.dim_bulto_mm ?? null,
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

              {/* 2) Guardar y continuar (simulación + lote si existe) */}
              <button
                type="button"
                disabled={!canApply || applyLoading}
                onClick={guardarYContinuar}
                className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyLoading ? "Guardando..." : "Guardar y continuar"}
              </button>

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
                  <p className="mt-1 text-slate-700">
                    Capacidad por bulto:{it.unidades_por_bulto}
                  </p>
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
