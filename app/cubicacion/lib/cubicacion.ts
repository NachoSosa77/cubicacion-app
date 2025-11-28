// app/cubicacion/lib/cubicacion.ts

import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";

export interface ResultadoCubicacion {
  cajasPorCapa: number;
  capas: number;
  cajasTotales: number;
  productosPorCaja: number;
  productosTotales: number;
  volumenBultoM3: number;
  volumenContenedorM3: number;
  ocupacionVolumenPorcentaje: number;
}

export function calcularCubicacionBultosEnPallet(params: {
  producto: ITipoProducto;
  contenedor: ITipoContenedor;
  alturaMaxCargaM?: number;
}): ResultadoCubicacion {
  const { producto, contenedor, alturaMaxCargaM } = params;

  // 1) Normalizar medidas del bulto: mm -> m (con Number(...) por si viniera como string)
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

  // 3) Cajas por capa
  const cajasPorLargo = Math.floor(largoContM / largoBultoM);
  const cajasPorAncho = Math.floor(anchoContM / anchoBultoM);
  const cajasPorCapa = cajasPorLargo * cajasPorAncho;

  if (cajasPorCapa <= 0) {
    return {
      cajasPorCapa: 0,
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
    capas,
    cajasTotales,
    productosPorCaja,
    productosTotales,
    volumenBultoM3,
    volumenContenedorM3,
    ocupacionVolumenPorcentaje,
  };
}
