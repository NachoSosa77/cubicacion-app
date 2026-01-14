"use client";

import { useMemo, useState } from "react";
import { BultoSimSnapshot } from "../types/types";

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
  tipo_bulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bulto_empresa_id?: number | null;
  unidades_totales: number;
  bultos_totales: number;
  items: ClientLoteItem[];
};

type SourceTag = "SNAPSHOT" | "CATALOGO" | "BULTO_EMPRESA" | "FALLBACK";

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
 * Cálculo simple “pro” para demo:
 * unidades_por_bulto se deriva por encaje tipo grilla (sin rotaciones).
 * Interior = dims - 2*espesor (si aplica)
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
  const rem = unidadesPlan % unPorBulto;
  const parcial = rem !== 0;
  const sobrante = parcial ? rem : 0; // ✅ correcto: si no es parcial, sobrante=0
  return { bultos, sobrante, parcial };
}

export function BultoPanel({
  lote,
  empresaBultos,
  onApply,
}: {
  lote: ClientLote;
  empresaBultos: EmpresaBulto[];
  onApply: (snap: BultoSimSnapshot) => void;
}) {
  // =========================
  // Estado Operativo (C)
  // =========================

  // Demanda simulada por SKU (editable) — default: cantidad_unidades del lote
  const [planUnitsBySku, setPlanUnitsBySku] = useState<Record<number, string>>(
    () =>
      Object.fromEntries(
        lote.items.map((it) => [
          it.tipo_producto_id,
          String(it.cantidad_unidades),
        ])
      )
  );

  // Selección de bulto empresa (global + por SKU)
  const defaultEmpresaBultoId =
    lote.bulto_empresa_id ??
    empresaBultos.find((b) => b.es_preferido)?.id ??
    empresaBultos[0]?.id ??
    null;

  const [bultoEmpresaIdGlobal, setBultoEmpresaIdGlobal] = useState<number | "">(
    defaultEmpresaBultoId ?? ""
  );

  const [bultoEmpresaIdBySku, setBultoEmpresaIdBySku] = useState<
    Record<number, number | "">
  >({});

  const empresaBultoMap = useMemo(() => {
    const m = new Map<number, EmpresaBulto>();
    for (const b of empresaBultos) m.set(b.id, b);
    return m;
  }, [empresaBultos]);

  const pickBultoEmpresaForSku = (
    tipoProductoId: number
  ): EmpresaBulto | null => {
    const skuId = bultoEmpresaIdBySku[tipoProductoId];
    if (typeof skuId === "number") return empresaBultoMap.get(skuId) ?? null;

    if (typeof bultoEmpresaIdGlobal === "number")
      return empresaBultoMap.get(bultoEmpresaIdGlobal) ?? null;

    // fallback
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
        0
      );
      const unPorBulto = unPorBultoSnapshot ?? unPorBultoFallback;

      const unidadesPlan = safePosInt(it.cantidad_unidades, 0);

      // Respetar baseline del lote si hay bultos snapshot
      const bultosSnapshot = safePosInt(it.cantidad_bultos, 0);
      const {
        bultos: bultosCalc,
        sobrante,
        parcial,
      } = calcBultos(unidadesPlan, unPorBulto);
      const bultos = bultosSnapshot > 0 ? bultosSnapshot : bultosCalc;

      const dim =
        lote.tipo_bulto === "PRODUCTO_ESTANDAR" ? asDimBultoStd(it) : null;

      if (unPorBulto <= 0)
        warnings.push(`${it.tipo_producto.codigo}: un/bulto inválido.`);
      if (lote.tipo_bulto === "PRODUCTO_ESTANDAR" && !isValidDim(dim))
        warnings.push(`${it.tipo_producto.codigo}: faltan dims estándar.`);
      if (parcial)
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`
        );

      const sourceUn: SourceTag =
        unPorBultoSnapshot != null ? "SNAPSHOT" : "FALLBACK";
      const sourceDim: SourceTag =
        lote.tipo_bulto === "PRODUCTO_ESTANDAR" ? "CATALOGO" : "FALLBACK";

      return {
        tipo_producto_id: it.tipo_producto_id,
        codigo: it.tipo_producto.codigo,
        unidades_planificadas: unidadesPlan,
        unidades_por_bulto: unPorBulto,
        cantidad_bultos: bultos,
        sobrante_unidades: sobrante,
        dim_bulto_mm: dim,
        audit: { sourceUnPorBulto: sourceUn, sourceDims: sourceDim },
      };
    });

    const unidades =
      safePosInt(lote.unidades_totales, 0) ||
      items.reduce((a, x) => a + x.unidades_planificadas, 0);

    const bultos =
      safePosInt(lote.bultos_totales, 0) ||
      items.reduce((a, x) => a + x.cantidad_bultos, 0);

    const bultosParciales = items.reduce(
      (a, x) =>
        a +
        (x.unidades_por_bulto > 0 &&
        x.unidades_planificadas % x.unidades_por_bulto !== 0
          ? 1
          : 0),
      0
    );

    return {
      candidateKey: "A",
      titulo: "A · Snapshot actual del lote",
      scope: "SKU",
      items,
      warnings,
      totales: { unidades, bultos, bultosParciales },
    };
  }, [lote]);

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
        unPorBulto
      );

      const dim = asDimBultoStd(it);

      if (unPorBulto <= 0)
        warnings.push(
          `${it.tipo_producto.codigo}: un/bulto inválido catálogo.`
        );
      if (!isValidDim(dim))
        warnings.push(`${it.tipo_producto.codigo}: faltan dims estándar.`);
      if (parcial)
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`
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
        audit: {
          sourceUnPorBulto: TAG_CATALOGO,
          sourceDims: TAG_CATALOGO,
        },
      };
    });

    return {
      candidateKey: "B",
      titulo: "B · Catálogo (un/bulto + dims estándar)",
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
          0
        ),
      },
    };
  }, [lote.items]);

  // =========================
  // Candidate C (operativo “pro”)
  // - editable: demanda (unidades planificadas)
  // - derivado: unidades_por_bulto según bulto empresa + dim_unidad_mm (si existe)
  // =========================

  const candidateC = useMemo<BultoSimSnapshot>(() => {
    const warnings: string[] = [];

    const items = lote.items.map((it) => {
      // demanda simulada (editable)
      const planStr =
        planUnitsBySku[it.tipo_producto_id] ?? String(it.cantidad_unidades);
      const unidadesPlan = safePosInt(
        planStr,
        safePosInt(it.cantidad_unidades, 0)
      );

      // dims de bulto según modo
      let dimBulto: DimMm | null = null;
      let sourceDim: SourceTag = "FALLBACK";
      let bultoEmpresaId: number | null | undefined = null;
      let bultoEmpresaCodigo: string | null | undefined = null;
      let espesorParedMm = 0;

      if (lote.tipo_bulto === "PRODUCTO_ESTANDAR") {
        dimBulto = asDimBultoStd(it);
        sourceDim = isValidDim(dimBulto) ? "CATALOGO" : "FALLBACK";
      } else {
        const b = pickBultoEmpresaForSku(it.tipo_producto_id);
        if (b) {
          dimBulto = { largo: b.largo_mm, ancho: b.ancho_mm, alto: b.alto_mm };
          sourceDim = "BULTO_EMPRESA";
          bultoEmpresaId = b.id;
          bultoEmpresaCodigo = b.codigo;
          espesorParedMm = b.espesor_pared_mm ?? 0;
        } else {
          dimBulto = null;
          sourceDim = "FALLBACK";
        }
      }

      // unidades por bulto derivado:
      // - si hay dim_unidad_mm y dimBulto válido → grid
      // - si no → fallback catálogo
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
            lote.tipo_bulto === "EMPRESA_BULTO" ? "BULTO_EMPRESA" : "CATALOGO";
        }
      }

      if (unPorBulto <= 0) {
        unPorBulto = safePosInt(it.tipo_producto.unidad_entra_por_bulto, 0);
        sourceUn = "CATALOGO";
        warnings.push(
          `${it.tipo_producto.codigo}: sin dim_unidad_mm o no entra por grilla; usando catálogo (unidad_entra_por_bulto).`
        );
      }

      const { bultos, sobrante, parcial } = calcBultos(
        unidadesPlan,
        unPorBulto
      );

      if (!Number.isFinite(unidadesPlan) || unidadesPlan <= 0)
        warnings.push(
          `${it.tipo_producto.codigo}: unidades planificadas inválidas.`
        );
      if (unPorBulto <= 0)
        warnings.push(
          `${it.tipo_producto.codigo}: un/bulto inválido (resultado).`
        );
      if (!isValidDim(dimBulto)) {
        warnings.push(
          `${it.tipo_producto.codigo}: faltan dimensiones de bulto para simular.`
        );
      }
      if (parcial)
        warnings.push(
          `${it.tipo_producto.codigo}: último bulto parcial (${sobrante} un).`
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
          bultoEmpresaId: bultoEmpresaId ?? undefined,
          bultoEmpresaCodigo: bultoEmpresaCodigo ?? undefined,
        },
      };
    });

    const bultosParciales = items.reduce(
      (a, x) =>
        a +
        (x.unidades_por_bulto > 0 &&
        x.unidades_planificadas % x.unidades_por_bulto !== 0
          ? 1
          : 0),
      0
    );

    return {
      candidateKey: "C",
      titulo: "C · Operativo (demanda editable + bulto empresa)",
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">1) Bulto</h2>
          <p className="mt-1 text-xs text-slate-500">
            Definí el bulto base (A/B/C). Este snapshot alimenta Pallet y
            Camión.
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

      {/* Config operativa para C */}
      {selected === "C" && (
        <div className="rounded-lg border bg-slate-50 p-3 space-y-3">
          <p className="text-xs font-medium text-slate-700">Operativo (C)</p>

          {lote.tipo_bulto === "EMPRESA_BULTO" && (
            <div className="rounded-md border bg-white p-3 space-y-2">
              <p className="text-xs font-medium text-slate-700">
                Selección de bulto empresa (define dimensiones)
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
                      e.target.value === "" ? "" : Number(e.target.value)
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
                  El un/bulto se deriva con dim_unidad_mm (si existe). Si falta,
                  cae a catálogo.
                </p>
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
                    lote.tipo_bulto === "EMPRESA_BULTO"
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
                            onChange={(e) => setPlanForSku(id, e.target.value)}
                          />
                        </div>

                        {lote.tipo_bulto === "EMPRESA_BULTO" && (
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
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Unidad (dim_unidad_mm): {fmtDim(tryDimUnidad(it))}
                        {" · "}
                        Bulto:{" "}
                        {lote.tipo_bulto === "PRODUCTO_ESTANDAR"
                          ? fmtDim(asDimBultoStd(it))
                          : chosenBulto
                          ? `${chosenBulto.largo_mm}×${chosenBulto.ancho_mm}×${chosenBulto.alto_mm} mm`
                          : "—"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            En C, el usuario decide la demanda; el sistema deriva un/bulto en
            función del bulto disponible y los datos de unidad.
          </p>
        </div>
      )}

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

      {/* Vista rápida */}
      <div className="rounded-lg border p-3">
        <p className="text-xs font-medium text-slate-700">Vista rápida</p>

        <div className="mt-2 max-h-72 overflow-auto rounded-md border">
          <ul className="divide-y text-xs">
            {active.items.map((it) => (
              <li key={it.tipo_producto_id} className="p-3">
                <p className="font-semibold text-slate-900">{it.codigo}</p>

                <p className="mt-1 text-slate-700">
                  {it.unidades_planificadas} un plan · {it.cantidad_bultos}{" "}
                  bultos · {it.unidades_por_bulto} un/bulto
                  {it.unidades_por_bulto > 0 &&
                  it.unidades_planificadas % it.unidades_por_bulto !== 0 ? (
                    <span className="text-amber-700">
                      {" "}
                      · parcial ({it.sobrante_unidades} un)
                    </span>
                  ) : null}
                </p>

                <p className="mt-1 text-slate-500">
                  Dim bulto: {fmtDim(it.dim_bulto_mm)}
                  {" · "}
                  <span className="text-[11px]">
                    un/bulto:{" "}
                    <span className="font-medium">
                      {it.audit.sourceUnPorBulto}
                    </span>
                    {" · "}
                    dims:{" "}
                    <span className="font-medium">{it.audit.sourceDims}</span>
                    {it.audit.bultoEmpresaCodigo ? (
                      <>
                        {" · "}
                        bulto:{" "}
                        <span className="font-medium">
                          {it.audit.bultoEmpresaCodigo}
                        </span>
                      </>
                    ) : null}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
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
