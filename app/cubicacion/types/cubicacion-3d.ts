// app/cubicacion/types/cubicacion-3d.ts
export type DimMm = { largo: number; ancho: number; alto: number };

export type CubicacionBulto3DItem = {
  productoId: number;
  codigo: string;
  unidades: number; // si viene con placements, suele ser 1 por item
  dimUnidadMm: DimMm;
  color?: string;

  /**
   * Centro del cubo en mm, relativo al centro del bulto interno.
   * Si está presente, el viewer dibuja exactamente en esa posición (sin recalcular).
   */
  positionMm?: { x: number; y: number; z: number };
};

export type CubicacionBulto3DInput = {
  bulto: {
    codigo: string;
    dimExternaMm: DimMm;
    dimInternaMm: DimMm;
  };
  contenido: CubicacionBulto3DItem[];
};
