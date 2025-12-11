"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";
import type {
  MultiProductoConfiguracionInput,
  MultiProductoConfiguracionItemInput,
} from "../actions/saveMultiProductoConfiguracion";
import { calcularUnidadEnBulto } from "../lib/cubicacion";

type ItemState = {
  key: string;
  productoId: number | "";
  cantidadBultos: string;
  largoUnidadMm: string;
  anchoUnidadMm: string;
  altoUnidadMm: string;
  grosorParedMm: string;
  bultoLargoMm: string;
  bultoAnchoMm: string;
  bultoAltoMm: string;
};

interface Props {
  productos: ITipoProducto[];
  contenedores: ITipoContenedor[];
  onSubmit: (input: MultiProductoConfiguracionInput) => Promise<void>;
}

const numberOrNull = (value: string): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
};

export function MultiProductoConfigurator({
  productos,
  contenedores,
  onSubmit,
}: Props) {
  const [items, setItems] = useState<ItemState[]>([
    {
      key: crypto.randomUUID(),
      productoId: "",
      cantidadBultos: "",
      largoUnidadMm: "",
      anchoUnidadMm: "",
      altoUnidadMm: "",
      grosorParedMm: "",
      bultoLargoMm: "",
      bultoAnchoMm: "",
      bultoAltoMm: "",
    },
  ]);
  const [descripcion, setDescripcion] = useState("");
  const [contenedorId, setContenedorId] = useState<number | "">("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const detalles = useMemo(() => {
    return items.map((item) => {
      const producto = productos.find((p) => p.id === item.productoId);
      const cantidad = numberOrNull(item.cantidadBultos);

      const largo = numberOrNull(item.largoUnidadMm);
      const ancho = numberOrNull(item.anchoUnidadMm);
      const alto = numberOrNull(item.altoUnidadMm);
      const grosor = Math.max(numberOrNull(item.grosorParedMm) ?? 0, 0);

      const bultoLargo = numberOrNull(item.bultoLargoMm) ?? producto?.largo_por_bulto ?? null;
      const bultoAncho = numberOrNull(item.bultoAnchoMm) ?? producto?.ancho_por_bulto ?? null;
      const bultoAlto = numberOrNull(item.bultoAltoMm) ?? producto?.alto_por_bulto ?? null;

      const dimensionesValidas =
        largo !== null && largo > 0 &&
        ancho !== null && ancho > 0 &&
        alto !== null && alto > 0;

      const resultadoUnidad =
        producto && dimensionesValidas && bultoLargo && bultoAncho && bultoAlto
          ? calcularUnidadEnBulto({
              producto,
              dimUnidadMm: { largo, ancho, alto },
              grosorParedMm: grosor,
              dimExternaBultoMm: { largo: bultoLargo, ancho: bultoAncho, alto: bultoAlto },
            })
          : null;

      const volumenBultoM3 = bultoLargo && bultoAncho && bultoAlto
        ? (bultoLargo * bultoAncho * bultoAlto) / 1_000_000_000
        : 0;

      const totalVolumen = cantidad && cantidad > 0 ? volumenBultoM3 * cantidad : 0;

      const volumenInternoDisponibleM3 = resultadoUnidad
        ? (resultadoUnidad.dimInternaBulto.largo *
            resultadoUnidad.dimInternaBulto.ancho *
            resultadoUnidad.dimInternaBulto.alto) /
          1_000_000_000
        : 0;

      const volumenInternoUsadoM3 =
        volumenInternoDisponibleM3 *
        ((resultadoUnidad?.ocupacionVolumenInterno ?? 0) / 100);

      return {
        item,
        producto,
        cantidad,
        resultadoUnidad,
        volumenBultoM3,
        totalVolumen,
        volumenInternoDisponibleM3: volumenInternoDisponibleM3 * (cantidad ?? 0),
        volumenInternoUsadoM3: volumenInternoUsadoM3 * (cantidad ?? 0),
      };
    });
  }, [items, productos]);

  const totales = useMemo(() => {
    const totalVolumen = detalles.reduce((acc, det) => acc + det.totalVolumen, 0);
    const volumenInternoDisponible = detalles.reduce(
      (acc, det) => acc + det.volumenInternoDisponibleM3,
      0
    );
    const volumenInternoUsado = detalles.reduce(
      (acc, det) => acc + det.volumenInternoUsadoM3,
      0
    );

    const ocupacionInterna =
      volumenInternoDisponible > 0
        ? (volumenInternoUsado / volumenInternoDisponible) * 100
        : 0;

    const contenedor =
      contenedorId === "" ? null : contenedores.find((c) => c.id === contenedorId);

    const capacidadContenedorM3 = contenedor
      ? contenedor.largo_mts * contenedor.ancho_mts * contenedor.alto_mts
      : null;

    return {
      totalVolumen,
      volumenInternoDisponible,
      volumenInternoUsado,
      ocupacionInterna,
      contenedor,
      capacidadContenedorM3,
    };
  }, [detalles, contenedorId, contenedores]);

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

  const agregarFila = () => {
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productoId: "",
        cantidadBultos: "",
        largoUnidadMm: "",
        anchoUnidadMm: "",
        altoUnidadMm: "",
        grosorParedMm: "",
        bultoLargoMm: "",
        bultoAnchoMm: "",
        bultoAltoMm: "",
      },
    ]);
  };

  const eliminarFila = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const actualizarItem = (key: string, campo: keyof ItemState, valor: any) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, [campo]: valor } : item))
    );
  };

  const seleccionarProducto = (key: string, productoId: number | "") => {
    const producto = productos.find((p) => p.id === productoId);

    setItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? {
              ...item,
              productoId,
              bultoLargoMm:
                item.bultoLargoMm === "" && producto
                  ? String(producto.largo_por_bulto)
                  : item.bultoLargoMm,
              bultoAnchoMm:
                item.bultoAnchoMm === "" && producto
                  ? String(producto.ancho_por_bulto)
                  : item.bultoAnchoMm,
              bultoAltoMm:
                item.bultoAltoMm === "" && producto
                  ? String(producto.alto_por_bulto)
                  : item.bultoAltoMm,
            }
          : item
      )
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrores([]);
    setMensaje(null);

    const mensajes: string[] = [];

    items.forEach((item, index) => {
      if (item.productoId === "") {
        mensajes.push(`Fila ${index + 1}: seleccioná un producto.`);
      }
      if (!item.cantidadBultos || Number(item.cantidadBultos) <= 0) {
        mensajes.push(`Fila ${index + 1}: indicá la cantidad de bultos (número positivo).`);
      }
      if (!item.largoUnidadMm || !item.anchoUnidadMm || !item.altoUnidadMm) {
        mensajes.push(
          `Fila ${index + 1}: completá las dimensiones de la unidad en milímetros.`
        );
      }
      if (
        (item.bultoLargoMm !== "" || item.bultoAnchoMm !== "" || item.bultoAltoMm !== "") &&
        (!Number(item.bultoLargoMm) || !Number(item.bultoAnchoMm) || !Number(item.bultoAltoMm))
      ) {
        mensajes.push(
          `Fila ${index + 1}: completá las tres medidas externas del bulto si querés usar un tamaño genérico.`
        );
      }
    });

    if (hayProductosDuplicados) {
      mensajes.push("Hay productos duplicados. Cada fila debe usar un código distinto.");
    }

    if (mensajes.length) {
      setErrores(mensajes);
      return;
    }

    const payloadItems: MultiProductoConfiguracionItemInput[] = [];

    for (const det of detalles) {
      if (!det.producto || !det.cantidad || det.cantidad <= 0) continue;
      payloadItems.push({
        tipoProductoId: det.producto.id,
        cantidadBultos: det.cantidad,
        volumenTotalM3: det.totalVolumen,
      });
    }

    if (!payloadItems.length) {
      setErrores(["No hay filas válidas para guardar."]);
      return;
    }

    startTransition(async () => {
      try {
        await onSubmit({
          descripcion: descripcion.trim() || null,
          items: payloadItems,
        });
        setMensaje("Configuración guardada exitosamente.");
      } catch (error) {
        console.error(error);
        setErrores(["No se pudo guardar la configuración. Intentá nuevamente."]);
      }
    });
  };

  return (
    <section className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cubicación multi-producto</h2>
          <p className="text-sm text-slate-600">
            Agregá varios códigos, definí cómo entran en su bulto y validá el volumen total antes de guardar.
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

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="overflow-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">Cant. bultos</th>
                <th className="px-3 py-2">Largo (mm)</th>
                <th className="px-3 py-2">Ancho (mm)</th>
                <th className="px-3 py-2">Alto (mm)</th>
                <th className="px-3 py-2">Grosor pared (mm)</th>
                <th className="px-3 py-2">Ocupación interna</th>
                <th className="px-3 py-2">Volumen total</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const detalle = detalles.find((det) => det.item.key === item.key);
                const ocupacion =
                  detalle?.resultadoUnidad?.ocupacionVolumenInterno ?? null;

                return (
                  <tr key={item.key} className="border-t align-top">
                    <td className="px-3 py-2 min-w-[200px]">
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
                            {prod.codigo} — {prod.descripcion}
                          </option>
                        ))}
                      </select>
                      {detalle?.producto && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Bulto externo: {detalle.producto.largo_por_bulto} × {" "}
                          {detalle.producto.ancho_por_bulto} × {" "}
                          {detalle.producto.alto_por_bulto} mm
                        </p>
                      )}
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] font-medium text-slate-600">
                          Reemplazar bulto (mm)
                        </p>
                        <div className="flex gap-1 text-[11px]">
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            className="w-16 border rounded px-1 py-0.5"
                            value={item.bultoLargoMm}
                            onChange={(e) =>
                              actualizarItem(item.key, "bultoLargoMm", e.target.value)
                            }
                            placeholder="L"
                          />
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            className="w-16 border rounded px-1 py-0.5"
                            value={item.bultoAnchoMm}
                            onChange={(e) =>
                              actualizarItem(item.key, "bultoAnchoMm", e.target.value)
                            }
                            placeholder="A"
                          />
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            className="w-16 border rounded px-1 py-0.5"
                            value={item.bultoAltoMm}
                            onChange={(e) =>
                              actualizarItem(item.key, "bultoAltoMm", e.target.value)
                            }
                            placeholder="H"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Dejalo vacío para usar el bulto del producto. Útil para unificar varios códigos en un mismo embalaje.
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        className="w-24 border rounded-md px-2 py-1"
                        value={item.cantidadBultos}
                        onChange={(e) =>
                          actualizarItem(item.key, "cantidadBultos", e.target.value)
                        }
                        placeholder="Ej: 10"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        className="w-24 border rounded-md px-2 py-1"
                        value={item.largoUnidadMm}
                        onChange={(e) =>
                          actualizarItem(item.key, "largoUnidadMm", e.target.value)
                        }
                        placeholder="Largo"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        className="w-24 border rounded-md px-2 py-1"
                        value={item.anchoUnidadMm}
                        onChange={(e) =>
                          actualizarItem(item.key, "anchoUnidadMm", e.target.value)
                        }
                        placeholder="Ancho"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        className="w-24 border rounded-md px-2 py-1"
                        value={item.altoUnidadMm}
                        onChange={(e) =>
                          actualizarItem(item.key, "altoUnidadMm", e.target.value)
                        }
                        placeholder="Alto"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="w-24 border rounded-md px-2 py-1"
                        value={item.grosorParedMm}
                        onChange={(e) =>
                          actualizarItem(item.key, "grosorParedMm", e.target.value)
                        }
                        placeholder="0"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Se descuenta dos veces por eje.
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {ocupacion === null ? (
                        <span className="text-slate-400">Sin datos</span>
                      ) : (
                        <span className={ocupacion < 60 ? "text-amber-600" : ""}>
                          {ocupacion.toFixed(1)}%
                        </span>
                      )}
                      {detalle?.resultadoUnidad && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Grid: {detalle.resultadoUnidad.unidadesPorEje.x} × {" "}
                          {detalle.resultadoUnidad.unidadesPorEje.y} × {" "}
                          {detalle.resultadoUnidad.unidadesPorEje.z}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {detalle?.totalVolumen ? (
                        <span className="font-semibold">
                          {detalle.totalVolumen.toFixed(3)} m³
                        </span>
                      ) : (
                        <span className="text-slate-400">0 m³</span>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={agregarFila}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm hover:bg-slate-50"
          >
            + Agregar producto
          </button>

          <div className="flex flex-col text-sm">
            <label className="font-medium text-slate-700">Contenedor de referencia</label>
            <select
              className="border rounded-md px-3 py-2"
              value={contenedorId}
              onChange={(e) =>
                setContenedorId(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Sin contenedor</option>
              {contenedores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.descripcion}
                </option>
              ))}
            </select>
            {totales.capacidadContenedorM3 && (
              <span className="text-[11px] text-slate-500 mt-1">
                Capacidad geométrica: {totales.capacidadContenedorM3.toFixed(2)} m³
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-50 border rounded-md p-3 text-sm space-y-2">
          <p className="font-semibold text-slate-800">
            Resumen rápido
          </p>
          <p>
            Volumen total de bultos: <span className="font-semibold">{totales.totalVolumen.toFixed(3)} m³</span>
          </p>
          <p>
            Ocupación interna combinada: {" "}
            <span className="font-semibold">
              {totales.ocupacionInterna.toFixed(1)}%
            </span>
            {totales.volumenInternoDisponible === 0 && " (necesita dimensiones válidas)"}
          </p>

          {totales.capacidadContenedorM3 && totales.totalVolumen > totales.capacidadContenedorM3 && (
            <p className="text-red-600 font-medium">
              ⚠ El volumen total excede la capacidad geométrica del contenedor seleccionado.
            </p>
          )}

          {totales.ocupacionInterna > 0 && totales.ocupacionInterna < 85 && (
            <p className="text-amber-600 font-medium">
              ⚠ Hay huecos internos significativos. Revisá las dimensiones u orientación para mejorar la ocupación.
            </p>
          )}
        </div>

        {errores.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3 space-y-1">
            {errores.map((err, idx) => (
              <p key={idx}>• {err}</p>
            ))}
          </div>
        )}

        {mensaje && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-md p-3">
            {mensaje}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </form>
    </section>
  );
}
