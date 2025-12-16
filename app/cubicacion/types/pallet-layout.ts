export type DimMm = { largo: number; ancho: number; alto: number };

export type Placement = {
  bultoCodigo: string;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  skuKeys: string[];
  pesoKg: number;
};

export type PalletLayout = {
  pallet: {
    codigo: string;
    dimMm: { largo: number; ancho: number; altoMax: number };
  };
  pallets: {
    index: number;
    pesoTotalKg: number;
    alturaUsadaMm: number;
    ocupacionVolumenPct: number;
    codigosUsados: string[];
    placements: Placement[];
  }[];
  resumen: {
    palletsNecesarios: number;
    ocupacionGlobalPct: number;
    pesoTotalKg: number;
    alturaMaxMm: number;
  };
};
