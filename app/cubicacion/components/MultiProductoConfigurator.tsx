"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { IEmpresaBulto } from "../actions/empresaBultoActions";
import { ITipoProducto } from "../actions/productoActions";
import type {
  MultiProductoConfiguracionInput,
  MultiProductoConfiguracionItemInput,
} from "../actions/saveMultiProductoConfiguracion";
import {
  evaluarTopBultosEmpresa,
  MultiProductoUnidadInputReal,
} from "../lib/evaluar-bultos-empresa";
import { CubicacionBulto3DInput } from "../types/cubicacion-3d";
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

/* ============================
   Utils
============================ */

const numberOrNull = (value: string): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const isNotNull = <T,>(x: T | null): x is T => x !== null;

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

  /** 👉 opción de bulto elegida por el usuario */
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<number | null>(
    null
  );

  /* ============================
     Modo automático
  ============================ */

  const productosSeleccionadosCount = useMemo(
    () => items.filter((i) => typeof i.productoId === "number").length,
    [items]
  );

  const isMulti = productosSeleccionadosCount >= 2;

  /* ============================
     Base para ranking empresa
  ============================ */

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

        const codigoProducto = String(producto.codigo ?? "").trim();
        if (!codigoProducto) return null;

        return {
          itemKey: item.key,
          productoId: producto.id,
          codigoProducto, // ✅ string garantizado
          descripcionProducto: String(producto.descripcion ?? ""),
          cantidadUnidades: cantidad,
          volumenUnidadM3: (largo * ancho * alto) / 1_000_000_000,
          dimUnidadMm: { largo, ancho, alto },
        };
      })
      .filter(isNotNull);
  }, [items, productos]);

  /* ============================
     TOP bultos empresa
  ============================ */

  const topBultos = useMemo(() => {
    if (!isMulti) return [];
    if (!itemsMultiReal.length) return [];
    return evaluarTopBultosEmpresa(itemsMultiReal, bultosEmpresa, 3);
  }, [isMulti, itemsMultiReal, bultosEmpresa]);

  /* ============================
     DTO 3D (viewer)
  ============================ */

 const cubicacionBulto3DData = useMemo((): CubicacionBulto3DInput | null => {
  if (opcionSeleccionada === null) return null;

  const opt = topBultos[opcionSeleccionada];
  if (!opt?.packing) return null;

  const bulto0 = opt.packing.bultos?.[0];
  if (!bulto0) return null;

  // Base confiable (tiene codigoProducto y dimUnidadMm)
  const byProductoId = new Map<number, MultiProductoUnidadInputReal>();
  for (const it of itemsMultiReal) byProductoId.set(it.productoId, it);

  const contenido = bulto0.contenido
  .map((c) => {
    const base = byProductoId.get(c.productoId);
    if (!base) return null;

    // ✅ Forzamos string SIEMPRE (nunca undefined)
    const codigo =
      (typeof base.codigoProducto === "string" ? base.codigoProducto : "")
        .trim() || `PROD-${base.productoId}`;

    return {
      productoId: base.productoId,
      codigo, // ✅ ahora es string
      unidades: c.unidades,
      dimUnidadMm: base.dimUnidadMm,
      // color?: opcional
    };
  })
  .filter(isNotNull);

  if (!contenido.length) return null;

  return {
    bulto: {
      codigo: String(opt.bulto.codigo ?? "").trim() || "BULTO",
      dimExternaMm: {
        largo: opt.bulto.largo_mm,
        ancho: opt.bulto.ancho_mm,
        alto: opt.bulto.alto_mm,
      },
      dimInternaMm: opt.dimInternaMm,
    },
    contenido,
  };
}, [opcionSeleccionada, topBultos, itemsMultiReal]);


  /* ============================
     Submit
  ============================ */

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrores([]);
    setMensaje(null);

    if (isMulti && opcionSeleccionada === null) {
      setErrores([
        "Seleccioná una opción de bulto antes de guardar la configuración.",
      ]);
      return;
    }

    const itemsToSave: MultiProductoConfiguracionItemInput[] = [];

    itemsMultiReal.forEach((i) => {
      itemsToSave.push({
        tipoProductoId: i.productoId,
        cantidadUnidades: i.cantidadUnidades,
        cantidadBultos: 1, // se ajusta según modelo real
        volumenTotalM3: i.volumenUnidadM3 * i.cantidadUnidades,
      });
    });

    startTransition(async () => {
      try {
        await onSubmit({
          descripcion: descripcion.trim() || null,
          items: itemsToSave,
        });
        setMensaje("Configuración guardada correctamente.");
      } catch {
        setErrores(["No se pudo guardar la configuración."]);
      }
    });
  };

  /* ============================
     Render
  ============================ */

  return (
    <section className="space-y-6 bg-white p-6 rounded-lg shadow-sm">
      <header>
        <h2 className="text-lg font-semibold">Cubicación multi-producto</h2>
        <p className="text-sm text-slate-600">
          Definí productos y dimensiones. Previsualizá el bulto antes de
          confirmar.
        </p>
      </header>

      {/* =======================
          TOP opciones
      ======================= */}

      {isMulti && topBultos.length > 0 && (
        <div className="space-y-3">
          <p className="font-semibold text-indigo-800">
            Opciones de bulto disponibles
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            {topBultos.map((opt, idx) => {
              const ocupacion = opt.packing?.ocupacionGlobalPct;
              return (
                <button
                  key={opt.bulto.id}
                  type="button"
                  onClick={() => setOpcionSeleccionada(idx)}
                  className={[
                    "rounded-md border p-3 text-left",
                    opcionSeleccionada === idx
                      ? "border-indigo-400 ring-2 ring-indigo-200 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <p className="font-semibold">
                    #{idx + 1} · {opt.bulto.codigo}
                  </p>

                  {ocupacion === undefined ? (
                    <p className="text-xs text-amber-700">
                      Sin packing (no previsualizable)
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Ocupación aprox.: {ocupacion.toFixed(1)}%
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================
          Viewer 3D
      ======================= */}

      {cubicacionBulto3DData && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">
            Previsualización 3D del bulto seleccionado
          </p>
          <CubicacionBultoViewer3D data={cubicacionBulto3DData} />
          <p className="text-xs text-slate-500">
            Vista aproximada para validar capacidad y ocupación antes de
            confirmar.
          </p>
        </div>
      )}

      {/* =======================
          Guardar
      ======================= */}

      <form onSubmit={handleSubmit} className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar configuración"}
        </button>
      </form>

      {errores.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-3 text-sm text-red-700 rounded-md">
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
    </section>
  );
}
