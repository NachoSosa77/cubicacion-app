// app/cubicacion/components/PalletViewer3D.tsx
"use client";

import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";
import { ResultadoCubicacion } from "../lib/cubicacion";
import { CubicacionViewer3D } from "./CubicacionViewer3D";
import { ModoVisual } from "./ModoVisualToggle";

interface PalletViewer3DProps {
  producto: ITipoProducto;
  contenedor: ITipoContenedor;
  resultado: ResultadoCubicacion;
  modoVisual: ModoVisual;
}

export function PalletViewer3D({
  producto,
  contenedor,
  resultado,
  modoVisual,
}: PalletViewer3DProps) {
  if (resultado.cajasPorCapa <= 0 || resultado.capas <= 0) {
    return null;
  }

  // Dimensiones en metros
  const largoPalletM = contenedor.largo_mts;
  const anchoPalletM = contenedor.ancho_mts;
  const altoBultoM = producto.alto_por_bulto / 1000;

  // Altura de la pila de bultos
  const alturaStackM = Math.max(altoBultoM * resultado.capas, altoBultoM);

  // gapFactor según modo
  const gapFactor =
    modoVisual === "real" ? 1 : modoVisual === "real_sep" ? 0.95 : 0.85;

  const isPallet =
    contenedor.codigo.toUpperCase().includes("PALLET") ||
    contenedor.descripcion.toUpperCase().includes("PALLET");

  return (
    <div className="mt-4">
      <CubicacionViewer3D
        caja={{
          // “Caja” que envuelve la carga sobre el pallet
          largoM: largoPalletM,
          anchoM: anchoPalletM,
          altoM: alturaStackM,
        }}
        unidad={{
          // Cada bulto en metros (sin rotaciones todavía)
          largoM: producto.largo_por_bulto / 1000,
          anchoM: producto.ancho_por_bulto / 1000,
          altoM: altoBultoM,
        }}
        grid={{
          x: resultado.cajasPorLargo,
          y: resultado.cajasPorAncho,
          z: resultado.capas,
        }}
        gapFactor={gapFactor}
      />
      <p className="mt-1 text-[10px] text-slate-400">
        Vista 3D de la carga sobre el {isPallet ? "pallet" : "contenedor"} según
        la cubicación calculada.
      </p>
    </div>
  );
}
