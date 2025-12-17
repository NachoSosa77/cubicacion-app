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
  DimMm as DimMmEmpresa,
  evaluarTopBultosEmpresa,
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
  grosorParedMm: string;
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

  // Meta opcional para persistir selección de bulto empresa
  bultoEmpresaId?: number;

  data3d: CubicacionBulto3DInput;
};

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

/* ============================
   Debug (opt-in)
============================ */

const DEBUG_PACKING_UI =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_DEBUG_PACKING === "true" ||
    process.env.DEBUG_PACKING === "true");

function dbgUI(...args: any[]) {
  if (!DEBUG_PACKING_UI) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

/* ============================
   Descartes (UI)
============================ */

function dimsInternasBultoEmpresa(b: IEmpresaBulto): DimMm {
  const e = Math.max(0, Number((b as any).espesor_pared_mm ?? 0));
  return {
    largo: Math.max(0, Number((b as any).largo_mm ?? 0) - 2 * e),
    ancho: Math.max(0, Number((b as any).ancho_mm ?? 0) - 2 * e),
    alto: Math.max(0, Number((b as any).alto_mm ?? 0) - 2 * e),
  };
}

const orientacionesUnidad = (d: DimMm): DimMm[] => [
  { largo: d.largo, ancho: d.ancho, alto: d.alto },
  { largo: d.largo, ancho: d.alto, alto: d.ancho },
  { largo: d.ancho, ancho: d.largo, alto: d.alto },
  { largo: d.ancho, ancho: d.alto, alto: d.largo },
  { largo: d.alto, ancho: d.largo, alto: d.ancho },
  { largo: d.alto, ancho: d.ancho, alto: d.largo },
];

function entraEnAlgunaOrientacion(dimUnidad: DimMm, di: DimMm): boolean {
  return orientacionesUnidad(dimUnidad).some(
    (o) => o.largo <= di.largo && o.ancho <= di.ancho && o.alto <= di.alto
  );
}

function motivoNoEntraProductoEnBulto(
  codigoProd: string,
  dimUnidad: DimMm,
  di: DimMm
) {
  const ejemplos = orientacionesUnidad(dimUnidad)
    .slice(0, 3)
    .map((o) => `${o.largo}×${o.ancho}×${o.alto}`)
    .join(" | ");

  return `Producto ${codigoProd} (${dimUnidad.largo}×${dimUnidad.ancho}×${dimUnidad.alto} mm) no entra en interna ${di.largo}×${di.ancho}×${di.alto} mm. Orientaciones (muestra): ${ejemplos}`;
}

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
      grosorParedMm: "",
    },
  ]);

  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [opcionSeleccionada, setOpcionSeleccionada] = useState<number | null>(
    null
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
        grosorParedMm: "",
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

        return {
          itemKey: item.key,
          productoId: producto.id,
          codigoProducto,
          descripcionProducto: String((producto as any).descripcion ?? ""),
          cantidadUnidades: cantidad,
          volumenUnidadM3: (largo * ancho * alto) / 1_000_000_000,
          dimUnidadMm: { largo, ancho, alto },
        };
      })
      .filter(isNotNull);
  }, [items, productos]);

  const isMultiProducto = itemsMultiReal.length >= 2;

  /* ============================
     TOP bultos empresa
  ============================ */

  const topBultosEmpresa = useMemo(() => {
    if (!itemsMultiReal.length) return [];
    return evaluarTopBultosEmpresa(
      itemsMultiReal,
      bultosEmpresa,
      3,
      packingPolicy
    );
  }, [itemsMultiReal, bultosEmpresa, packingPolicy]);

  /* ============================
     Bultos descartados (UI)
  ============================ */

  const bultosDescartados = useMemo((): BultoDescartado[] => {
    if (!itemsMultiReal.length) return [];

    const descartados: BultoDescartado[] = [];

    for (const b of bultosEmpresa) {
      if (!(b as any).habilitado) continue;

      const di = dimsInternasBultoEmpresa(b);
      const codigoB =
        String((b as any).codigo ?? "").trim() || `BULTO-${(b as any).id}`;

      const motivos: string[] = [];

      if (di.largo <= 0 || di.ancho <= 0 || di.alto <= 0) {
        motivos.push(
          `Capacidad interna inválida (${di.largo}×${di.ancho}×${di.alto}).`
        );
      } else {
        for (const it of itemsMultiReal) {
          const codProd = (it.codigoProducto ?? `PROD-${it.productoId}`).trim();
          if (!entraEnAlgunaOrientacion(it.dimUnidadMm, di)) {
            motivos.push(
              motivoNoEntraProductoEnBulto(codProd, it.dimUnidadMm, di)
            );
          }
        }
      }

      if (motivos.length) {
        descartados.push({
          bultoId: Number((b as any).id),
          codigo: codigoB,
          dimInterna: di,
          motivos,
        });
      }
    }

    const viablesIds = new Set<number>(
      topBultosEmpresa
        .map((x) => Number((x as any).bulto?.id))
        .filter((n) => Number.isFinite(n) && n > 0)
    );

    return descartados.filter((d) => !viablesIds.has(d.bultoId));
  }, [itemsMultiReal, bultosEmpresa, topBultosEmpresa]);

  /* ============================
     Opciones unificadas
  ============================ */

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
          const row = items.find((x) => x.key === it.itemKey);
          const grosor = Math.max(
            numberOrNull(row?.grosorParedMm ?? "") ?? 0,
            0
          );

          const res = calcularUnidadEnBulto({
            producto,
            dimUnidadMm: it.dimUnidadMm,
            grosorParedMm: grosor,
            dimExternaBultoMm: { largo: bL, ancho: bA, alto: bH },
          });

          if (res) {
            const dimInterna: DimMm = {
              largo: res.dimInternaBulto.largo,
              ancho: res.dimInternaBulto.ancho,
              alto: res.dimInternaBulto.alto,
            };

            const cap = gridCapacity(dimInterna, it.dimUnidadMm);
            const unidadesEnBulto1 = Math.min(it.cantidadUnidades, cap);
            const bultosNecesariosEstimados =
              cap > 0 ? ceilDiv(it.cantidadUnidades, cap) : 999999;

            // Regla 1: NO mostrar ocupación para bulto estándar (pack cerrado)
            const ocupacionPct = null;

            const placements = buildGridPlacements(
              dimInterna,
              it.dimUnidadMm,
              unidadesEnBulto1
            );

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
              subtitulo: `Pack definido por el producto · ${bL}×${bA}×${bH} mm`,
              ocupacionPct,
              unidadesTotales: it.cantidadUnidades,
              unidadesEnBulto1,
              bultosNecesariosEstimados,
              data3d,
            });
          }
        }
      }
    }

    // ===== 2) Opciones empresa — usa packing3D (fiel)
    for (const opt of topBultosEmpresa) {
      if (!opt?.packing3D) continue;
      const p3d = opt.packing3D;

      dbgUI("==== DEBUG BULTO EMPRESA (UI) ====");
      dbgUI("BULTO:", (opt as any).bulto?.codigo);
      dbgUI("DIM INTERNA:", p3d.dimInternaMm);
      dbgUI(
        "INSTRUCCIONES:",
        p3d.instrucciones.map((i) => ({
          codigo: i.codigo,
          unidadesEnBulto1: i.unidadesEnBulto1,
          capacidadSolo: i.capacidadTeoricaSiSolo,
          orientacion: i.orientacionMm,
        }))
      );
      dbgUI(
        "PLACEMENTS:",
        p3d.placementsBulto1.map((p) => p.codigo)
      );

      const data3d: CubicacionBulto3DInput = {
        bulto: {
          codigo: String((opt as any).bulto?.codigo ?? "").trim() || "BULTO",
          dimExternaMm: {
            largo: (opt as any).bulto.largo_mm,
            ancho: (opt as any).bulto.ancho_mm,
            alto: (opt as any).bulto.alto_mm,
          },
          dimInternaMm:
            p3d.dimInternaMm as unknown as DimMmEmpresa as unknown as DimMm,
        },
        contenido: p3d.placementsBulto1.map((pl) => ({
          productoId: pl.productoId,
          codigo: pl.codigo,
          unidades: 1,
          dimUnidadMm: pl.dimUnidadMm as unknown as DimMm,
          positionMm: pl.posCentroMm,
        })),
      };

      const codigoB =
        String((opt as any).bulto?.codigo ?? "").trim() || "Sin código";

      out.push({
        kind: "EMPRESA_BULTO",
        key: `empresa-${(opt as any).bulto?.id ?? Math.random()}`,
        bultoEmpresaId: (opt as any).bulto?.id ?? undefined,
        titulo: `Bulto empresa · ${codigoB}`,
        subtitulo: isMultiProducto
          ? `Contenedor logístico · Multi-producto · ${PACKING_POLICY_LABELS[packingPolicy].titulo}`
          : `Contenedor logístico · 1 producto · ${PACKING_POLICY_LABELS[packingPolicy].titulo}`,
        ocupacionPct:
          typeof p3d.ocupacionVolumetricaPct === "number"
            ? p3d.ocupacionVolumetricaPct
            : null,
        unidadesTotales: p3d.unidadesTotales ?? unidadesTotalesAll,
        unidadesEnBulto1: p3d.unidadesEnBulto1,
        bultosNecesariosEstimados: p3d.bultosNecesariosEstimados,
        data3d,
      });
    }

    // Deduplicación por dims externas
    const seen = new Set<string>();
    const dedup: OpcionCubicacion[] = [];
    for (const o of out) {
      const b = o.data3d.bulto;
      const sig = `${b.codigo}|${b.dimExternaMm.largo}x${b.dimExternaMm.ancho}x${b.dimExternaMm.alto}`;
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
  ]);

  /* ============================
     Mantener/ajustar selección
  ============================ */

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

  // ✅ si el usuario selecciona bulto estándar, policy no aplica → se fuerza a OPERATIVO_AGRUPADO
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

    const itemsToSave: MultiProductoConfiguracionItemInput[] =
      itemsMultiReal.map((i) => ({
        tipoProductoId: i.productoId,
        cantidadUnidades: i.cantidadUnidades,
        cantidadBultos: 1,
        volumenTotalM3: i.volumenUnidadM3 * i.cantidadUnidades,
      }));

    if (!itemsToSave.length) {
      setErrores(["No hay filas válidas para guardar."]);
      return;
    }

    startTransition(async () => {
      try {
        const payload: MultiProductoConfiguracionInput = {
          descripcion: descripcion.trim() || null,

          // ✅ decisiones operativas (persistibles)
          packingPolicy: selectedIsEmpresa
            ? packingPolicy
            : "OPERATIVO_AGRUPADO",
          tipoBulto: selectedOpt.kind,
          bultoEmpresaId:
            selectedOpt.kind === "EMPRESA_BULTO"
              ? selectedOpt.bultoEmpresaId ?? null
              : null,

          // ✅ ítems
          items: itemsToSave,
        };

        const { loteId } = await onSubmit(payload);
        setMensaje("Configuración guardada correctamente.");
        router.push(`/cubicacion/pallet/${loteId}`);
        router.refresh(); // opcional (si la page de pallet lee data server-side)
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
            Cargá productos y dimensiones. El sistema compara bultos y exige
            previsualización 3D antes de guardar.
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
                <th className="px-3 py-2">Grosor pared (mm)</th>
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

                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      className="w-28 border rounded-md px-2 py-1"
                      value={item.grosorParedMm}
                      onChange={(e) =>
                        actualizarItem(
                          item.key,
                          "grosorParedMm",
                          e.target.value
                        )
                      }
                      placeholder="0"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Opcional.</p>
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

            {/* Panel de descartados */}
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

        {/* ✅ Packing policy: SOLO para bulto empresa */}
        {selectedIsEmpresa && (
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
              Cambiar la estrategia recalcula el layout del primer bulto
              (preview fiel).
            </p>
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
              </div>
            )}

            <CubicacionBultoViewer3D data={preview3DData} />

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
            {isPending ? "Guardando..." : "Guardar cubicación"}
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
