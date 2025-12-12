import type { IEmpresaBulto } from "../actions/empresaBultoActions";
import {
  cubicacionMultiProductoEnBultos,
  type ResultadoCubicacionMultiProducto,
} from "./cubicacion-multiproducto";

export type DimMm = { largo: number; ancho: number; alto: number };

export type MultiProductoUnidadInputReal = {
  itemKey: string;
  productoId: number;
  codigoProducto?: string;
  descripcionProducto?: string;
  cantidadUnidades: number;

  // Para packing por volumen
  volumenUnidadM3: number;

  // Para validación geométrica mínima (entra o no entra)
  dimUnidadMm: DimMm;
};

export type EvaluacionBultoEmpresa = {
  bulto: IEmpresaBulto;
  dimInternaMm: DimMm;
  capacidadInternaM3: number;

  // Si no es viable, explicamos por qué
  viable: boolean;
  motivosNoViable: string[];

  // Si es viable, resultado del packing volumétrico
  packing: ResultadoCubicacionMultiProducto | null;

  // Para ranking
  score: number;
};

const orientaciones = (d: DimMm): DimMm[] => [
  { largo: d.largo, ancho: d.ancho, alto: d.alto },
  { largo: d.largo, ancho: d.alto, alto: d.ancho },
  { largo: d.ancho, ancho: d.largo, alto: d.alto },
  { largo: d.ancho, ancho: d.alto, alto: d.largo },
  { largo: d.alto, ancho: d.largo, alto: d.ancho },
  { largo: d.alto, ancho: d.ancho, alto: d.largo },
];

function entraEnBulto(dimUnidad: DimMm, dimBultoInterna: DimMm): boolean {
  return orientaciones(dimUnidad).some((o) => {
    return (
      o.largo <= dimBultoInterna.largo &&
      o.ancho <= dimBultoInterna.ancho &&
      o.alto <= dimBultoInterna.alto
    );
  });
}

function dimsInternas(b: IEmpresaBulto): DimMm {
  const e = Math.max(0, b.espesor_pared_mm ?? 0);
  return {
    largo: Math.max(0, b.largo_mm - 2 * e),
    ancho: Math.max(0, b.ancho_mm - 2 * e),
    alto: Math.max(0, b.alto_mm - 2 * e),
  };
}

function volumenM3(d: DimMm): number {
  return (d.largo * d.ancho * d.alto) / 1_000_000_000;
}

export function evaluarTopBultosEmpresa(
  items: MultiProductoUnidadInputReal[],
  bultos: IEmpresaBulto[],
  topN = 3
): EvaluacionBultoEmpresa[] {
  const itemsValidos = items.filter(
    (i) =>
      i.cantidadUnidades > 0 &&
      i.volumenUnidadM3 > 0 &&
      i.dimUnidadMm.largo > 0 &&
      i.dimUnidadMm.ancho > 0 &&
      i.dimUnidadMm.alto > 0
  );

  if (!itemsValidos.length) return [];

  const evaluaciones: EvaluacionBultoEmpresa[] = bultos
    .filter((b) => b.habilitado)
    .map((b) => {
      const di = dimsInternas(b);
      const cap = volumenM3(di);

      const motivos: string[] = [];

      if (di.largo <= 0 || di.ancho <= 0 || di.alto <= 0) {
        motivos.push(
          "Dimensiones internas inválidas (espesor demasiado grande o medidas 0)."
        );
      }
      if (cap <= 0) {
        motivos.push("Capacidad interna (m³) inválida.");
      }

      // Validación geométrica mínima: cada producto debe poder entrar
      for (const it of itemsValidos) {
        if (!entraEnBulto(it.dimUnidadMm, di)) {
          motivos.push(
            `El producto ${
              it.codigoProducto ?? it.productoId
            } no entra físicamente en el bulto (ninguna orientación).`
          );
        }
      }

      const viable = motivos.length === 0;

      let packing: ResultadoCubicacionMultiProducto | null = null;

      if (viable) {
        packing = cubicacionMultiProductoEnBultos(
          itemsValidos.map((x) => ({
            itemKey: x.itemKey,
            productoId: x.productoId,
            codigoProducto: x.codigoProducto,
            descripcionProducto: x.descripcionProducto,
            cantidadUnidades: x.cantidadUnidades,
            volumenUnidadM3: x.volumenUnidadM3,
          })),
          { capacidadInternaM3: cap }
        );
      }

      // Score (ranking):
      // 1) Menos bultos
      // 2) Mayor ocupación global
      // 3) Preferido primero
      const bultosCount = packing?.bultos.length ?? 999999;
      const ocup = packing?.ocupacionGlobalPct ?? 0;

      const score =
        bultosCount * 1000000 - // menor es mejor
        ocup * 1000 - // mayor ocupación, mejor
        (b.es_preferido ? 100 : 0);

      return {
        bulto: b,
        dimInternaMm: di,
        capacidadInternaM3: cap,
        viable,
        motivosNoViable: motivos,
        packing,
        score,
      };
    });

  return evaluaciones
    .filter((e) => e.viable && e.packing)
    .sort((a, b) => a.score - b.score)
    .slice(0, topN);
}
