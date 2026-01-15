"use client";

import { useMemo } from "react";
import type { CubicacionBulto3DInput } from "../types/cubicacion-3d";
import { CubicacionBultoViewer3D } from "./CubicacionBultoViewer3D";

type DimMm = { largo: number; ancho: number; alto: number };

function safeInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function tryDimMm(v: any): DimMm | null {
  if (!v) return null;
  const largo = safeInt(v.largo ?? v.largo_mm ?? v.l, 0);
  const ancho = safeInt(v.ancho ?? v.ancho_mm ?? v.a, 0);
  const alto = safeInt(v.alto ?? v.alto_mm ?? v.h, 0);
  if (largo > 0 && ancho > 0 && alto > 0) return { largo, ancho, alto };
  return null;
}

export function BultoViewerFromSnapshot({
  // dims del bulto (para el SKU seleccionado)
  bultoDimMm,
  // la unidad (dim_unidad_mm del lote) para el mismo SKU
  unidadDimMm,
  // para leyenda
  productoId,
  codigo,
  // para conteo (mostrar “× N”)
  unidades,
}: {
  bultoDimMm: DimMm;
  unidadDimMm?: DimMm | null;
  productoId: number;
  codigo: string;
  unidades: number;
}) {
  const data = useMemo<CubicacionBulto3DInput>(() => {
    return {
      bulto: {
        // el viewer usa dimInternaMm
        dimInternaMm: bultoDimMm,
      } as any,
      contenido: [
        {
          productoId,
          codigo,
          unidades: Math.max(1, Math.floor(unidades || 1)),
          dimUnidadMm: unidadDimMm ?? { largo: 1, ancho: 1, alto: 1 },
          // sin positionMm => hasPositions=false (se dibuja bulto + leyenda, sin layout)
        },
      ],
    };
  }, [bultoDimMm, unidadDimMm, productoId, codigo, unidades]);

  // Si no hay unidad real, evitamos que se vea una “caja 1×1×1”:
  const hasUnidad = !!unidadDimMm && unidadDimMm.largo > 0 && unidadDimMm.ancho > 0 && unidadDimMm.alto > 0;

  return (
    <div className="space-y-2">
      <CubicacionBultoViewer3D data={data} />

      {!hasUnidad && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Este SKU no tiene <span className="font-medium">dim_unidad_mm</span>. El visor muestra el bulto, pero no puede representar la unidad.
        </div>
      )}
    </div>
  );
}
