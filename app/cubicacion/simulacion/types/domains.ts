export type DimMm = { largo: number; ancho: number; alto: number };

export type EmpresaBultoDTO = {
  id: number;
  empresa_id: number;
  codigo: string;
  descripcion?: string | null;

  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;

  espesor_pared_mm: number;

  largo_int_mm?: number | null;
  ancho_int_mm?: number | null;
  alto_int_mm?: number | null;

  tara_kg?: number | null;
  max_peso_kg?: number | null;

  es_preferido: boolean;
  habilitado: boolean;
};
