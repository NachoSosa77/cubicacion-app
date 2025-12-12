export type DimMm = {
  largo: number;
  ancho: number;
  alto: number;
};

export type CubicacionBulto3DInput = {
  bulto: {
    codigo: string;
    dimExternaMm: DimMm;
    dimInternaMm: DimMm;
  };
  contenido: Array<{
    productoId: number;
    codigo: string;
    unidades: number;
    dimUnidadMm: DimMm;
    color?: string;
  }>;
};
