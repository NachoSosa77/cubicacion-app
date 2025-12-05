// app/cubicacion/lib/cubicacion.ts

import { ITipoProducto } from "../actions/productoActions";

// Dimensiones en milímetros
export type DimMm = {
  largo: number; // mm
  ancho: number; // mm
  alto: number; // mm
};

// Conversión simple milímetros → metros
export const mmToM = (mm: number): number => mm / 1000;

export interface ResultadoCubicacion {
  cajasPorLargo: number;
  cajasPorAncho: number;
  cajasPorCapa: number;
  capas: number;
  cajasTotales: number;
  productosPorCaja: number;
  productosTotales: number;
  volumenBultoM3: number;
  volumenContenedorM3: number;
  ocupacionVolumenPorcentaje: number;

  // Peso
  pesoPorBultoKg: number | null;
  pesoMaximoPalletKg: number | null;
  pesoTotalPalletKg: number | null;
  usoPesoPorcentaje: number | null;
  excedePesoMaximo: boolean;

  // 🔽 NUEVO: cómo quedó orientado el bulto sobre el pallet (en metros)
  bultoLargoEnPalletM: number;
  bultoAnchoEnPalletM: number;
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

export interface ResultadoPalletsEnCajon {
  palletsPorLargo: number;
  palletsPorAncho: number;
  palletsPorCapa: number;
  capas: number;
  palletsTotales: number;
  volumenPalletM3: number;
  volumenCajonM3: number;
  ocupacionVolumenPorcentaje: number;
}

export interface ResultadoPalletsEnTransporte {
  palletsPorLargo: number;
  palletsPorAncho: number;
  palletsPorCapa: number; // por ahora 1 capa (no apilamos pallets)
  capas: number; // igual a palletsPorCapas “verticales”
  palletsTotales: number;

  productosPorPallet: number;
  productosTotales: number;

  volumenPalletM3: number; // solo productos del pallet
  volumenTransporteM3: number;
  ocupacionVolumenPorcentaje: number;

  pesoPorPalletKg: number | null;
  pesoMaximoTransporteKg: number | null;
  pesoTotalTransporteKg: number | null;
  usoPesoPorcentaje: number | null;
  excedePesoMaximo: boolean;
}

export interface PalletPosition3D {
  x: number;
  y: number;
  z: number;
}

export function generarPosicionesPalletsEnCamion(params: {
  palletsPorLargo: number;
  palletsPorAncho: number;
  palletLargoM: number;
  palletAnchoM: number;
  alturaPalletM: number;
  palletsTotales: number;
}): PalletPosition3D[] {
  const {
    palletsPorLargo,
    palletsPorAncho,
    palletLargoM,
    palletAnchoM,
    alturaPalletM,
    palletsTotales,
  } = params;

  const posiciones: PalletPosition3D[] = [];

  let count = 0;

  for (let ix = 0; ix < palletsPorLargo; ix++) {
    for (let iz = 0; iz < palletsPorAncho; iz++) {
      if (count >= palletsTotales) break;

      const x =
        -((palletsPorLargo * palletLargoM) / 2) +
        palletLargoM / 2 +
        ix * palletLargoM;

      const z =
        -((palletsPorAncho * palletAnchoM) / 2) +
        palletAnchoM / 2 +
        iz * palletAnchoM;

      posiciones.push({
        x,
        y: alturaPalletM / 2,
        z,
      });

      count++;
    }
  }

  return posiciones;
}

/**
 * Calcula cómo se acomodan las unidades dentro del bulto (caja) para un solo código de producto.
 * - Usa dimensiones EXTERNAS del bulto del producto (mm) + grosor de pared para obtener las internas.
 * - Usa dimUnidadMm (unidad en mm) para probar todas las orientaciones y elegir la mejor.
 */

function getPesoBultoKg(producto: any): number | null {
  // Ajustá aquí si tu campo se llama distinto
  const raw =
    producto.peso_bulto_kg ??
    producto.peso_por_bulto_kg ??
    producto.peso_caja_kg ??
    producto.peso_por_caja ??
    null;

  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw)) return null;
  return raw;
}

function getPesoMaximoPalletKg(contenedor: any): number | null {
  const raw = contenedor.peso_max_kg ?? null;

  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

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
  producto: any;
  contenedor: any;
  alturaMaxCargaM?: number;
}): ResultadoCubicacion {
  const { producto, contenedor, alturaMaxCargaM } = params;

  // 1) Dimensiones del bulto mm -> m
  const largoBultoM_raw = Number(producto.largo_por_bulto) / 1000;
  const anchoBultoM_raw = Number(producto.ancho_por_bulto) / 1000;
  const altoBultoM = Number(producto.alto_por_bulto) / 1000;

  if (
    !Number.isFinite(largoBultoM_raw) ||
    !Number.isFinite(anchoBultoM_raw) ||
    !Number.isFinite(altoBultoM) ||
    largoBultoM_raw <= 0 ||
    anchoBultoM_raw <= 0 ||
    altoBultoM <= 0
  ) {
    throw new Error(
      `Dimensiones de bulto inválidas. largo=${producto.largo_por_bulto}, ancho=${producto.ancho_por_bulto}, alto=${producto.alto_por_bulto}`
    );
  }

  // 2) Contenedor (ya en metros)
  const largoContM = Number(contenedor.largo_mts);
  const anchoContM = Number(contenedor.ancho_mts);
  const altoContM = Number(contenedor.alto_mts);

  const volumenContenedorM3 = largoContM * anchoContM * altoContM;

  // 3) Altura máxima usable
  const alturaLimite =
    alturaMaxCargaM != null && !Number.isNaN(alturaMaxCargaM)
      ? Math.min(alturaMaxCargaM, altoContM)
      : altoContM;

  // 4) Probamos las 2 orientaciones posibles sobre la base del pallet
  type Ori = {
    bultoLargoM: number;
    bultoAnchoM: number;
    cajasPorLargo: number;
    cajasPorAncho: number;
    cajasPorCapa: number;
    capas: number;
    cajasTotales: number;
  };

  const candidatos: Ori[] = [];

  const probarOrientacion = (bultoLargoM: number, bultoAnchoM: number) => {
    const cajasPorLargo = Math.floor(largoContM / bultoLargoM);
    const cajasPorAncho = Math.floor(anchoContM / bultoAnchoM);
    const cajasPorCapa = cajasPorLargo * cajasPorAncho;

    if (cajasPorCapa <= 0) return;

    const capas = Math.floor(alturaLimite / altoBultoM);
    const cajasTotales = cajasPorCapa * capas;

    candidatos.push({
      bultoLargoM,
      bultoAnchoM,
      cajasPorLargo,
      cajasPorAncho,
      cajasPorCapa,
      capas,
      cajasTotales,
    });
  };

  // A) Sin girar
  probarOrientacion(largoBultoM_raw, anchoBultoM_raw);
  // B) Girado 90°
  probarOrientacion(anchoBultoM_raw, largoBultoM_raw);

  if (candidatos.length === 0) {
    const volumenBultoM3 = largoBultoM_raw * anchoBultoM_raw * altoBultoM;

    return {
      cajasPorLargo: 0,
      cajasPorAncho: 0,
      cajasPorCapa: 0,
      capas: 0,
      cajasTotales: 0,
      productosPorCaja: producto.unidades_por_unidad_entrega ?? 0,
      productosTotales: 0,
      volumenBultoM3,
      volumenContenedorM3,
      ocupacionVolumenPorcentaje: 0,
      pesoPorBultoKg: getPesoBultoKg(producto),
      pesoMaximoPalletKg: getPesoMaximoPalletKg(contenedor),
      pesoTotalPalletKg: null,
      usoPesoPorcentaje: null,
      excedePesoMaximo: false,
      bultoLargoEnPalletM: largoBultoM_raw,
      bultoAnchoEnPalletM: anchoBultoM_raw,
    };
  }

  // Elegimos el candidato con más cajasTotales (si empatan, el primero)
  const mejor = candidatos.reduce((a, b) =>
    b.cajasTotales > a.cajasTotales ? b : a
  );

  const volumenBultoM3 = mejor.bultoLargoM * mejor.bultoAnchoM * altoBultoM;

  const productosPorCaja = producto.unidades_por_unidad_entrega ?? 1;
  const productosTotales = mejor.cajasTotales * productosPorCaja;

  const volumenOcupado = volumenBultoM3 * mejor.cajasTotales;
  const ocupacionVolumenPorcentaje =
    volumenContenedorM3 > 0 ? (volumenOcupado / volumenContenedorM3) * 100 : 0;

  // Peso
  const pesoPorBultoKg = getPesoBultoKg(producto);
  const pesoMaximoPalletKg = getPesoMaximoPalletKg(contenedor);

  let pesoTotalPalletKg: number | null = null;
  let usoPesoPorcentaje: number | null = null;
  let excedePesoMaximo = false;

  if (pesoPorBultoKg !== null) {
    pesoTotalPalletKg = mejor.cajasTotales * pesoPorBultoKg;

    if (pesoMaximoPalletKg !== null && pesoMaximoPalletKg > 0) {
      usoPesoPorcentaje = (pesoTotalPalletKg / pesoMaximoPalletKg) * 100;
      excedePesoMaximo = pesoTotalPalletKg > pesoMaximoPalletKg + 1e-6;
    }
  }

  return {
    cajasPorLargo: mejor.cajasPorLargo,
    cajasPorAncho: mejor.cajasPorAncho,
    cajasPorCapa: mejor.cajasPorCapa,
    capas: mejor.capas,
    cajasTotales: mejor.cajasTotales,
    productosPorCaja,
    productosTotales,
    volumenBultoM3,
    volumenContenedorM3,
    ocupacionVolumenPorcentaje,
    pesoPorBultoKg,
    pesoMaximoPalletKg,
    pesoTotalPalletKg,
    usoPesoPorcentaje,
    excedePesoMaximo,
    bultoLargoEnPalletM: mejor.bultoLargoM,
    bultoAnchoEnPalletM: mejor.bultoAnchoM,
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

export function calcularPalletsEnCajon(params: {
  // Pallet físico que queremos meter en el camión
  pallet: {
    largo_mts: number;
    ancho_mts: number;
    alto_mts: number;
  };
  // Cajón del camión / caja / contenedor del vehículo
  cajon: {
    largo_mts: number;
    ancho_mts: number;
    alto_mts: number;
  };
  // Altura máxima de carga dentro del camión (opcional)
  alturaMaxCargaM?: number;
  // Por defecto, asumimos que no apilamos pallets uno encima de otro
  maxCapas?: number; // default: 1
}): ResultadoPalletsEnCajon {
  const { pallet, cajon, alturaMaxCargaM, maxCapas = 1 } = params;

  const palletL = Number(pallet.largo_mts);
  const palletA = Number(pallet.ancho_mts);
  const palletH = Number(pallet.alto_mts);

  const cajonL = Number(cajon.largo_mts);
  const cajonA = Number(cajon.ancho_mts);
  const cajonH = Number(cajon.alto_mts);

  if (
    !Number.isFinite(palletL) ||
    !Number.isFinite(palletA) ||
    !Number.isFinite(palletH) ||
    palletL <= 0 ||
    palletA <= 0 ||
    palletH <= 0
  ) {
    throw new Error(
      `Dimensiones de pallet inválidas. largo=${pallet.largo_mts}, ancho=${pallet.ancho_mts}, alto=${pallet.alto_mts}`
    );
  }

  if (
    !Number.isFinite(cajonL) ||
    !Number.isFinite(cajonA) ||
    !Number.isFinite(cajonH) ||
    cajonL <= 0 ||
    cajonA <= 0 ||
    cajonH <= 0
  ) {
    throw new Error(
      `Dimensiones de cajón inválidas. largo=${cajon.largo_mts}, ancho=${cajon.ancho_mts}, alto=${cajon.alto_mts}`
    );
  }

  const volumenPalletM3 = palletL * palletA * palletH;
  const volumenCajonM3 = cajonL * cajonA * cajonH;

  // 🔁 Solo rotamos el pallet en planta (no lo ponemos de costado)
  const orientaciones = [
    { largo: palletL, ancho: palletA },
    { largo: palletA, ancho: palletL },
  ];

  let mejorOrientacion: {
    palletsPorLargo: number;
    palletsPorAncho: number;
  } | null = null;
  let maxPorCapa = 0;

  for (const o of orientaciones) {
    const palletsPorLargo = Math.floor(cajonL / o.largo);
    const palletsPorAncho = Math.floor(cajonA / o.ancho);
    const porCapa = palletsPorLargo * palletsPorAncho;

    if (porCapa > maxPorCapa) {
      maxPorCapa = porCapa;
      mejorOrientacion = { palletsPorLargo, palletsPorAncho };
    }
  }

  if (!mejorOrientacion || maxPorCapa <= 0) {
    // No entra ni un pallet completo
    return {
      palletsPorLargo: 0,
      palletsPorAncho: 0,
      palletsPorCapa: 0,
      capas: 0,
      palletsTotales: 0,
      volumenPalletM3,
      volumenCajonM3,
      ocupacionVolumenPorcentaje: 0,
    };
  }

  const palletsPorLargo = mejorOrientacion.palletsPorLargo;
  const palletsPorAncho = mejorOrientacion.palletsPorAncho;
  const palletsPorCapa = palletsPorLargo * palletsPorAncho;

  // Altura disponible dentro del camión
  const alturaLimite =
    alturaMaxCargaM != null && !Number.isNaN(alturaMaxCargaM)
      ? Math.min(alturaMaxCargaM, cajonH)
      : cajonH;

  // Capas que entran en altura
  let capas = Math.floor(alturaLimite / palletH);
  if (capas > maxCapas) {
    capas = maxCapas;
  }

  if (capas <= 0) {
    return {
      palletsPorLargo,
      palletsPorAncho,
      palletsPorCapa,
      capas: 0,
      palletsTotales: 0,
      volumenPalletM3,
      volumenCajonM3,
      ocupacionVolumenPorcentaje: 0,
    };
  }

  const palletsTotales = palletsPorCapa * capas;

  // Volumen ocupado por los pallets
  const volumenOcupado = volumenPalletM3 * palletsTotales;
  const ocupacionVolumenPorcentaje =
    volumenCajonM3 > 0 ? (volumenOcupado / volumenCajonM3) * 100 : 0;

  return {
    palletsPorLargo,
    palletsPorAncho,
    palletsPorCapa,
    capas,
    palletsTotales,
    volumenPalletM3,
    volumenCajonM3,
    ocupacionVolumenPorcentaje,
  };
}

// Calcula cuántos pallets entran en el “cajón” del camión
export function calcularPalletsEnTransporte(params: {
  contenedor: any; // pallet (TipoContenedor)
  resultadoPallet: ResultadoCubicacion; // resultado bultos ↔ pallet
  transporte: any; // TransporteClasificacion o ITransporteClasificacion
}): ResultadoPalletsEnTransporte {
  const { contenedor, resultadoPallet, transporte } = params;

  // 1) Dimensiones del pallet (base) en metros
  const largoPalletM = Number(contenedor.largo_mts);
  const anchoPalletM = Number(contenedor.ancho_mts);

  if (
    !Number.isFinite(largoPalletM) ||
    !Number.isFinite(anchoPalletM) ||
    largoPalletM <= 0 ||
    anchoPalletM <= 0
  ) {
    throw new Error(
      `Dimensiones de pallet inválidas. largo_mts=${contenedor.largo_mts}, ancho_mts=${contenedor.ancho_mts}`
    );
  }

  // 2) Dimensiones internas del cajón del camión (en metros, ya vienen así)
  const largoTransM = Number(transporte.mt_largo_cub);
  const anchoTransM = Number(transporte.mt_ancho_cub);
  const altoTransM = Number(transporte.mt_alto_cub);

  if (
    !Number.isFinite(largoTransM) ||
    !Number.isFinite(anchoTransM) ||
    !Number.isFinite(altoTransM) ||
    largoTransM <= 0 ||
    anchoTransM <= 0 ||
    altoTransM <= 0
  ) {
    throw new Error(
      `Dimensiones de transporte inválidas. largo=${transporte.mt_largo_cub}, ancho=${transporte.mt_ancho_cub}, alto=${transporte.mt_alto_cub}`
    );
  }

  // 3) Pallets por capa (solo en superficie, no apilamos pallets por ahora)
  const palletsPorLargo = Math.floor(largoTransM / largoPalletM);
  const palletsPorAncho = Math.floor(anchoTransM / anchoPalletM);
  const palletsPorCapa = palletsPorLargo * palletsPorAncho;

  if (palletsPorCapa <= 0) {
    return {
      palletsPorLargo,
      palletsPorAncho,
      palletsPorCapa: 0,
      capas: 0,
      palletsTotales: 0,
      productosPorPallet: resultadoPallet.productosTotales ?? 0,
      productosTotales: 0,
      volumenPalletM3:
        resultadoPallet.volumenBultoM3 * resultadoPallet.cajasTotales,
      volumenTransporteM3: largoTransM * anchoTransM * altoTransM,
      ocupacionVolumenPorcentaje: 0,
      pesoPorPalletKg: resultadoPallet.pesoTotalPalletKg ?? null,
      pesoMaximoTransporteKg:
        typeof transporte.max_peso_kg === "number"
          ? transporte.max_peso_kg
          : null,
      pesoTotalTransporteKg: null,
      usoPesoPorcentaje: null,
      excedePesoMaximo: false,
    };
  }

  // Por ahora: NO apilamos pallets en altura → 1 capa
  const capas = 1;
  const palletsTotales = palletsPorCapa * capas;

  // 4) Productos
  const productosPorPallet = resultadoPallet.productosTotales ?? 0;
  const productosTotales = productosPorPallet * palletsTotales;

  // 5) Volúmenes
  const volumenPalletM3 =
    resultadoPallet.volumenBultoM3 * resultadoPallet.cajasTotales;
  const volumenTransporteM3 = largoTransM * anchoTransM * altoTransM;
  const volumenOcupado = volumenPalletM3 * palletsTotales;

  const ocupacionVolumenPorcentaje =
    volumenTransporteM3 > 0 ? (volumenOcupado / volumenTransporteM3) * 100 : 0;

  // 6) Peso total vs peso máximo permitdo del camión
  const pesoPorPalletKg = resultadoPallet.pesoTotalPalletKg ?? null;
  const pesoMaximoTransporteKg =
    typeof transporte.max_peso_kg === "number" ? transporte.max_peso_kg : null;

  let pesoTotalTransporteKg: number | null = null;
  let usoPesoPorcentaje: number | null = null;
  let excedePesoMaximo = false;

  if (pesoPorPalletKg !== null) {
    pesoTotalTransporteKg = palletsTotales * pesoPorPalletKg;
    if (pesoMaximoTransporteKg !== null && pesoMaximoTransporteKg > 0) {
      usoPesoPorcentaje =
        (pesoTotalTransporteKg / pesoMaximoTransporteKg) * 100;
      excedePesoMaximo = pesoTotalTransporteKg > pesoMaximoTransporteKg + 1e-6;
    }
  }

  return {
    palletsPorLargo,
    palletsPorAncho,
    palletsPorCapa,
    capas,
    palletsTotales,
    productosPorPallet,
    productosTotales,
    volumenPalletM3,
    volumenTransporteM3,
    ocupacionVolumenPorcentaje,
    pesoPorPalletKg,
    pesoMaximoTransporteKg,
    pesoTotalTransporteKg,
    usoPesoPorcentaje,
    excedePesoMaximo,
  };
}
