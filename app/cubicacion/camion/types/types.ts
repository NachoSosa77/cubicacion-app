export type DimMm = { largo: number; ancho: number; alto: number };

export type CamionPlacement = {
  palletPlanId: number;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

export type CamionPlanResult = {
  palletsTotales: number;
  palletsEnCamion: number;
  camionesRequeridos: number;
  pesoTotalKg: number;
  ocupacionBasePct: number;
  warnings: string[];
  placements: CamionPlacement[];
  camionDimMm: DimMm;
};

export type VarianteKey = "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";

export type PreviewResponse = {
  recommended: VarianteKey;
  plans: Record<VarianteKey, CamionPlanResult>;
};
