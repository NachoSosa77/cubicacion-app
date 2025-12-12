// lib/cubicacion-multiproducto.ts

export interface MultiProductoUnidadInput {
  itemKey: string; // key de tu fila en la UI
  productoId: number;
  codigoProducto?: string;
  descripcionProducto?: string;
  cantidadUnidades: number;
  volumenUnidadM3: number;
}

export interface BultoConfig {
  // Dimensiones INTERNA del bulto ya descontando pared
  capacidadInternaM3: number;
}

export interface ContenidoBulto {
  itemKey: string;
  productoId: number;
  codigoProducto?: string;
  descripcionProducto?: string;
  unidades: number;
  volumenOcupadoM3: number;
}

export interface BultoResultado {
  indice: number; // N° de bulto (1, 2, 3, ...)
  capacidadInternaM3: number;
  volumenOcupadoM3: number;
  volumenLibreM3: number;
  ocupacionPct: number;
  contenido: ContenidoBulto[];
}

export interface ResultadoCubicacionMultiProducto {
  bultos: BultoResultado[];
  totalVolumenOcupadoM3: number;
  totalCapacidadM3: number;
  ocupacionGlobalPct: number;
}

/**
 * Algoritmo greedy de bin-packing 1D por volumen.
 * NO garantiza packing geométrico perfecto, pero es una muy buena aproximación.
 */
export function cubicacionMultiProductoEnBultos(
  items: MultiProductoUnidadInput[],
  bulto: BultoConfig
): ResultadoCubicacionMultiProducto {
  if (bulto.capacidadInternaM3 <= 0) {
    throw new Error("La capacidad interna del bulto debe ser mayor a cero.");
  }

  // Clonamos items para ir consumiendo cantidades
  const pendientes = items
    .filter((i) => i.cantidadUnidades > 0 && i.volumenUnidadM3 > 0)
    // Ordenamos de mayor a menor volumen (heurística típica de bin-packing)
    .sort((a, b) => b.volumenUnidadM3 - a.volumenUnidadM3)
    .map((i) => ({ ...i }));

  const bultos: BultoResultado[] = [];

  const crearNuevoBulto = (): BultoResultado => {
    return {
      indice: bultos.length + 1,
      capacidadInternaM3: bulto.capacidadInternaM3,
      volumenOcupadoM3: 0,
      volumenLibreM3: bulto.capacidadInternaM3,
      ocupacionPct: 0,
      contenido: [],
    };
  };

  // Mientras haya unidades pendientes de colocar
  while (pendientes.some((p) => p.cantidadUnidades > 0)) {
    // Creamos un nuevo bulto
    const nuevoBulto = crearNuevoBulto();

    // Recorremos items en orden (ya están ordenados por volumen unidad)
    for (const p of pendientes) {
      if (p.cantidadUnidades <= 0) continue;

      const vUnidad = p.volumenUnidadM3;

      if (vUnidad <= 0 || vUnidad > nuevoBulto.volumenLibreM3) {
        // No entra ni una unidad más de este producto en este bulto
        continue;
      }

      // Cantidad máxima de unidades de este producto que caben por volumen
      const maxUnidadesPorVolumen = Math.floor(
        nuevoBulto.volumenLibreM3 / vUnidad
      );

      if (maxUnidadesPorVolumen <= 0) continue;

      const unidadesAColocar = Math.min(
        p.cantidadUnidades,
        maxUnidadesPorVolumen
      );

      const volumenOcupado = unidadesAColocar * vUnidad;

      // Actualizamos bulto
      nuevoBulto.volumenOcupadoM3 += volumenOcupado;
      nuevoBulto.volumenLibreM3 -= volumenOcupado;

      // Agregamos o acumulamos en el contenido del bulto
      const existenteIdx = nuevoBulto.contenido.findIndex(
        (c) => c.itemKey === p.itemKey
      );

      if (existenteIdx >= 0) {
        const existente = nuevoBulto.contenido[existenteIdx];
        existente.unidades += unidadesAColocar;
        existente.volumenOcupadoM3 += volumenOcupado;
      } else {
        nuevoBulto.contenido.push({
          itemKey: p.itemKey,
          productoId: p.productoId,
          codigoProducto: p.codigoProducto,
          descripcionProducto: p.descripcionProducto,
          unidades: unidadesAColocar,
          volumenOcupadoM3: volumenOcupado,
        });
      }

      // Descontamos pendientes
      p.cantidadUnidades -= unidadesAColocar;

      // Si ya no queda volumen para nada más, cortamos
      if (nuevoBulto.volumenLibreM3 <= 0) break;
    }

    // Cerramos el bulto (aunque esté poco ocupado: es lo mejor que logramos)
    nuevoBulto.ocupacionPct =
      (nuevoBulto.volumenOcupadoM3 / nuevoBulto.capacidadInternaM3) * 100;
    bultos.push(nuevoBulto);
  }

  const totalCapacidadM3 = bultos.length * bulto.capacidadInternaM3;

  const totalVolumenOcupadoM3 = bultos.reduce(
    (acc, b) => acc + b.volumenOcupadoM3,
    0
  );

  const ocupacionGlobalPct =
    totalCapacidadM3 > 0 ? (totalVolumenOcupadoM3 / totalCapacidadM3) * 100 : 0;

  return {
    bultos,
    totalVolumenOcupadoM3,
    totalCapacidadM3,
    ocupacionGlobalPct,
  };
}
