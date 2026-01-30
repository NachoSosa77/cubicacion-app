export type SourceTag = "SNAPSHOT" | "CATALOGO" | "BULTO_EMPRESA" | "FALLBACK";

export type DimMm = { largo: number; ancho: number; alto: number };

/** Rotación permitida para unidades dentro del bulto */
export type RotationMode = "NONE" | "ROT_6";

/** (opcional futuro) heurística de packing; hoy no la usás */
export type PackingHeuristic = "GRID_SIMPLE" | "EP_HEAVY";

export type BultoLayout3DPlacement = {
  tipo_producto_id: number;
  codigo: string;

  /** Dim final usada (puede ser rotada si rotationMode=ROT_6) */
  dim_unidad_mm: DimMm;

  positionMm: { x: number; y: number; z: number }; // centro
  capa: number;

  /** (opcional) te sirve para debug/explicar al cliente */
  rotationKey?: "LWH" | "LHW" | "WLH" | "WHL" | "HLW" | "HWL";
};

export type BultoLayout3D = {
  bulto: {
    dimInternaMm: DimMm;
  };

  /** “contenido” es el input que intentaste colocar (sin posiciones) */
  contenido: Array<{
    productoId: number;
    codigo: string;
    unidades: number;
    dimUnidadMm: DimMm;
  }>;

  placements: BultoLayout3DPlacement[];
  warnings: string[];

  /** (opcional) métricas para UI: % ocupación, volumen, etc */
  metrics?: {
    volumenBultoMm3: number;
    volumenOcupadoMm3: number;
    ocupacionVolumenPct: number; // 0..100
    unidadesColocadas: number;
  };

  /** (opcional) metadata del cálculo */
  meta?: {
    rotationMode?: RotationMode;
    heuristic?: PackingHeuristic;
    stopAtOcupacion01?: number; // 0..1
  };
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
    bultoEmpresaId?: number; // ✅ NO null
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
