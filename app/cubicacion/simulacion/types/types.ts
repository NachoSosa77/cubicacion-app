export type SourceTag = "SNAPSHOT" | "CATALOGO" | "BULTO_EMPRESA" | "FALLBACK";

export type DimMm = { largo: number; ancho: number; alto: number };

export type BultoLayout3DPlacement = {
  tipo_producto_id: number;
  codigo: string;
  dim_unidad_mm: DimMm;
  positionMm: { x: number; y: number; z: number }; // centro
  capa: number;
};

export type BultoLayout3D = {
  bulto: {
    dimInternaMm: DimMm;
  };
  contenido: Array<{
    productoId: number;
    codigo: string;
    unidades: number;
    dimUnidadMm: DimMm;
    positionMm?: { x: number; y: number; z: number }; // centro
    capa?: number;
  }>;
  placements: BultoLayout3DPlacement[];
  warnings: string[];
};

export type BultoSimSnapshotItem = {
  tipo_producto_id: number;
  codigo: string;
  unidades_planificadas: number;
  unidades_por_bulto: number;
  cantidad_bultos: number;
  sobrante_unidades: number;
  dim_bulto_mm?: DimMm | null;
  audit: {
    sourceUnPorBulto: SourceTag;
    sourceDims: SourceTag;
    bultoEmpresaId?: number; // <- importante: NO null
    bultoEmpresaCodigo?: string;
  };
};

export type BultoSimSnapshot = {
  candidateKey: "A" | "B" | "C" | "D";
  titulo: string;
  scope: "SKU" | "MIXTO";
  permiteMezcla?: boolean;
  porcentajeMezcla01?: number; // 0..1
  items: BultoSimSnapshotItem[];
  warnings: string[];
  totales: {
    unidades: number;
    bultos: number;
    bultosParciales: number;
  };
  layout3d?: BultoLayout3D;
};
