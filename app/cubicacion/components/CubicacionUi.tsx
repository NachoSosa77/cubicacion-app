"use client";

import { useMemo, useState } from "react";
import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";
import { calcularCubicacionBultosEnPallet } from "../lib/cubicacion";
import { CubicacionViewer3D } from "./CubicacionViewer3D";

interface Props {
  contenedores: ITipoContenedor[];
  productos: ITipoProducto[];
}

export default function CubicacionUI({ contenedores, productos }: Props) {
  const [productoId, setProductoId] = useState<number | "">("");
  const [contenedorId, setContenedorId] = useState<number | "">("");
  const [alturaMaxCarga, setAlturaMaxCarga] = useState<string>(""); // en metros, opcional
  const [largoUnidadMm, setLargoUnidadMm] = useState<string>("");
  const [anchoUnidadMm, setAnchoUnidadMm] = useState<string>("");
  const [altoUnidadMm, setAltoUnidadMm] = useState<string>("");

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId),
    [productoId, productos]
  );

  const contenedorSeleccionado = useMemo(
    () => contenedores.find((c) => c.id === contenedorId),
    [contenedorId, contenedores]
  );

  const resultado = useMemo(() => {
    if (!productoSeleccionado || !contenedorSeleccionado) return null;

    const alturaMaximaM =
      alturaMaxCarga.trim() === "" ? undefined : Number(alturaMaxCarga);

    if (
      alturaMaximaM !== undefined &&
      (Number.isNaN(alturaMaximaM) || alturaMaximaM <= 0)
    ) {
      return null;
    }

    try {
      return calcularCubicacionBultosEnPallet({
        producto: productoSeleccionado,
        contenedor: contenedorSeleccionado,
        alturaMaxCargaM: alturaMaximaM,
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [productoSeleccionado, contenedorSeleccionado, alturaMaxCarga]);

  return (
    <div className="space-y-6">
      {/* Paso 1: selección de producto */}
      <section className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">1. Elegir producto</h2>

        {productos.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay productos cargados. Cargá al menos uno en{" "}
            <code>tipo_producto</code>.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Producto
            </label>
            <select
              className="w-full max-w-md border rounded-md px-3 py-2 text-sm"
              value={productoId}
              onChange={(e) =>
                setProductoId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <option value="">Seleccioná un producto</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.descripcion}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>
      {/* Paso 1.5: producto unitario dentro de la caja (bulto) */}
      {productoSeleccionado && (
        <section className="bg-white rounded-lg shadow-sm p-4 md:p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            1.5. Cómo entran los productos dentro de la caja (bulto)
          </h2>

          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* Formulario para medidas de producto unitario */}
            <div className="space-y-3 text-sm">
              <p className="text-slate-600">
                Estás trabajando con el bulto/caja del producto:{" "}
                <span className="font-medium">
                  {productoSeleccionado.codigo} —{" "}
                  {productoSeleccionado.descripcion}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Las dimensiones del bulto vienen de la base (tipo_producto).
                Ahora definimos las dimensiones del producto unitario para ver
                cómo se acomodan dentro de la caja.
              </p>

              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Largo unidad (mm)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-2 py-1 text-xs"
                    value={largoUnidadMm}
                    onChange={(e) => setLargoUnidadMm(e.target.value)}
                    placeholder="Ej: 200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Ancho unidad (mm)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-2 py-1 text-xs"
                    value={anchoUnidadMm}
                    onChange={(e) => setAnchoUnidadMm(e.target.value)}
                    placeholder="Ej: 150"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Alto unidad (mm)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-md px-2 py-1 text-xs"
                    value={altoUnidadMm}
                    onChange={(e) => setAltoUnidadMm(e.target.value)}
                    placeholder="Ej: 250"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Más adelante estas dimensiones se van a poder guardar junto con
                el producto. Por ahora las definimos a mano para validar la
                lógica y la visualización 3D.
              </p>

              <div className="text-xs text-slate-500">
                <p className="font-medium text-slate-700">
                  Dimensiones de la caja (bulto) actual:
                </p>
                <p>
                  {productoSeleccionado.largo_por_bulto} ×{" "}
                  {productoSeleccionado.ancho_por_bulto} ×{" "}
                  {productoSeleccionado.alto_por_bulto} mm
                </p>
              </div>
            </div>

            {/* Viewer 3D: producto dentro de la caja */}
            <div>
              {largoUnidadMm && anchoUnidadMm && altoUnidadMm ? (
                <CubicacionViewer3D
                  caja={{
                    // bulto en mm → metros
                    largoM: productoSeleccionado.largo_por_bulto / 1000,
                    anchoM: productoSeleccionado.ancho_por_bulto / 1000,
                    altoM: productoSeleccionado.alto_por_bulto / 1000,
                  }}
                  producto={{
                    // unidad en mm → metros
                    largoM: Number(largoUnidadMm) / 1000,
                    anchoM: Number(anchoUnidadMm) / 1000,
                    altoM: Number(altoUnidadMm) / 1000,
                  }}
                />
              ) : (
                <div className="h-80 md:h-96 flex items-center justify-center border rounded-md text-xs text-slate-500 bg-slate-50">
                  Ingresá las dimensiones de la unidad (largo, ancho, alto en
                  mm) para ver la distribución 3D dentro de la caja.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Paso 2: selección de contenedor / pallet */}
      <section className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-4">
          2. Elegir contenedor / pallet
        </h2>

        {contenedores.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay contenedores cargados. Revisá el seed de{" "}
            <code>tipo_contenedor</code>.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Contenedor disponible
            </label>
            <select
              className="w-full max-w-md border rounded-md px-3 py-2 text-sm"
              value={contenedorId}
              onChange={(e) =>
                setContenedorId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            >
              <option value="">Seleccioná un contenedor</option>
              {contenedores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} — {c.descripcion} ({c.largo_mts}m x {c.ancho_mts}m
                  x {c.alto_mts}m)
                </option>
              ))}
            </select>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">
                Altura máxima de carga (m){" "}
                <span className="text-slate-400">(opcional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="w-full max-w-xs border rounded-md px-3 py-2 text-sm"
                value={alturaMaxCarga}
                onChange={(e) => setAlturaMaxCarga(e.target.value)}
                placeholder="Ej: 2.4"
              />
              <p className="text-xs text-slate-500">
                Si lo dejás vacío, se usa la altura del contenedor (
                <code>alto_mts</code>).
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Resultado de la cubicación + vista 3D */}
      <section className="bg-white rounded-lg border border-slate-200 p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-semibold mb-4">
          3. Resultado de cubicación (cajas ↔ pallet)
        </h2>

        {!productoSeleccionado || !contenedorSeleccionado ? (
          <p className="text-sm text-slate-500">
            Seleccioná un producto y un contenedor para ver el cálculo.
          </p>
        ) : !resultado ? (
          <p className="text-sm text-red-500">
            Con las dimensiones actuales no entra ninguna caja en el contenedor.
          </p>
        ) : (
          <>
            {/* Datos numéricos */}
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <div className="space-y-1">
                <p>
                  <span className="font-medium">Cajas por capa:</span>{" "}
                  {resultado.cajasPorCapa}
                </p>
                <p>
                  <span className="font-medium">Capas:</span> {resultado.capas}
                </p>
                <p>
                  <span className="font-medium">Cajas totales por pallet:</span>{" "}
                  {resultado.cajasTotales}
                </p>
              </div>

              <div className="space-y-1">
                <p>
                  <span className="font-medium">Productos por caja:</span>{" "}
                  {resultado.productosPorCaja}
                </p>
                <p>
                  <span className="font-medium">
                    Productos totales por pallet:
                  </span>{" "}
                  {resultado.productosTotales}
                </p>
                <p>
                  <span className="font-medium">Ocupación volumétrica:</span>{" "}
                  {resultado.ocupacionVolumenPorcentaje.toFixed(1)} %
                </p>
              </div>

              <div className="space-y-1">
                <p>
                  <span className="font-medium">Volumen por bulto (m³):</span>{" "}
                  {resultado.volumenBultoM3.toFixed(4)}
                </p>
                <p>
                  <span className="font-medium">Volumen contenedor (m³):</span>{" "}
                  {resultado.volumenContenedorM3.toFixed(4)}
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
