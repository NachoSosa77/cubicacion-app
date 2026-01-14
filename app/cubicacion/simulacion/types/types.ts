export type SourceTag = "SNAPSHOT" | "CATALOGO" | "BULTO_EMPRESA" | "FALLBACK";

export type DimMm = { largo: number; ancho: number; alto: number };

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
  candidateKey: "A" | "B" | "C";
  titulo: string;
  scope: "SKU";
  items: BultoSimSnapshotItem[];
  warnings: string[];
  totales: {
    unidades: number;
    bultos: number;
    bultosParciales: number;
  };
};
