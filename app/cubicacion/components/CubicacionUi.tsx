// app/cubicacion/components/CubicacionUI.tsx
"use client";

import { useMemo, useState } from "react";
import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";
import {
  DimMm,
  calcularCubicacionBultosEnPallet,
  calcularUnidadEnBulto,
} from "../lib/cubicacion";
import { CubicacionViewer3D } from "./CubicacionViewer3D";
import { HighQualityPalletViewer3D } from "./HighQualityPalletViewer3D";
import { ModoVisualToggle } from "./ModoVisualToggle";

interface Props {
  contenedores: ITipoContenedor[];
  productos: ITipoProducto[];
}

type ModoVisual = "real" | "real_sep" | "didactico";

export default function CubicacionUI({ contenedores, productos }: Props) {
  const [productoId, setProductoId] = useState<number | "">("");
  const [contenedorId, setContenedorId] = useState<number | "">("");
  const [alturaMaxCarga, setAlturaMaxCarga] = useState<string>(""); // en metros, opcional
  const [largoUnidadMm, setLargoUnidadMm] = useState<string>("");
  const [anchoUnidadMm, setAnchoUnidadMm] = useState<string>("");
  const [altoUnidadMm, setAltoUnidadMm] = useState<string>("");
  const [grosorParedMm, setGrosorParedMm] = useState<string>(""); // grosor de la caja
  const [modoVisual, setModoVisual] = useState<ModoVisual>("real_sep");

  // Dimensiones de la unidad en mm, validadas
  const dimUnidadMm: DimMm | null = useMemo(() => {
    if (!largoUnidadMm || !anchoUnidadMm || !altoUnidadMm) return null;

    const largo = Number(largoUnidadMm);
    const ancho = Number(anchoUnidadMm);
    const alto = Number(altoUnidadMm);

    if (
      !Number.isFinite(largo) ||
      !Number.isFinite(ancho) ||
      !Number.isFinite(alto) ||
      largo <= 0 ||
      ancho <= 0 ||
      alto <= 0
    ) {
      return null;
    }

    return { largo, ancho, alto };
  }, [largoUnidadMm, anchoUnidadMm, altoUnidadMm]);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId),
    [productoId, productos]
  );

  const contenedorSeleccionado = useMemo(
    () => contenedores.find((c) => c.id === contenedorId),
    [contenedorId, contenedores]
  );

  // Grosor numérico seguro (si está vacío o mal → 0)
  const grosorNumerico = useMemo(() => {
    if (!grosorParedMm.trim()) return 0;
    const g = Number(grosorParedMm);
    if (!Number.isFinite(g) || g < 0) return 0;
    return g;
  }, [grosorParedMm]);

  // Dimensiones internas del bulto que realmente usamos para la cubicación
  const dimInternaBultoMm: DimMm | null = useMemo(() => {
    if (!productoSeleccionado) return null;

    const g = grosorNumerico;
    const interna = (externa: number) => Math.max(externa - 2 * g, 0);

    return {
      largo: interna(productoSeleccionado.largo_por_bulto),
      ancho: interna(productoSeleccionado.ancho_por_bulto),
      alto: interna(productoSeleccionado.alto_por_bulto),
    };
  }, [productoSeleccionado, grosorNumerico]);

  // Resultado bultos ↔ pallet
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

  // Resultado unidad ↔ bulto
  const resultadoUnidadEnBulto = useMemo(() => {
    if (!productoSeleccionado || !dimUnidadMm) return null;

    return calcularUnidadEnBulto({
      producto: productoSeleccionado,
      dimUnidadMm,
      grosorParedMm: grosorNumerico,
    });
  }, [productoSeleccionado, dimUnidadMm, grosorNumerico]);

  const gapFactor = useMemo(() => {
    switch (modoVisual) {
      case "real":
        return 1; // sin separación visual
      case "didactico":
        return 0.85; // más aire
      case "real_sep":
      default:
        return 0.95; // leve separación
    }
  }, [modoVisual]);

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
                cómo se acomodan dentro de la caja y, opcionalmente, el grosor
                de la pared para calcular las dimensiones internas reales.
              </p>

              {/* Grosor de pared */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Grosor de la pared de la caja (mm)
                </label>
                <input
                  type="number"
                  className="w-full max-w-xs border rounded-md px-2 py-1 text-xs"
                  value={grosorParedMm}
                  onChange={(e) => setGrosorParedMm(e.target.value)}
                  placeholder="Ej: 3"
                  min={0}
                />
                <p className="text-[10px] text-slate-500">
                  Se descuenta dos veces el grosor en cada dimensión para
                  obtener el espacio interno disponible. Si lo dejás vacío, se
                  asume grosor 0 mm.
                </p>
              </div>

              {/* Inputs de dimensiones de la unidad */}
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

              {/* Info de dimensiones del bulto */}
              <div className="text-xs text-slate-500 mt-3 space-y-1">
                <p className="font-medium text-slate-700">
                  Dimensiones de la caja (bulto) externas:
                </p>
                <p>
                  {productoSeleccionado.largo_por_bulto} ×{" "}
                  {productoSeleccionado.ancho_por_bulto} ×{" "}
                  {productoSeleccionado.alto_por_bulto} mm
                </p>

                {dimInternaBultoMm && (
                  <>
                    <p className="font-medium text-slate-700 mt-2">
                      Dimensiones internas usadas para la cubicación:
                    </p>
                    <p>
                      {dimInternaBultoMm.largo.toFixed(1)} ×{" "}
                      {dimInternaBultoMm.ancho.toFixed(1)} ×{" "}
                      {dimInternaBultoMm.alto.toFixed(1)} mm
                    </p>
                  </>
                )}
              </div>

              {/* Resultado de cubicación interna */}
              <div className="mt-3 text-xs text-slate-600 space-y-1 border-t pt-3">
                {dimUnidadMm ? (
                  !resultadoUnidadEnBulto ? (
                    <p className="text-red-500">
                      Con estas dimensiones de unidad y el grosor indicado no
                      entra ningún producto completo dentro del bulto.
                    </p>
                  ) : (
                    <>
                      <p className="font-medium text-slate-700">
                        Distribución de productos dentro del bulto:
                      </p>
                      <p>
                        Unidades por eje (largo × ancho × alto):{" "}
                        <span className="font-mono">
                          {resultadoUnidadEnBulto.unidadesPorEje.x} ×{" "}
                          {resultadoUnidadEnBulto.unidadesPorEje.y} ×{" "}
                          {resultadoUnidadEnBulto.unidadesPorEje.z}
                        </span>
                      </p>
                      <p>
                        Unidades totales por bulto:{" "}
                        <span className="font-semibold">
                          {resultadoUnidadEnBulto.unidadesTotales}
                        </span>
                      </p>
                      <p>
                        Ocupación del volumen interno de la caja:{" "}
                        <span className="font-semibold">
                          {resultadoUnidadEnBulto.ocupacionVolumenInterno.toFixed(
                            1
                          )}
                          %
                        </span>
                      </p>
                    </>
                  )
                ) : (
                  <p className="text-slate-500">
                    Ingresá las dimensiones de la unidad para ver cuántas entran
                    en la caja y la ocupación interna.
                  </p>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Más adelante estas dimensiones se van a poder guardar junto con
                el producto. Por ahora las definimos a mano para validar la
                lógica, el grosor de la caja y la visualización 3D.
              </p>
            </div>

            {/* Viewer 3D: producto dentro de la caja */}
            <div className="space-y-2">
              {/* Controles de modo visual */}
              <ModoVisualToggle value={modoVisual} onChange={setModoVisual} />

              {resultadoUnidadEnBulto ? (
                <CubicacionViewer3D
                  caja={{
                    // bulto en mm → metros (externo, pero la unidad respeta interno)
                    largoM: productoSeleccionado.largo_por_bulto / 1000,
                    anchoM: productoSeleccionado.ancho_por_bulto / 1000,
                    altoM: productoSeleccionado.alto_por_bulto / 1000,
                  }}
                  unidad={{
                    // unidad ORIENTADA en mm → metros
                    largoM: resultadoUnidadEnBulto.orientacion.largo / 1000,
                    anchoM: resultadoUnidadEnBulto.orientacion.ancho / 1000,
                    altoM: resultadoUnidadEnBulto.orientacion.alto / 1000,
                  }}
                  grid={{
                    x: resultadoUnidadEnBulto.unidadesPorEje.x,
                    y: resultadoUnidadEnBulto.unidadesPorEje.y,
                    z: resultadoUnidadEnBulto.unidadesPorEje.z,
                  }}
                  gapFactor={gapFactor}
                />
              ) : (
                <div className="h-80 md:h-96 flex items-center justify-center border rounded-md text-xs text-slate-500 bg-slate-50">
                  Ingresá dimensiones válidas de la unidad (largo, ancho, alto
                  en mm) para ver cómo se acomodan dentro de la caja.
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                El modo solo afecta la separación visual entre unidades. Las
                cantidades y dimensiones reales se mantienen.
              </p>
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

      {/* Resultado de la cubicación + vista 3D (pallet) */}
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
            <div className="grid gap-3 text-sm md:grid-cols-2">
              {/* ... tus datos numéricos como ahora ... */}
            </div>

            {/* Vista 3D de alta calidad del pallet + bultos */}
            <HighQualityPalletViewer3D
              producto={productoSeleccionado}
              contenedor={contenedorSeleccionado}
              resultado={resultado}
            />
          </>
        )}
      </section>
    </div>
  );
}
