export type DimMm = { largo: number; ancho: number; alto: number };

export type BultoArmado = {
  codigo: string;
  largoMm: number;
  anchoMm: number;
  altoMm: number;
  pesoKg: number;
  // Para control de mezcla / SKUs
  skuKeys: string[]; // ej: ["CM0916BM"] o ["A","B"]
  // opcional: si luego agregás fragilidad
  fragil?: boolean;
};

export type PalletInput = {
  codigo: string;
  largoMm: number;
  anchoMm: number;
  altoMaxMm: number; // altura útil de carga
  pesoPalletKg: number;
  pesoMaxKg: number;
};

export type ReglaPallet = {
  permitirMezcla: boolean;
  maxCodigosPorPallet: number | null;
  maxAlturaMm: number | null;
};

export type Placement = {
  bultoCodigo: string;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
};

export type PalletResultado = {
  indice: number;
  pesoTotalKg: number;
  alturaUsadaMm: number;
  ocupacionVolumenPct: number;
  codigosUsados: string[];
  placements: Placement[];
};

export type ResultadoCubicacionPallet = {
  pallets: PalletResultado[];
  palletsNecesarios: number;
  ocupacionGlobalPct: number;
};
