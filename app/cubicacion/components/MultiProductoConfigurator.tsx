"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { IEmpresaBulto } from "../actions/empresaBultoActions";
import { ITipoProducto } from "../actions/productoActions";
import type {
  MultiProductoConfiguracionInput,
  MultiProductoConfiguracionItemInput,
} from "../actions/saveMultiProductoConfiguracion";
import { calcularUnidadEnBulto } from "../lib/cubicacion";
import {
  evaluarBultosEmpresa,
  MultiProductoUnidadInputReal,
} from "../lib/evaluar-bultos-empresa";
import { PACKING_POLICY_LABELS, PackingPolicy } from "../lib/packing-policy";
import type { CubicacionBulto3DInput, DimMm } from "../types/cubicacion-3d";
import { CubicacionBultoViewer3D } from "./CubicacionBultoViewer3D";

/* ============================
   Types
============================ */

type ItemState = {
  key: string;
  productoId: number | "";
  cantidadUnidades: string;
  largoUnidadMm: string;
  anchoUnidadMm: string;
  altoUnidadMm: string;
};

interface Props {
  productos: ITipoProducto[];
  bultosEmpresa: IEmpresaBulto[];
  onSubmit: (
    input: MultiProductoConfiguracionInput
  ) => Promise<{ loteId: number }>;
}

type OpcionCubicacion = {
  kind: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  key: string;
  titulo: string;
  subtitulo?: string;

  // Nota: para PRODUCTO_ESTANDAR lo anulamos (Regla 1)
  ocupacionPct?: number | null;

  unidadesTotales: number;
  unidadesEnBulto1: number;
  bultosNecesariosEstimados: number;

  bultoEmpresaId?: number;
  productoId?: number;

  previewParcial?: boolean;

  data3d: CubicacionBulto3DInput;
};

type PackStdPolicy = "LIMITADO_POR_PRODUCTO" | "MAXIMIZAR_POR_CUBICACION";

/* ============================
   Utils
============================ */

const numberOrNull = (value: string): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isNotNull = <T,>(x: T | null): x is T => x !== null;

const numPos = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function ceilDiv(a: number, b: number): number {
  if (b <= 0) return 999999;
  return Math.ceil(a / b);
}

const toDimMm = (d: any): DimMm => ({
  largo: Number(d?.largo ?? 0),
  ancho: Number(d?.ancho ?? 0),
  alto: Number(d?.alto ?? 0),
});

function gridCapacity(dimInterna: DimMm, dimUnidad: DimMm): number {
  const nx = Math.floor(dimInterna.largo / dimUnidad.largo);
  const nz = Math.floor(dimInterna.ancho / dimUnidad.ancho);
  const ny = Math.floor(dimInterna.alto / dimUnidad.alto);
  if (nx <= 0 || nz <= 0 || ny <= 0) return 0;
  return nx * nz * ny;
}

function buildGridPlacements(
  dimInterna: DimMm,
  dimUnidad: DimMm,
  count: number
): { x: number; y: number; z: number }[] {
  const nx = Math.floor(dimInterna.largo / dimUnidad.largo);
  const nz = Math.floor(dimInterna.ancho / dimUnidad.ancho);
  const ny = Math.floor(dimInterna.alto / dimUnidad.alto);

  if (nx <= 0 || nz <= 0 || ny <= 0) return [];

  const max = nx * nz * ny;
  const take = Math.max(0, Math.min(count, max));

  const out: { x: number; y: number; z: number }[] = [];

  const startX = -dimInterna.largo / 2 + dimUnidad.largo / 2;
  const startZ = -dimInterna.ancho / 2 + dimUnidad.ancho / 2;
  const startY = -dimInterna.alto / 2 + dimUnidad.alto / 2;

  let placed = 0;
  for (let iy = 0; iy < ny && placed < take; iy++) {
    for (let iz = 0; iz < nz && placed < take; iz++) {
      for (let ix = 0; ix < nx && placed < take; ix++) {
        out.push({
          x: startX + ix * dimUnidad.largo,
          y: startY + iy * dimUnidad.alto,
          z: startZ + iz * dimUnidad.ancho,
        });
        placed++;
      }
    }
  }
  return out;
}

function buildSinglePlacementOnFloor(
  dimInterna: DimMm,
  dimUnidad: DimMm
): { x: number; y: number; z: number } {
  // Centro en X/Z, apoyada en el “piso” del bulto interno (y = -alto/2 + altoUnidad/2)
  return {
    x: 0,
    z: 0,
    y: -dimInterna.alto / 2 + dimUnidad.alto / 2,
  };
}

/* ============================
   Debug (opt-in)
============================ */

const DEBUG_PACKING_UI =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_DEBUG_PACKING === "true" ||
    process.env.DEBUG_PACKING === "true");

function dbgUI(...args: any[]) {
  if (!DEBUG_PACKING_UI) return;
   
  console.log(...args);
}

/* ============================
   Descartes (UI)
============================ */

type BultoDescartado = {
  bultoId: number;
  codigo: string;
  dimInterna: DimMm;
  motivos: string[];
};

/* ============================
   Component
============================ */

export function MultiProductoConfigurator({
  productos,
  bultosEmpresa,
  onSubmit,
}: Props) {
  const [items, setItems] = useState<ItemState[]>([
    {
      key: crypto.randomUUID(),
      productoId: "",
      cantidadUnidades: "",
      largoUnidadMm: "",
      anchoUnidadMm: "",
      altoUnidadMm: "",
    },
  ]);

  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [opcionSeleccionada, setOpcionSeleccionada] = useState<number | null>(
    null
  );

  const [modoSimulacion, setModoSimulacion] = useState(false);
  type SimModeUI = { kind: "MAX" } | { kind: "PCT"; pct: number };

  const [simMode, setSimMode] = useState<SimModeUI>({ kind: "MAX" });

  const [packStdPolicy, setPackStdPolicy] = useState<PackStdPolicy>(
    "LIMITADO_POR_PRODUCTO"
  );

  const router = useRouter();

  const [packingPolicy, setPackingPolicy] =
    useState<PackingPolicy>("OPERATIVO_AGRUPADO");

  /* ============================
     UI handlers
  ============================ */

  const agregarFila = () => {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productoId: "",
        cantidadUnidades: "",
        largoUnidadMm: "",
        anchoUnidadMm: "",
        altoUnidadMm: "",
      },
    ]);
  };

  const eliminarFila = (key: string) => {
    setItems((prev) =>
      prev.length <= 1 ? prev : prev.filter((x) => x.key !== key)
    );
  };

  const actualizarItem = (key: string, campo: keyof ItemState, valor: any) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [campo]: valor } : it))
    );
  };

  const seleccionarProducto = (key: string, productoId: number | "") => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, productoId } : it))
    );
  };

  /* ============================
     Validaciones base
  ============================ */

  const hayProductosDuplicados = useMemo(() => {
    const seen = new Set<number>();
    for (const item of items) {
      if (typeof item.productoId === "number") {
        if (seen.has(item.productoId)) return true;
        seen.add(item.productoId);
      }
    }
    return false;
  }, [items]);

  /* ============================
     Base para cálculo empresa
  ============================ */

  const productosSeleccionadosCount = useMemo(
    () => items.filter((i) => typeof i.productoId === "number").length,
    [items]
  );

  const itemsMultiReal = useMemo((): MultiProductoUnidadInputReal[] => {
    return items
      .map((item): MultiProductoUnidadInputReal | null => {
        const producto = productos.find((p) => p.id === item.productoId);

        const cantidad = numberOrNull(item.cantidadUnidades);

        const largo = Number(item.largoUnidadMm);
        const ancho = Number(item.anchoUnidadMm);
        const alto = Number(item.altoUnidadMm);

        const dimsOk =
          Number.isFinite(largo) &&
          largo > 0 &&
          Number.isFinite(ancho) &&
          ancho > 0 &&
          Number.isFinite(alto) &&
          alto > 0;

        if (!producto) return null;
        if (cantidad === null || cantidad <= 0) return null;
        if (!dimsOk) return null;

        const codigoProducto = String((producto as any).codigo ?? "").trim();
        if (!codigoProducto) return null;

        const pack = Number(
          (producto as any).unidades_por_unidad_entrega ??
            (producto as any).unidad_entra_por_bulto ??
            0
        );

        const pesoPorBulto = Number((producto as any).peso_por_bulto ?? 0);

        const pesoUnidadKg =
          Number.isFinite(pesoPorBulto) &&
          pesoPorBulto > 0 &&
          Number.isFinite(pack) &&
          pack > 0
            ? pesoPorBulto / pack
            : null;

        const parseNum = (v: any): number | null => {
          if (v === null || v === undefined) return null;
          const s = String(v).replace(",", ".").trim();
          const n = Number(s);
          return Number.isFinite(n) ? n : null;
        };
        return {
          itemKey: item.key,
          productoId: producto.id,
          codigoProducto,
          descripcionProducto: String((producto as any).descripcion ?? ""),
          cantidadUnidades: cantidad,
          volumenUnidadM3: (largo * ancho * alto) / 1_000_000_000,
          dimUnidadMm: { largo, ancho, alto },
          pesoUnidadKg,
          apilable: Boolean((producto as any).apilable ?? true),
          maxCargaSuperiorKg: parseNum(
            (producto as any).max_carga_superior_por_unidad_kg
          ),
          factorSeguridadCompresion: parseNum(
            (producto as any).factor_seguridad_compresion
          ),
        };
      })
      .filter(isNotNull);
  }, [items, productos]);

  const isMultiProducto = itemsMultiReal.length >= 2;

  const hayBultosEmpresaHabilitados = useMemo(
    () => bultosEmpresa.some((b) => b.habilitado),
    [bultosEmpresa]
  );

  const mostrarPolicy =
    itemsMultiReal.length > 0 && hayBultosEmpresaHabilitados;

  useEffect(() => {
    console.log("DBG UI:", {
      itemsMultiRealLen: itemsMultiReal.length,
      hayBultosEmpresaHabilitados,
      packingPolicy,
      bultosEmpresaLen: bultosEmpresa.length,
      bultosEmpresaHabilitados: bultosEmpresa.map((b) => ({
        codigo: b.codigo,
        habilitado: b.habilitado,
        tipo: typeof (b as any).habilitado,
      })),
      itemsMultiReal: itemsMultiReal.map((it) => ({
        codigo: it.codigoProducto,
        cantidad: it.cantidadUnidades,
        vol: it.volumenUnidadM3,
        dim: it.dimUnidadMm,
      })),
    });
  }, [
    itemsMultiReal,
    hayBultosEmpresaHabilitados,
    packingPolicy,
    bultosEmpresa,
  ]);
  /* ============================
     ✅ Evaluaciones (dependen de policy)
  ============================ */

  console.log("bultosEmpresa:", bultosEmpresa?.length, bultosEmpresa);
  console.log("itemsMultiReal:", itemsMultiReal);

  /* const evaluacionesAll = useMemo(() => {
    if (!itemsMultiReal.length) return [];
    if (!hayBultosEmpresaHabilitados) return [];
    return evaluarBultosEmpresa(
      itemsMultiReal,
      bultosEmpresa,
      packingPolicy,
      modoPacking
    );
  }, [
    itemsMultiReal,
    bultosEmpresa,
    packingPolicy,
    hayBultosEmpresaHabilitados,
  ]); */

  const evaluacionesAll = useMemo(() => {
    if (!itemsMultiReal.length) {
      return [];
    }

    if (!hayBultosEmpresaHabilitados) {
      return [];
    }
    const modoPacking = modoSimulacion ? simMode : { kind: "MAX" as const };

    const res = evaluarBultosEmpresa(
      itemsMultiReal,
      bultosEmpresa,
      packingPolicy,
      modoPacking
    );

    return res;
  }, [
    itemsMultiReal,
    bultosEmpresa,
    packingPolicy,
    hayBultosEmpresaHabilitados,
  ]);

  const topBultosEmpresa = useMemo(() => {
    return evaluacionesAll.filter((e) => e.viable).slice(0, 3);
  }, [evaluacionesAll]);

  /* ============================
     ✅ Descartados (FIX: solo !viable)
  ============================ */

  const bultosDescartados = useMemo((): BultoDescartado[] => {
    if (!evaluacionesAll.length) return [];

    return evaluacionesAll
      .filter((e) => !e.viable)
      .map((e) => {
        const b = (e as any).bulto;
        const bultoId = Number(b?.id ?? 0);

        return {
          bultoId,
          codigo: String(b?.codigo ?? "").trim() || "Sin código",
          dimInterna: e.dimInternaMm as unknown as DimMm,
          motivos: (e.motivosNoViable?.length
            ? e.motivosNoViable
            : ["No viable."]) as string[],
        };
      })
      .filter((x) => Number.isFinite(x.bultoId) && x.bultoId > 0);
  }, [evaluacionesAll]);

  /* ============================
     Opciones unificadas
  ============================ */

  const safeCodigo = (v: unknown, fallback: string) => {
    const s = typeof v === "string" ? v.trim() : "";
    return s.length ? s : fallback;
  };

  const opciones = useMemo((): OpcionCubicacion[] => {
    if (!itemsMultiReal.length) return [];

    const out: OpcionCubicacion[] = [];
    const unidadesTotalesAll = itemsMultiReal.reduce(
      (acc, it) => acc + it.cantidadUnidades,
      0
    );

    // ===== 1) Bulto estándar del producto (solo si hay 1 producto válido)
    if (itemsMultiReal.length === 1) {
      const it = itemsMultiReal[0];
      const producto = productos.find((p) => p.id === it.productoId);

      if (producto) {
        const bL = numPos((producto as any).largo_por_bulto);
        const bA = numPos((producto as any).ancho_por_bulto);
        const bH = numPos((producto as any).alto_por_bulto);

        if (bL && bA && bH) {
          const res = calcularUnidadEnBulto({
            producto,
            dimUnidadMm: it.dimUnidadMm,
            grosorParedMm: 0,
            dimExternaBultoMm: { largo: bL, ancho: bA, alto: bH },
          });

          if (res) {
            const dimInterna: DimMm = toDimMm(res.dimInternaBulto);

            const capFisica = gridCapacity(dimInterna, it.dimUnidadMm);

            const packDeclaradoRaw = Number(
              (producto as any).unidades_por_unidad_entrega ??
                (producto as any).unidad_entra_por_bulto ??
                0
            );
            const packDeclarado =
              Number.isFinite(packDeclaradoRaw) && packDeclaradoRaw > 0
                ? packDeclaradoRaw
                : null;

            const capacidadElegida =
              packStdPolicy === "MAXIMIZAR_POR_CUBICACION"
                ? capFisica
                : packDeclarado ?? capFisica;

            const unidadesEnBulto1 = Math.min(
              it.cantidadUnidades,
              capacidadElegida
            );
            const bultosNecesariosEstimados =
              capacidadElegida > 0
                ? ceilDiv(it.cantidadUnidades, capacidadElegida)
                : 999999;

            const ocupacionPct = null;

            // ✅ VISUAL PROFESIONAL (pack cerrado):
            // Dibujamos el pack real del “bulto 1” (unidadesEnBulto1),
            // pero sin mentir: si físicamente no entra, dibujamos lo máximo que entra.
            // Si capFisica = 0, dibujamos 1 unidad referencia.
            let unidadesDibujadas = unidadesEnBulto1;

            if (capFisica <= 0) {
              unidadesDibujadas = 1;
            } else {
              // si el pack declarado excede la capacidad física, el viewer debe ser honesto
              if (unidadesDibujadas > capFisica) unidadesDibujadas = capFisica;

              // si por alguna razón unidadesEnBulto1 es 0 pero hay capacidad física,
              // al menos dibujamos 1 para evitar bulto vacío (solo visual)
              if (unidadesDibujadas <= 0) unidadesDibujadas = 1;
            }

            let placements = buildGridPlacements(
              dimInterna,
              it.dimUnidadMm,
              unidadesDibujadas
            );

            if (placements.length === 0) {
              placements = [
                buildSinglePlacementOnFloor(dimInterna, it.dimUnidadMm),
              ];
            }

            const data3d: CubicacionBulto3DInput = {
              bulto: {
                codigo:
                  String((producto as any).codigo ?? "").trim() ||
                  `PROD-${producto.id}`,
                dimExternaMm: { largo: bL, ancho: bA, alto: bH },
                dimInternaMm: dimInterna,
              },
              contenido: placements.map((pos) => ({
                productoId: it.productoId,
                codigo:
                  (typeof it.codigoProducto === "string" &&
                    it.codigoProducto.trim()) ||
                  `PROD-${it.productoId}`,
                unidades: 1,
                dimUnidadMm: it.dimUnidadMm,
                positionMm: pos,
              })),
            };

            const codigo = String((producto as any).codigo ?? "").trim();

            out.push({
              kind: "PRODUCTO_ESTANDAR",
              key: `producto-std-${producto.id}`,
              titulo: `Bulto estándar (producto) · ${codigo || "Producto"}`,
              subtitulo: `Pack definido por el producto · ${bL}×${bA}×${bH} mm${
                packDeclarado ? ` · ${packDeclarado} unid/bulto` : ""
              }`,
              ocupacionPct,
              unidadesTotales: it.cantidadUnidades,
              unidadesEnBulto1,
              bultosNecesariosEstimados,
              data3d,
              productoId: producto.id,
            });
          }
        }
      }
    }

    // ===== 2) Opciones empresa — usa packing3D (fiel)
    // ===== 2) Opciones empresa — preview fiel si hay placements; fallback si no
    for (const opt of topBultosEmpresa) {
      const b = (opt as any).bulto;
      const bultoId = Number(b?.id ?? 0);

      const p3d = (opt as any).packing3D ?? null;

      const placementsOk = (p3d?.placementsBulto1 ?? []).filter((pl: any) => {
        const d = pl?.dimUnidadMm;
        const pos = pl?.posCentroMm;
        return (
          pos &&
          Number.isFinite(pos.x) &&
          Number.isFinite(pos.y) &&
          Number.isFinite(pos.z) &&
          d &&
          Number(d.largo) > 0 &&
          Number(d.ancho) > 0 &&
          Number(d.alto) > 0
        );
      });

      const previewParcial = !(p3d && placementsOk.length);

      // Dimensiones del bulto (externas)
      const dimExterna = toDimMm({
        largo: b?.largo_mm,
        ancho: b?.ancho_mm,
        alto: b?.alto_mm,
      });

      // Dim interna: si el motor la trae, usamos esa; si no, usamos externa como fallback visual
      const dimInternaFallback: DimMm = p3d?.dimInternaMm
        ? toDimMm(p3d.dimInternaMm)
        : dimExterna;

      let data3d: CubicacionBulto3DInput;

      if (!previewParcial) {
        // ✅ Preview fiel (motor)
        data3d = {
          bulto: {
            codigo: String(b?.codigo ?? "").trim() || "BULTO",
            dimExternaMm: dimExterna,
            dimInternaMm: toDimMm(p3d.dimInternaMm),
          },
          contenido: placementsOk.map((pl: any) => ({
            productoId: pl.productoId,
            codigo: String(pl.codigo ?? "").trim() || `PROD-${pl.productoId}`,
            unidades: 1,
            dimUnidadMm: toDimMm(pl.dimUnidadMm),
            positionMm: {
              x: pl.posCentroMm.x,
              y: pl.posCentroMm.y,
              z: pl.posCentroMm.z,
            },
          })),
        };
      } else {
        // ✅ Preview parcial (fallback): 1 unidad “representativa”
        const first = itemsMultiReal[0];
        const pos = buildSinglePlacementOnFloor(
          dimInternaFallback,
          first.dimUnidadMm
        );

        data3d = {
          bulto: {
            codigo: String(b?.codigo ?? "").trim() || "BULTO",
            dimExternaMm: dimExterna,
            dimInternaMm: dimInternaFallback,
          },
          contenido: [
            {
              productoId: first.productoId,
              codigo:
                typeof first.codigoProducto === "string" &&
                first.codigoProducto.trim()
                  ? first.codigoProducto.trim()
                  : `PROD-${Number(first.productoId ?? 0)}`,
              unidades: 1,
              dimUnidadMm: first.dimUnidadMm,
              positionMm: pos,
            },
          ],
        };
      }

      const codigoB = String(b?.codigo ?? "").trim() || "Sin código";

      // Métricas: si no hay packing3D, degradamos a defaults presentables
      const unidadesEnBulto1 =
        typeof p3d?.unidadesEnBulto1 === "number"
          ? p3d.unidadesEnBulto1
          : Math.min(unidadesTotalesAll, 1);

      const bultosNecesariosEstimados =
        typeof p3d?.bultosNecesariosEstimados === "number"
          ? p3d.bultosNecesariosEstimados
          : 1;

      const ocupacionPct =
        typeof p3d?.ocupacionVolumetricaPct === "number"
          ? p3d.ocupacionVolumetricaPct
          : null;

      out.push({
        kind: "EMPRESA_BULTO",
        key: `empresa-${
          Number.isFinite(bultoId) && bultoId > 0 ? bultoId : codigoB
        }`,
        bultoEmpresaId:
          Number.isFinite(bultoId) && bultoId > 0 ? bultoId : undefined,
        titulo: `Bulto empresa · ${codigoB}`,
        subtitulo: `${isMultiProducto ? "Multi-producto" : "1 producto"} · ${
          PACKING_POLICY_LABELS[packingPolicy].titulo
        }${previewParcial ? " · Preview parcial" : ""}`,
        ocupacionPct,
        unidadesTotales: p3d?.unidadesTotales ?? unidadesTotalesAll,
        unidadesEnBulto1,
        bultosNecesariosEstimados,
        previewParcial,
        data3d,
      });
    }

    // ✅ Deduplicación segura
    const seen = new Set<string>();
    const dedup: OpcionCubicacion[] = [];
    for (const o of out) {
      const sig =
        o.kind === "EMPRESA_BULTO"
          ? `EMP|${o.bultoEmpresaId ?? o.data3d.bulto.codigo}`
          : `STD|${o.productoId ?? o.data3d.bulto.codigo}`;

      if (seen.has(sig)) continue;
      seen.add(sig);
      dedup.push(o);
    }

    return dedup;
  }, [
    itemsMultiReal,
    productos,
    items,
    topBultosEmpresa,
    isMultiProducto,
    packingPolicy,
    packStdPolicy,
  ]);

  /* ============================
     Selección y policy
  ============================ */

  // ✅ UX: al cambiar policy, reseteo selección (evita “resucitar” opciones)
  useEffect(() => {
    setOpcionSeleccionada(null);
  }, [packingPolicy]);

  // Ajuste de índice si cambian opciones
  useEffect(() => {
    setOpcionSeleccionada((prev) => {
      if (!opciones.length) return null;
      if (opciones.length === 1) return 0;
      if (prev === null) return null;
      return prev >= opciones.length ? null : prev;
    });
  }, [opciones.length]);

  const selectedOpt =
    opcionSeleccionada !== null ? opciones[opcionSeleccionada] : null;

  const selectedIsStd = selectedOpt?.kind === "PRODUCTO_ESTANDAR";
  const selectedIsEmpresa = selectedOpt?.kind === "EMPRESA_BULTO";

  // ✅ Si el usuario selecciona bulto estándar: policy no aplica
  useEffect(() => {
    if (selectedIsStd && packingPolicy !== "OPERATIVO_AGRUPADO") {
      setPackingPolicy("OPERATIVO_AGRUPADO");
    }
  }, [selectedIsStd, packingPolicy]);

  const preview3DData = useMemo((): CubicacionBulto3DInput | null => {
    if (opcionSeleccionada === null) return null;
    return opciones[opcionSeleccionada]?.data3d ?? null;
  }, [opcionSeleccionada, opciones]);

  const hasPreview = Boolean(preview3DData);

  function ceilDiv(a: number, b: number): number {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return 0;
    return Math.ceil(a / b);
  }

  function toPositiveInt(n: unknown, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    const y = Math.floor(x);
    return y > 0 ? y : fallback;
  }

  function getPackDeclarado(prod: any): number | null {
    const packRaw = Number(
      prod?.unidades_por_unidad_entrega ?? prod?.unidad_entra_por_bulto ?? 0
    );
    return Number.isFinite(packRaw) && packRaw > 0 ? packRaw : null;
  }

  /**
   * Deriva unidadesPorBulto por SKU según la opción seleccionada.
   * - STD: pack declarado vs capacidad física, según packStdPolicy
   * - EMPRESA: cuenta placements del bulto1 (layout real) por productoId
   */
  function deriveUnidadesPorBultoByProducto(params: {
    selectedOpt: any; // OpcionCubicacion
    itemsMultiReal: any[]; // MultiProductoUnidadInputReal[]
    productos: any[]; // ITipoProducto[]
    packStdPolicy: "LIMITADO_POR_PRODUCTO" | "MAXIMIZAR_POR_CUBICACION";
  }) {
    const { selectedOpt, itemsMultiReal, productos, packStdPolicy } = params;

    // ===== PRODUCTO_ESTANDAR (solo 1 producto)
    if (selectedOpt.kind === "PRODUCTO_ESTANDAR") {
      const first = itemsMultiReal[0];
      const prod = productos.find((p: any) => p.id === first.productoId) as any;

      const packDeclarado = getPackDeclarado(prod);

      // Capacidad física desde la geometría del bulto interno (sale del data3d)
      const dimInterna = selectedOpt?.data3d?.bulto?.dimInternaMm;
      const dimUnidad = first?.dimUnidadMm;

      const capFisica =
        dimInterna && dimUnidad
          ? (() => {
              const nx = Math.floor(dimInterna.largo / dimUnidad.largo);
              const nz = Math.floor(dimInterna.ancho / dimUnidad.ancho);
              const ny = Math.floor(dimInterna.alto / dimUnidad.alto);
              if (nx <= 0 || nz <= 0 || ny <= 0) return 0;
              return nx * nz * ny;
            })()
          : 0;

      const unidadesPorBulto =
        packStdPolicy === "MAXIMIZAR_POR_CUBICACION"
          ? capFisica
          : packDeclarado ?? capFisica;

      return new Map<number, number>([
        [first.productoId, Math.max(1, toPositiveInt(unidadesPorBulto, 1))],
      ]);
    }

    // ===== EMPRESA_BULTO (multi o mono)
    // Necesitamos layout real (placements), no preview parcial.
    const contenido = selectedOpt?.data3d?.contenido ?? [];
    const map = new Map<number, number>();

    for (const pl of contenido) {
      const pid = toPositiveInt(pl?.productoId, 0);
      if (!pid) continue;
      map.set(pid, (map.get(pid) ?? 0) + 1); // cada placement es 1 unidad
    }

    // Aseguramos mínimo 1 para cualquier SKU presente
    for (const it of itemsMultiReal) {
      if (!map.has(it.productoId)) map.set(it.productoId, 1);
    }

    return map;
  }

  /* ============================
     Submit
  ============================ */

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores([]);
    setMensaje(null);

    const mensajes: string[] = [];

    items.forEach((item, idx) => {
      if (item.productoId === "")
        mensajes.push(`Fila ${idx + 1}: seleccioná un producto.`);
      if (!item.cantidadUnidades || Number(item.cantidadUnidades) <= 0) {
        mensajes.push(
          `Fila ${idx + 1}: indicá cantidad de unidades (número positivo).`
        );
      }
      if (!item.largoUnidadMm || !item.anchoUnidadMm || !item.altoUnidadMm) {
        mensajes.push(`Fila ${idx + 1}: completá largo/ancho/alto en mm.`);
      }
      if (
        item.largoUnidadMm &&
        item.anchoUnidadMm &&
        item.altoUnidadMm &&
        (Number(item.largoUnidadMm) <= 0 ||
          Number(item.anchoUnidadMm) <= 0 ||
          Number(item.altoUnidadMm) <= 0)
      ) {
        mensajes.push(`Fila ${idx + 1}: las dimensiones deben ser > 0.`);
      }
    });

    if (hayProductosDuplicados) {
      mensajes.push(
        "Hay productos duplicados. Cada fila debe usar un producto distinto."
      );
    }

    if (mensajes.length) {
      setErrores(mensajes);
      return;
    }

    if (!opciones.length) {
      setErrores([
        "No se encontraron opciones de bulto para previsualizar. Verificá: bulto estándar del producto (tipo_producto) o bultos empresa habilitados.",
      ]);
      return;
    }

    if (opcionSeleccionada === null || !selectedOpt) {
      setErrores([
        "Seleccioná una opción de bulto para previsualizar antes de guardar.",
      ]);
      return;
    }

    if (!hasPreview) {
      setErrores([
        "Antes de guardar, necesitás una previsualización 3D válida.",
      ]);
      return;
    }

    // ✅ Profesional: no guardar EMPRESA_BULTO con preview parcial
    if (selectedOpt.kind === "EMPRESA_BULTO" && selectedOpt.previewParcial) {
      setErrores([
        "No se puede guardar esta opción porque es un 'Preview parcial' (no hay layout real para derivar bultos por producto). Elegí otra opción viable o desactivá el modo que evita placements.",
      ]);
      return;
    }

    const unidadesPorBultoByProd = deriveUnidadesPorBultoByProducto({
      selectedOpt,
      itemsMultiReal,
      productos,
      packStdPolicy,
    });

    const ceilDiv = (a: number, b: number) => (b > 0 ? Math.ceil(a / b) : 999999);

    const itemsToSave: MultiProductoConfiguracionItemInput[] =
      itemsMultiReal.map((i) => {
        const producto = productos.find((p) => p.id === i.productoId) as any;

    // ✅ para STD: respetamos el pack elegido en UI
    // (packStdPolicy ya define capacidadElegida en tu lógica de opciones)
    // Como STD solo aplica cuando hay 1 producto, tomamos la opción seleccionada.
    let unidadesPorBulto = 1;

    if (selectedIsStd && selectedOpt) {
      // en STD "unidadesEnBulto1" representa el pack elegido (capacidadElegida) o el límite operativo
      unidadesPorBulto = Math.max(1, Number(selectedOpt.unidadesEnBulto1) || 1);
    } else {
      // fallback razonable (para empresa o si algo falla)
      const packRaw = Number(
        producto?.unidades_por_unidad_entrega ??
          producto?.unidad_entra_por_bulto ??
          0
      );
      unidadesPorBulto = Number.isFinite(packRaw) && packRaw > 0 ? packRaw : 1;
    }

    const cantidadBultos = ceilDiv(i.cantidadUnidades, unidadesPorBulto);

    // peso unidad (opcional)
    const pesoPorBulto = Number(producto?.peso_por_bulto ?? 0);
    const pesoUnidadKg =
      Number.isFinite(pesoPorBulto) && pesoPorBulto > 0 && unidadesPorBulto > 0
        ? pesoPorBulto / unidadesPorBulto
        : null;

    return {
      tipoProductoId: i.productoId,
      cantidadUnidades: i.cantidadUnidades,
      unidadesPorBulto,
      cantidadBultos,
      volumenTotalM3: i.volumenUnidadM3 * i.cantidadUnidades,
      dimUnidadMm: i.dimUnidadMm,
      pesoUnidadKg,
    };
  });

    if (!itemsToSave.length) {
      setErrores(["No hay filas válidas para guardar."]);
      return;
    }

    if (modoSimulacion) {
      setMensaje("Vista previa lista. No se guardó ningún lote.");
      return;
    }

    startTransition(async () => {
      try {
        const payload: MultiProductoConfiguracionInput = {
          descripcion: descripcion.trim() || null,

          packingPolicy: selectedIsEmpresa
            ? packingPolicy
            : "OPERATIVO_AGRUPADO",
          tipoBulto: selectedOpt.kind,
          bultoEmpresaId:
            selectedOpt.kind === "EMPRESA_BULTO"
              ? selectedOpt.bultoEmpresaId ?? null
              : null,

          items: itemsToSave,
        };

        const { loteId } = await onSubmit(payload);
        setMensaje("Configuración guardada correctamente.");
        router.push(`/cubicacion/pallet/${loteId}`);
      } catch (err) {
         
        console.error(err);
        setErrores(["No se pudo guardar la configuración."]);
      }
    });
  };

  /* ============================
     Render
  ============================ */

  return (
    <section className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cubicación empresa</h2>
          <p className="text-sm text-slate-600">
            Cargá productos y dimensiones. Primero elegís la estrategia, luego
            el sistema rankea bultos y exige previsualización 3D antes de
            guardar.
          </p>
        </div>

        <div className="space-y-1 text-sm">
          <label className="block text-slate-700 font-medium">
            Descripción (opcional)
          </label>
          <input
            className="w-full md:w-80 border rounded-md px-3 py-2 text-sm"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Pedido mixto semana 32"
          />
        </div>
      </header>

      {/* Simulación */}
      <div className="flex flex-col gap-1 rounded-md border border-dashed border-indigo-200 bg-indigo-50 p-3">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-indigo-900">
          <input
            type="checkbox"
            checked={modoSimulacion}
            onChange={(e) => setModoSimulacion(e.target.checked)}
          />
          Vista previa (no guarda)
        </label>
        <p className="text-xs text-indigo-800">
          Evaluá opciones y previsualizá el 3D sin crear lote. Ideal para demo o
          comparación rápida. Podés previsualizar en 3D y compartir la opción
          seleccionada sin persistirla.
        </p>
      </div>

      {modoSimulacion && (
        <div className="mt-2 space-y-2 rounded-md border border-indigo-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">
            Modo de simulación
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={simMode.kind === "MAX"}
              onChange={() => setSimMode({ kind: "MAX" })}
            />
            <span>
              <strong>Máxima ocupación</strong>
              <span className="block text-xs text-slate-500">
                Llena el bulto hasta su capacidad operativa máxima.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              checked={simMode.kind === "PCT"}
              onChange={() => setSimMode({ kind: "PCT", pct: 80 })}
            />
            <span className="flex-1">
              <strong>Porcentaje de ocupación</strong>
              <span className="block text-xs text-slate-500">
                Simula un llenado parcial del bulto.
              </span>

              {simMode.kind === "PCT" && (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="w-20 rounded-md border px-2 py-1 text-sm"
                    value={simMode.pct}
                    onChange={(e) =>
                      setSimMode({
                        kind: "PCT",
                        pct: Math.min(
                          100,
                          Math.max(1, Number(e.target.value) || 1)
                        ),
                      })
                    }
                  />
                  <span className="text-xs text-slate-600">% de ocupación</span>
                </div>
              )}
            </span>
          </label>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tabla */}
        <div className="overflow-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Cant. unidades</th>
                <th className="px-3 py-2">Largo (mm)</th>
                <th className="px-3 py-2">Ancho (mm)</th>
                <th className="px-3 py-2">Alto (mm)</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item) => (
                <tr key={item.key} className="border-t align-top">
                  <td className="px-3 py-2 min-w-70">
                    <select
                      className="w-full border rounded-md px-2 py-1"
                      value={item.productoId}
                      onChange={(e) =>
                        seleccionarProducto(
                          item.key,
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                    >
                      <option value="">Seleccioná</option>
                      {productos.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {String((prod as any).codigo ?? "").trim()} —{" "}
                          {String((prod as any).descripcion ?? "")}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className="w-28 border rounded-md px-2 py-1"
                      value={item.cantidadUnidades}
                      onChange={(e) =>
                        actualizarItem(
                          item.key,
                          "cantidadUnidades",
                          e.target.value
                        )
                      }
                      placeholder="Ej: 20"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      className="w-28 border rounded-md px-2 py-1"
                      value={item.largoUnidadMm}
                      onChange={(e) =>
                        actualizarItem(
                          item.key,
                          "largoUnidadMm",
                          e.target.value
                        )
                      }
                      placeholder="L"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      className="w-28 border rounded-md px-2 py-1"
                      value={item.anchoUnidadMm}
                      onChange={(e) =>
                        actualizarItem(
                          item.key,
                          "anchoUnidadMm",
                          e.target.value
                        )
                      }
                      placeholder="A"
                    />
                  </td>

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0.01}
                      step="any"
                      className="w-28 border rounded-md px-2 py-1"
                      value={item.altoUnidadMm}
                      onChange={(e) =>
                        actualizarItem(item.key, "altoUnidadMm", e.target.value)
                      }
                      placeholder="H"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {items.length > 1 && (
                      <button
                        type="button"
                        className="text-red-600 text-xs hover:underline"
                        onClick={() => eliminarFila(item.key)}
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={agregarFila}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
          >
            + Agregar producto
          </button>

          <div className="text-xs text-slate-500">
            Seleccionados: {productosSeleccionadosCount} ·{" "}
            {isMultiProducto
              ? "Comparación multi-producto"
              : "Comparación 1 producto + bultos empresa"}
          </div>
        </div>

        {/* ✅ Policy primero (valor agregado) */}
        {mostrarPolicy && (
          <div className="rounded-md border bg-white p-3 space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Estrategia de llenado del bulto (packing policy)
            </p>

            {(
              [
                "OPERATIVO_AGRUPADO",
                "OPTIMIZAR_VOLUMEN",
                "BUSCAR_MEJOR_ACOMODO",
              ] as PackingPolicy[]
            ).map((policy) => (
              <label key={policy} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={packingPolicy === policy}
                  onChange={() => setPackingPolicy(policy)}
                />
                <span>
                  <strong>{PACKING_POLICY_LABELS[policy].titulo}</strong>
                  <br />
                  <span className="text-xs text-slate-500">
                    {PACKING_POLICY_LABELS[policy].descripcion}
                  </span>
                </span>
              </label>
            ))}

            <p className="text-[11px] text-slate-500">
              Esta selección define el ranking de bultos empresa y el layout del
              primer bulto (preview fiel).
            </p>
          </div>
        )}

        {/* Opciones */}
        {opciones.length > 0 && (
          <div className="space-y-3">
            <p className="font-semibold text-indigo-800">Opciones de bulto</p>

            <div className="grid gap-3 md:grid-cols-3">
              {opciones.map((opt, idx) => {
                const selected = opcionSeleccionada === idx;
                const esStd = opt.kind === "PRODUCTO_ESTANDAR";

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setOpcionSeleccionada(idx)}
                    className={[
                      "rounded-md border p-3 text-left cursor-pointer",
                      selected
                        ? "border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50"
                        : "border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <p className="font-semibold">
                      #{idx + 1} · {opt.titulo}
                    </p>

                    {opt.subtitulo && (
                      <p className="text-xs text-slate-500 mt-1">
                        {opt.subtitulo}
                      </p>
                    )}

                    <div className="mt-2 space-y-1 text-xs text-slate-700">
                      <p>
                        Entran (bulto 1):{" "}
                        <span className="font-semibold">
                          {opt.unidadesEnBulto1}/{opt.unidadesTotales}
                        </span>
                      </p>

                      <p>
                        Bultos estimados:{" "}
                        <span className="font-semibold">
                          {opt.bultosNecesariosEstimados}
                        </span>
                      </p>

                      {esStd ? (
                        <p>
                          Tipo de pack:{" "}
                          <span className="font-semibold">
                            Cerrado (producto)
                          </span>
                        </p>
                      ) : (
                        <p>
                          Ocupación:{" "}
                          <span className="font-semibold">
                            {typeof opt.ocupacionPct === "number"
                              ? `${opt.ocupacionPct.toFixed(1)}%`
                              : "N/D"}
                          </span>
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {opciones.length > 1 && opcionSeleccionada === null && (
              <p className="text-xs text-amber-700">
                Seleccioná una opción para habilitar la previsualización 3D.
              </p>
            )}

            {/* Panel de descartados (estable, sin depender del top) */}
            {bultosDescartados.length > 0 && (
              <details className="rounded-md border bg-white p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Bultos descartados ({bultosDescartados.length})
                </summary>

                <div className="mt-3 space-y-3">
                  <p className="text-xs text-slate-600">
                    Estos bultos no aparecen como opción porque al menos un
                    producto no entra en ninguna orientación (según dimensiones
                    internas).
                  </p>

                  <div className="space-y-2">
                    {bultosDescartados.map((d) => (
                      <div key={d.bultoId} className="rounded-md border p-3">
                        <p className="text-sm font-semibold">
                          {d.codigo}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            (interna {d.dimInterna.largo}×{d.dimInterna.ancho}×
                            {d.dimInterna.alto} mm)
                          </span>
                        </p>

                        <ul className="mt-2 list-disc pl-5 text-xs text-slate-700 space-y-1">
                          {d.motivos.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Toggle para bulto estándar */}
        {selectedIsStd && (
          <div className="rounded-md border bg-white p-3 space-y-2">
            <p className="text-sm font-semibold text-slate-900">
              Criterio para bulto estándar del producto
            </p>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                checked={packStdPolicy === "LIMITADO_POR_PRODUCTO"}
                onChange={() => setPackStdPolicy("LIMITADO_POR_PRODUCTO")}
              />
              <span>
                <strong>Respetar pack del producto</strong>
                <br />
                <span className="text-xs text-slate-500">
                  Usa el límite declarado (unidades_por_unidad_entrega)
                  Operativo / pack cerrado, no optimiza.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                checked={packStdPolicy === "MAXIMIZAR_POR_CUBICACION"}
                onChange={() => setPackStdPolicy("MAXIMIZAR_POR_CUBICACION")}
              />
              <span>
                <strong>Maximizar por cubicación</strong>
                <br />
                <span className="text-xs text-slate-500">
                  Llena el bulto según capacidad física por medidas. Simulación
                  / optimización por geometría (puede diferir del pack
                  declarado).
                </span>
              </span>
            </label>
          </div>
        )}

        {/* Panel de decisión */}
        {selectedOpt && (
          <div className="rounded-md border bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">
              Resumen de la opción seleccionada
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-600">Entran en bulto 1</p>
                <p className="font-semibold">
                  {selectedOpt.unidadesEnBulto1}/{selectedOpt.unidadesTotales}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Bultos necesarios (estimado)</p>
                <p className="font-semibold">
                  {selectedOpt.bultosNecesariosEstimados}
                </p>
              </div>
              <div>
                <p className="text-slate-600">
                  {selectedIsStd ? "Tipo de pack" : "Ocupación"}
                </p>
                <p className="font-semibold">
                  {selectedIsStd
                    ? "Cerrado (producto)"
                    : typeof selectedOpt.ocupacionPct === "number"
                    ? `${selectedOpt.ocupacionPct.toFixed(1)}%`
                    : "No disponible"}
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedOpt?.previewParcial && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            Preview parcial: el motor no devolvió placements para este bulto. Se
            muestra una unidad representativa.
          </div>
        )}

        {/* Viewer 3D */}
        {preview3DData && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Previsualización 3D de la opción seleccionada
            </p>

            {selectedIsStd && (
              <div className="text-xs text-slate-600">
                <p className="font-semibold text-slate-700">
                  Bulto estándar del producto (pack cerrado)
                </p>
                <p>
                  Este bulto corresponde a un pack definido por el producto.
                </p>
                <p>
                  El espacio visible en la visualización no representa capacidad
                  disponible.
                </p>

                <p className="text-amber-700 mt-1">
                  Nota: la unidad dibujada es una referencia visual (pack
                  cerrado) y no implica optimización de acomodo.
                </p>
              </div>
            )}

            <CubicacionBultoViewer3D
              key={`${selectedOpt?.key ?? "none"}-${packingPolicy}-${
                opcionSeleccionada ?? "n"
              }`}
              data={preview3DData}
            />

            <p className="text-xs text-slate-500">
              Policy: <strong>{packingPolicy}</strong> · Placements:{" "}
              <strong>{preview3DData.contenido.length}</strong>
            </p>

            <p className="text-xs text-slate-500">
              La visualización es fiel al layout calculado (no se recalcula en
              el viewer).
            </p>
          </div>
        )}

        {/* Errores / OK */}
        {errores.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-3 text-sm text-red-700 rounded-md space-y-1">
            {errores.map((e, i) => (
              <p key={i}>• {e}</p>
            ))}
          </div>
        )}

        {mensaje && (
          <div className="bg-green-50 border border-green-200 p-3 text-sm text-green-700 rounded-md">
            {mensaje}
          </div>
        )}

        {/* Guardar */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || !hasPreview}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
          >
            {isPending
              ? "Guardando..."
              : modoSimulacion
              ? "Listo (no guarda)"
              : "Guardar cubicación"}
          </button>
        </div>

        {!hasPreview && (
          <p className="text-xs text-slate-500 text-right">
            Para guardar, primero seleccioná una opción y verificá la
            previsualización 3D.
          </p>
        )}
      </form>
    </section>
  );
}
