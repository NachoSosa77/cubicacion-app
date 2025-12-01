"use client";

import { ITipoContenedor } from "../actions/tipoContenedorActions";
import { ResultadoCubicacion } from "../lib/cubicacion";

interface PalletLayout2DProps {
  contenedor: ITipoContenedor;
  resultado: ResultadoCubicacion;
}

/**
 * Vista 2D de planta del contenedor/pallet.
 * Representa:
 *  - el contenedor como un rectángulo proporcionado (largo vs ancho reales)
 *  - los bultos como una grilla de rectángulos (cajasPorLargo × cajasPorAncho)
 */
export function PalletLayout2D({ contenedor, resultado }: PalletLayout2DProps) {
  if (resultado.cajasPorCapa <= 0) return null;

  const { cajasPorLargo, cajasPorAncho } = resultado;

  // Proporción largo/ancho del contenedor
  const ratio =
    contenedor.ancho_mts > 0 ? contenedor.largo_mts / contenedor.ancho_mts : 1;

  const esPallet =
    contenedor.codigo.toUpperCase().includes("PALLET") ||
    contenedor.descripcion.toUpperCase().includes("PALLET");

  // Creamos un array para renderizar las "celdas" (bultos)
  const totalCeldas = cajasPorLargo * cajasPorAncho;
  const celdas = Array.from({ length: totalCeldas }, (_, i) => i);

  return (
    <div className="mt-6">
      <p className="text-xs font-medium text-slate-700 mb-2">
        Vista de planta del {esPallet ? "pallet" : "contenedor"} (solo una capa)
      </p>

      <div className="flex flex-col items-center gap-2">
        {/* Contenedor como rectángulo proporcional */}
        <div
          className="border-2 border-slate-700 bg-slate-900/10 relative"
          style={{
            // ancho fijo y alto calculado por proporción
            width: "360px",
            height: `${360 / ratio}px`,
          }}
        >
          {/* Etiquetas de lados */}
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-500">
            Frente / largo ({contenedor.largo_mts} m)
          </span>
          <span className="absolute top-1/2 -left-10 -translate-y-1/2 -rotate-90 text-[10px] text-slate-500">
            Ancho ({contenedor.ancho_mts} m)
          </span>

          {/* Grilla de bultos */}
          <div
            className="absolute inset-2 grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${cajasPorLargo}, 1fr)`,
              gridTemplateRows: `repeat(${cajasPorAncho}, 1fr)`,
            }}
          >
            {celdas.map((i) => (
              <div
                key={i}
                className="bg-sky-700/70 border border-sky-300/60 flex items-center justify-center text-[9px] text-white"
              >
                {/* Opcional: número de bulto dentro de la capa */}
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center max-w-md">
          Cada bloque representa un bulto (caja) en la primera capa. La cantidad
          de capas es {resultado.capas}. La vista es esquemática pero respeta la
          cantidad de cajas por largo y ancho del{" "}
          {esPallet ? "pallet" : "contenedor"} seleccionado.
        </p>
      </div>
    </div>
  );
}
