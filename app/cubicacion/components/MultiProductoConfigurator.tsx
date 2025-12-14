"use client";

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
  onSubmit: (input: MultiProductoConfiguracionInput) => Promise<void>;
}

type OpcionCubicacion = {
  kind: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  key: string;
  titulo: string;
  subtitulo?: string;

  // Métricas empresariales (para fascinar, sin confundir)
  ocupacionPct?: number | null;
  unidadesTotales: number;
  unidadesEnBulto1: number;
  bultosNecesariosEstimados: number;

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

  /* ============================
     UI handlers (tabla)
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
     TOP bultos empresa (1 o más productos)
  ============================ */

  const topBultosEmpresa = useMemo(() => {
    if (!itemsMultiReal.length) return [];
    return evaluarTopBultosEmpresa(itemsMultiReal, bultosEmpresa, 3);
  }, [itemsMultiReal, bultosEmpresa]);

  /* ============================
     Opciones unificadas
  ============================ */

  const opciones = useMemo((): OpcionCubicacion[] => {
    if (!itemsMultiReal.length) return [];

    const out: OpcionCubicacion[] = [];
    const unidadesTotales = itemsMultiReal.reduce(
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
          const grosor = Math.max(numberOrNull(row?.grosorParedMm ?? "") ?? 0, 0);

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
            const bultosNecesariosEstimados = cap > 0 ? ceilDiv(it.cantidadUnidades, cap) : 999999;

            const ocupacionPct =
              typeof (res as any).ocupacionVolumenInterno === "number"
                ? (res as any).ocupacionVolumenInterno
                : null;

            const placements = buildGridPlacements(dimInterna, it.dimUnidadMm, unidadesEnBulto1);

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
                  (typeof it.codigoProducto === "string" && it.codigoProducto.trim()) ||
                  `PROD-${it.productoId}`,
                unidades: 1,
                dimUnidadMm: it.dimUnidadMm,
                positionMm: pos,
              })),
            };

            out.push({
              kind: "PRODUCTO_ESTANDAR",
              key: `producto-std-${producto.id}`,
              titulo: `Bulto estándar · ${String((producto as any).codigo ?? "").trim() || "Producto"}`,
              subtitulo: `Desde tipo_producto: ${bL}×${bA}×${bH} mm`,
              ocupacionPct,
              unidadesTotales: it.cantidadUnidades,
              unidadesEnBulto1: unidadesEnBulto1,
              bultosNecesariosEstimados,
              data3d,
            });
          }
        }
      }
    }

    // ===== 2) Opciones empresa (1 o más productos) — usa packing3D (fiel)
    for (const opt of topBultosEmpresa) {
      if (!opt?.packing3D) continue;

      const p3d = opt.packing3D;

      const data3d: CubicacionBulto3DInput = {
        bulto: {
          codigo: String((opt as any).bulto?.codigo ?? "").trim() || "BULTO",
          dimExternaMm: {
            largo: (opt as any).bulto.largo_mm,
            ancho: (opt as any).bulto.ancho_mm,
            alto: (opt as any).bulto.alto_mm,
          },
          dimInternaMm: p3d.dimInternaMm as unknown as DimMmEmpresa as unknown as DimMm,
        },
        contenido: p3d.placementsBulto1.map((pl) => ({
          productoId: pl.productoId,
          codigo: pl.codigo,
          unidades: 1,
          dimUnidadMm: pl.dimUnidadMm as unknown as DimMm,
          positionMm: pl.posCentroMm,
        })),
      };

      out.push({
        kind: "EMPRESA_BULTO",
        key: `empresa-${(opt as any).bulto?.id ?? Math.random()}`,
        titulo: `Bulto empresa · ${String((opt as any).bulto?.codigo ?? "").trim() || "Sin código"}`,
        subtitulo: isMultiProducto
          ? "Sugerido por cubicación empresa (multi-producto)"
          : "Sugerido por cubicación empresa (1 producto)",
        ocupacionPct:
          typeof p3d.ocupacionVolumetricaPct === "number"
            ? p3d.ocupacionVolumetricaPct
            : null,
        unidadesTotales: p3d.unidadesTotales ?? unidadesTotales,
        unidadesEnBulto1: p3d.unidadesEnBulto1,
        bultosNecesariosEstimados: p3d.bultosNecesariosEstimados,
        data3d,
      });
    }

    // Deduplicación por dims externas (evita repetidas)
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
  }, [itemsMultiReal, productos, items, topBultosEmpresa, isMultiProducto]);

  useEffect(() => {
    setOpcionSeleccionada((prev) => {
      if (!opciones.length) return null;
      if (opciones.length === 1) return 0;
      if (prev === null) return null;
      return prev >= opciones.length ? null : prev;
    });
  }, [opciones.length]);

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
      if (item.productoId === "") mensajes.push(`Fila ${idx + 1}: seleccioná un producto.`);
      if (!item.cantidadUnidades || Number(item.cantidadUnidades) <= 0) {
        mensajes.push(`Fila ${idx + 1}: indicá cantidad de unidades (número positivo).`);
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
      mensajes.push("Hay productos duplicados. Cada fila debe usar un producto distinto.");
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

    if (opcionSeleccionada === null) {
      setErrores(["Seleccioná una opción de bulto para previsualizar antes de guardar."]);
      return;
    }

    if (!hasPreview) {
      setErrores(["Antes de guardar, necesitás una previsualización 3D válida."]);
      return;
    }

    const itemsToSave: MultiProductoConfiguracionItemInput[] = itemsMultiReal.map((i) => ({
      tipoProductoId: i.productoId,
      cantidadUnidades: i.cantidadUnidades,
      cantidadBultos: 1, // luego lo ajustamos cuando guardemos bultos reales
      volumenTotalM3: i.volumenUnidadM3 * i.cantidadUnidades,
    }));

    if (!itemsToSave.length) {
      setErrores(["No hay filas válidas para guardar."]);
      return;
    }

    startTransition(async () => {
      try {
        await onSubmit({
          descripcion: descripcion.trim() || null,
          items: itemsToSave,
        });
        setMensaje("Configuración guardada correctamente.");
      } catch (err) {
        console.error(err);
        setErrores(["No se pudo guardar la configuración."]);
      }
    });
  };

  /* ============================
     Render
  ============================ */

  const selectedOpt = opcionSeleccionada !== null ? opciones[opcionSeleccionada] : null;

  return (
    <section className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cubicación empresa</h2>
          <p className="text-sm text-slate-600">
            Cargá productos y dimensiones. El sistema compara bultos y exige previsualización 3D antes de guardar.
          </p>
        </div>

        <div className="space-y-1 text-sm">
          <label className="block text-slate-700 font-medium">Descripción (opcional)</label>
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
                        seleccionarProducto(item.key, e.target.value === "" ? "" : Number(e.target.value))
                      }
                    >
                      <option value="">Seleccioná</option>
                      {productos.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {String((prod as any).codigo ?? "").trim()} — {String((prod as any).descripcion ?? "")}
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
                      onChange={(e) => actualizarItem(item.key, "cantidadUnidades", e.target.value)}
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
                      onChange={(e) => actualizarItem(item.key, "largoUnidadMm", e.target.value)}
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
                      onChange={(e) => actualizarItem(item.key, "anchoUnidadMm", e.target.value)}
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
                      onChange={(e) => actualizarItem(item.key, "altoUnidadMm", e.target.value)}
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
                      onChange={(e) => actualizarItem(item.key, "grosorParedMm", e.target.value)}
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
            {isMultiProducto ? "Comparación multi-producto" : "Comparación 1 producto + bultos empresa"}
          </div>
        </div>

        {/* Opciones */}
        {opciones.length > 0 && (
          <div className="space-y-3">
            <p className="font-semibold text-indigo-800">Opciones de bulto</p>

            <div className="grid gap-3 md:grid-cols-3">
              {opciones.map((opt, idx) => {
                const selected = opcionSeleccionada === idx;

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
                      <p className="text-xs text-slate-500 mt-1">{opt.subtitulo}</p>
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
                        <span className="font-semibold">{opt.bultosNecesariosEstimados}</span>
                      </p>
                      <p>
                        Ocupación:{" "}
                        <span className="font-semibold">
                          {typeof opt.ocupacionPct === "number" ? `${opt.ocupacionPct.toFixed(1)}%` : "N/D"}
                        </span>
                      </p>
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
          </div>
        )}

        {/* Panel de decisión (cuando hay opción seleccionada) */}
        {selectedOpt && (
          <div className="rounded-md border bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">Resumen de la opción seleccionada</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3 text-sm">
              <div>
                <p className="text-slate-600">Entran en bulto 1</p>
                <p className="font-semibold">
                  {selectedOpt.unidadesEnBulto1}/{selectedOpt.unidadesTotales}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Bultos necesarios (estimado)</p>
                <p className="font-semibold">{selectedOpt.bultosNecesariosEstimados}</p>
              </div>
              <div>
                <p className="text-slate-600">Ocupación</p>
                <p className="font-semibold">
                  {typeof selectedOpt.ocupacionPct === "number"
                    ? `${selectedOpt.ocupacionPct.toFixed(1)}%`
                    : "No disponible"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Viewer 3D */}
        {preview3DData && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Previsualización 3D de la opción seleccionada
            </p>
            <CubicacionBultoViewer3D data={preview3DData} />
            <p className="text-xs text-slate-500">
              La visualización es fiel al layout calculado (no se recalcula en el viewer).
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
            Para guardar, primero seleccioná una opción y verificá la previsualización 3D.
          </p>
        )}
      </form>
    </section>
  );
}
