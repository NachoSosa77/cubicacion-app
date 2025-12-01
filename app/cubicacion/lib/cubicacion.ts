// app/cubicacion/lib/cubicacion.ts

import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";

// Dimensiones en milímetros
export type DimMm = {
  largo: number; // mm
  ancho: number; // mm
  alto: number; // mm
};

// Conversión simple milímetros → metros
export const mmToM = (mm: number): number => mm / 1000;

export interface ResultadoCubicacion {
  cajasPorCapa: number;
  cajasPorLargo: number;
  cajasPorAncho: number;
  capas: number;
  cajasTotales: number;
  productosPorCaja: number;
  productosTotales: number;
  volumenBultoM3: number;
  volumenContenedorM3: number;
  ocupacionVolumenPorcentaje: number;
}

export interface ResultadoCubicacionBulto {
  orientacion: DimMm; // cómo quedó orientado el producto dentro del bulto
  unidadesPorEje: {
    x: number; // cuántos entran a lo largo
    y: number; // cuántos entran a lo ancho
    z: number; // cuántos entran en altura
  };
  unidadesTotales: number;
}

export interface ResultadoUnidadEnBulto extends ResultadoCubicacionBulto {
  // Dimensiones internas efectivas del bulto (mm)
  dimInternaBulto: DimMm;
  // Porcentaje de ocupación del volumen interno (0–100)
  ocupacionVolumenInterno: number;
}

interface ParametrosUnidadEnBulto {
  producto: ITipoProducto;
  dimUnidadMm: DimMm;
  grosorParedMm?: number; // por ahora opcional
}

/**
 * Calcula cómo se acomodan las unidades dentro del bulto (caja) para un solo código de producto.
 * - Usa dimensiones EXTERNAS del bulto del producto (mm) + grosor de pared para obtener las internas.
 * - Usa dimUnidadMm (unidad en mm) para probar todas las orientaciones y elegir la mejor.
 */
export function calcularUnidadEnBulto(
  params: ParametrosUnidadEnBulto
): ResultadoUnidadEnBulto | null {
  const { producto, dimUnidadMm, grosorParedMm = 0 } = params;

  // 1) Dimensiones internas del bulto (mm) a partir de las externas del producto
  const g = Math.max(grosorParedMm, 0);

  const ajustarInterna = (externa: number) => Math.max(externa - 2 * g, 0); // never negative

  const dimInternaBultoMm: DimMm = {
    largo: ajustarInterna(producto.largo_por_bulto),
    ancho: ajustarInterna(producto.ancho_por_bulto),
    alto: ajustarInterna(producto.alto_por_bulto),
  };

  // 2) Calcular la mejor cubicación geométrica
  const base = calcularMejorCubicacionEnBulto(dimInternaBultoMm, dimUnidadMm);

  if (!base) {
    // No entra ni una unidad en ninguna orientación
    return null;
  }

  // 3) Calcular volumen interno y volumen ocupado por productos (en mm³)
  const volumenInternoMm3 =
    dimInternaBultoMm.largo * dimInternaBultoMm.ancho * dimInternaBultoMm.alto;

  const volumenUnidadMm3 =
    dimUnidadMm.largo * dimUnidadMm.ancho * dimUnidadMm.alto;

  const volumenProductosMm3 = volumenUnidadMm3 * base.unidadesTotales;

  const ocupacionVolumenInterno =
    volumenInternoMm3 > 0 ? (volumenProductosMm3 / volumenInternoMm3) * 100 : 0;

  return {
    ...base,
    dimInternaBulto: dimInternaBultoMm,
    ocupacionVolumenInterno,
  };
}

export function calcularCubicacionBultosEnPallet(params: {
  producto: ITipoProducto;
  contenedor: ITipoContenedor;
  alturaMaxCargaM?: number;
}): ResultadoCubicacion {
  const { producto, contenedor, alturaMaxCargaM } = params;

  // 1) Normalizar medidas del bulto: mm -> m
  const largoBultoM = Number(producto.largo_por_bulto) / 1000;
  const anchoBultoM = Number(producto.ancho_por_bulto) / 1000;
  const altoBultoM = Number(producto.alto_por_bulto) / 1000;

  if (
    !Number.isFinite(largoBultoM) ||
    !Number.isFinite(anchoBultoM) ||
    !Number.isFinite(altoBultoM) ||
    largoBultoM <= 0 ||
    anchoBultoM <= 0 ||
    altoBultoM <= 0
  ) {
    throw new Error(
      `Dimensiones de bulto inválidas. largo=${producto.largo_por_bulto}, ancho=${producto.ancho_por_bulto}, alto=${producto.alto_por_bulto}`
    );
  }

  // 2) Medidas del contenedor/pallet (ya en metros)
  const largoContM = contenedor.largo_mts;
  const anchoContM = contenedor.ancho_mts;
  const altoContM = contenedor.alto_mts;

  // 3) Cajas por capa (detalle por eje)
  const cajasPorLargo = Math.floor(largoContM / largoBultoM);
  const cajasPorAncho = Math.floor(anchoContM / anchoBultoM);
  const cajasPorCapa = cajasPorLargo * cajasPorAncho;

  if (cajasPorCapa <= 0) {
    return {
      cajasPorCapa,
      cajasPorLargo,
      cajasPorAncho,
      capas: 0,
      cajasTotales: 0,
      productosPorCaja: producto.unidades_por_unidad_entrega,
      productosTotales: 0,
      volumenBultoM3: largoBultoM * anchoBultoM * altoBultoM,
      volumenContenedorM3: largoContM * anchoContM * altoContM,
      ocupacionVolumenPorcentaje: 0,
    };
  }

  // 4) Capas en altura
  const alturaLimite = alturaMaxCargaM
    ? Math.min(alturaMaxCargaM, altoContM)
    : altoContM;

  const capas = Math.floor(alturaLimite / altoBultoM);

  const cajasTotales = cajasPorCapa * capas;
  const productosPorCaja = producto.unidades_por_unidad_entrega;
  const productosTotales = cajasTotales * productosPorCaja;

  // 5) Volúmenes y ocupación
  const volumenBultoM3 = largoBultoM * anchoBultoM * altoBultoM;
  const volumenContenedorM3 = largoContM * anchoContM * altoContM;
  const volumenOcupado = volumenBultoM3 * cajasTotales;
  const ocupacionVolumenPorcentaje =
    volumenContenedorM3 > 0 ? (volumenOcupado / volumenContenedorM3) * 100 : 0;

  return {
    cajasPorCapa,
    cajasPorLargo,
    cajasPorAncho,
    capas,
    cajasTotales,
    productosPorCaja,
    productosTotales,
    volumenBultoM3,
    volumenContenedorM3,
    ocupacionVolumenPorcentaje,
  };
}

export function generarOrientacionesProducto(producto: DimMm): DimMm[] {
  const { largo, ancho, alto } = producto;

  // Las 6 permutaciones posibles de (largo, ancho, alto)
  return [
    { largo, ancho, alto }, // L, A, H
    { largo, ancho: alto, alto: ancho }, // L, H, A
    { largo: ancho, ancho: largo, alto }, // A, L, H
    { largo: ancho, ancho: alto, alto: largo }, // A, H, L
    { largo: alto, ancho: largo, alto: ancho }, // H, L, A
    { largo: alto, ancho, alto: largo }, // H, A, L
  ];
}

export function calcularMejorCubicacionEnBulto(
  dimInternaBultoMm: DimMm,
  dimUnidadMm: DimMm
): ResultadoCubicacionBulto | null {
  const orientaciones = generarOrientacionesProducto(dimUnidadMm);

  let mejor: ResultadoCubicacionBulto | null = null;

  for (const o of orientaciones) {
    if (o.largo <= 0 || o.ancho <= 0 || o.alto <= 0) continue;

    const nx = Math.floor(dimInternaBultoMm.largo / o.largo);
    const ny = Math.floor(dimInternaBultoMm.ancho / o.ancho);
    const nz = Math.floor(dimInternaBultoMm.alto / o.alto);

    if (nx <= 0 || ny <= 0 || nz <= 0) {
      // En esta orientación no entra ni una unidad completa
      continue;
    }

    const total = nx * ny * nz;

    if (!mejor || total > mejor.unidadesTotales) {
      mejor = {
        orientacion: o,
        unidadesPorEje: { x: nx, y: ny, z: nz },
        unidadesTotales: total,
      };
    }
  }

  return mejor;
}

export function getDimInternaBultoMm(
  producto: Pick<
    ITipoProducto,
    "largo_por_bulto" | "ancho_por_bulto" | "alto_por_bulto"
  >,
  grosorParedMm: number = 0 // por ahora opcional, default 0 si no lo tenemos
): DimMm {
  const g = Math.max(grosorParedMm, 0); // nunca negativo

  const interna = (externa: number) => Math.max(externa - 2 * g, 0); // evitamos valores negativos

  return {
    largo: interna(producto.largo_por_bulto),
    ancho: interna(producto.ancho_por_bulto),
    alto: interna(producto.alto_por_bulto),
  };
}
