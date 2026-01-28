"use client";

import { useMemo } from "react";
import type { BultoLayout3DPlacement } from "../simulacion/types/types";
import type { CubicacionBulto3DInput } from "../types/cubicacion-3d";
import { CubicacionBultoViewer3D } from "./CubicacionBultoViewer3D";

type DimMm = { largo: number; ancho: number; alto: number };

export function BultoViewerFromSnapshot({
  bultoDimMm,
  unidadDimMm,
  productoId,
  codigo,
  unidades,
  placements,
}: {
  bultoDimMm: DimMm;
  unidadDimMm?: DimMm | null;
  productoId: number;
  codigo: string;
  unidades: number;
  placements?: BultoLayout3DPlacement[] | null;
}) {
  const data = useMemo<CubicacionBulto3DInput>(() => {
    const base = { bulto: { dimInternaMm: bultoDimMm } } as any;

    if (placements?.length) {
      return {
        ...base,
        contenido: placements.map((p) => ({
          productoId: p.tipo_producto_id,
          codigo: p.codigo,
          unidades: 1,
          dimUnidadMm: p.dim_unidad_mm,
          positionMm: p.positionMm, // con posiciones => layout real
        })),
      } as any;
    }

    return {
      ...base,
      contenido: [
        {
          productoId,
          codigo,
          unidades: Math.max(1, Math.floor(unidades || 1)),
          dimUnidadMm: unidadDimMm ?? { largo: 1, ancho: 1, alto: 1 },
        },
      ],
    } as any;
  }, [bultoDimMm, unidadDimMm, productoId, codigo, unidades, placements]);

  const hasUnidad =
    !!unidadDimMm && unidadDimMm.largo > 0 && unidadDimMm.ancho > 0 && unidadDimMm.alto > 0;

  return (
    <div className="space-y-2">
      <CubicacionBultoViewer3D data={data} />

      {!hasUnidad && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Este SKU no tiene <span className="font-medium">dim_unidad_mm</span>.
          El visor muestra el bulto, pero no puede representar la unidad.
        </div>
      )}
    </div>
  );
}
