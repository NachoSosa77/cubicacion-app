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

/** ====== NUEVO: layout para preview fiel ====== */
export type PlacementMm = {
  productoId: number;
  codigo: string;
  dimUnidadMm: DimMm; // orientación elegida
  posCentroMm: { x: number; y: number; z: number }; // centro en mm, relativo al centro del bulto interno
  color?: string;
};

export type InstruccionArmado = {
  productoId: number;
  codigo: string;
  orientacionMm: DimMm; // rotación elegida para packing
  unidadesEnBulto1: number; // cuántas quedaron colocadas (este preview)
  capacidadTeoricaSiSolo: number; // “si el bulto fuese solo de este producto”
};

export type Packing3D = {
  dimInternaMm: DimMm;
  unidadesTotales: number;
  unidadesEnBulto1: number;
  bultosNecesariosEstimados: number;
  ocupacionVolumetricaPct: number; // volumen usado / volumen interno
  instrucciones: InstruccionArmado[];
  placementsBulto1: PlacementMm[];
};

export type EvaluacionBultoEmpresa = {
  bulto: IEmpresaBulto;
  dimInternaMm: DimMm;
  capacidadInternaM3: number;

  viable: boolean;
  motivosNoViable: string[];

  // packing volumétrico (lo podés mantener para análisis histórico/ranking alternativo)
  packing: ResultadoCubicacionMultiProducto | null;

  // NUEVO: packing geométrico para preview + “wow”
  packing3D: Packing3D | null;

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

function entraEnBulto(dimUnidad: DimMm, dimBultoInterna: DimMm): boolean {
  return orientaciones(dimUnidad).some((o) => {
    return (
      o.largo <= dimBultoInterna.largo &&
      o.ancho <= dimBultoInterna.ancho &&
      o.alto <= dimBultoInterna.alto
    );
  });
}

/** ====== NUEVO: calcula capacidad teórica (solo ese producto) para una orientación ====== */
function capacidadGrid(orient: DimMm, di: DimMm): number {
  const nx = Math.floor(di.largo / orient.largo);
  const nz = Math.floor(di.ancho / orient.ancho);
  const ny = Math.floor(di.alto / orient.alto);
  if (nx <= 0 || nz <= 0 || ny <= 0) return 0;
  return nx * nz * ny;
}

/** ====== NUEVO: elige la mejor orientación (máxima capacidad teórica) ====== */
function mejorOrientacion(dimUnidad: DimMm, di: DimMm): DimMm | null {
  let best: DimMm | null = null;
  let bestCap = 0;

  for (const o of orientaciones(dimUnidad)) {
    if (o.largo <= di.largo && o.ancho <= di.ancho && o.alto <= di.alto) {
      const cap = capacidadGrid(o, di);
      if (cap > bestCap) {
        bestCap = cap;
        best = o;
      }
    }
  }
  return best;
}

/**
 * ====== NUEVO: packing geométrico del PRIMER BULTO (heurístico coherente)
 * - Ordena ítems por volumen (desc) para mejor estabilidad visual
 * - Elige orientación “mejor” por producto
 * - Coloca secuencialmente X→Z→Y dentro del bulto interno
 * - Corta cuando no hay más espacio (nunca dibuja fuera)
 */
function packingPrimerBulto3D(
  items: MultiProductoUnidadInputReal[],
  di: DimMm
): Packing3D {
  const unidadesTotales = items.reduce(
    (acc, it) => acc + it.cantidadUnidades,
    0
  );
  const capM3 = volumenM3(di);

  // Orden por volumen (desc) ayuda a “wow” y evita piezas grandes quedando imposibles al final
  const ordered = [...items].sort(
    (a, b) => b.volumenUnidadM3 - a.volumenUnidadM3
  );

  const placements: PlacementMm[] = [];
  const instrucciones: InstruccionArmado[] = [];

  // Cursor global en mm (centros)
  let cursorX = 0;
  let cursorY = 0;
  let cursorZ = 0;
  let initialized = false;

  let unidadesEnBulto1 = 0;
  let volumenUsadoM3 = 0;

  for (const it of ordered) {
    const orient = mejorOrientacion(it.dimUnidadMm, di) ?? it.dimUnidadMm; // fallback defensivo
    const capSolo = capacidadGrid(orient, di);

    let colocadasEsteProd = 0;

    // función para inicializar cursor con la primera unidad (según su orientación)
    const initIfNeeded = () => {
      if (!initialized) {
        cursorX = -di.largo / 2 + orient.largo / 2;
        cursorY = -di.alto / 2 + orient.alto / 2;
        cursorZ = -di.ancho / 2 + orient.ancho / 2;
        initialized = true;
      }
    };

    const codigo =
      (typeof it.codigoProducto === "string" && it.codigoProducto.trim()) ||
      `PROD-${it.productoId}`;

    for (let i = 0; i < it.cantidadUnidades; i++) {
      // Si la unidad no entra, no podemos colocar nada de este producto (debería estar filtrado por entraEnBulto)
      if (
        orient.largo > di.largo ||
        orient.ancho > di.ancho ||
        orient.alto > di.alto
      )
        break;

      initIfNeeded();

      // Si ya no hay altura, cortar global
      if (cursorY + orient.alto / 2 > di.alto / 2) {
        // cortar TODO el packing
        break;
      }

      // Registrar placement
      placements.push({
        productoId: it.productoId,
        codigo,
        dimUnidadMm: orient,
        posCentroMm: { x: cursorX, y: cursorY, z: cursorZ },
      });

      unidadesEnBulto1++;
      colocadasEsteProd++;
      volumenUsadoM3 += it.volumenUnidadM3;

      // Avanzar X
      cursorX += orient.largo;

      // Si X excede, saltar a Z
      if (cursorX + orient.largo / 2 > di.largo / 2) {
        cursorX = -di.largo / 2 + orient.largo / 2;
        cursorZ += orient.ancho;

        // Si Z excede, saltar a Y
        if (cursorZ + orient.ancho / 2 > di.ancho / 2) {
          cursorZ = -di.ancho / 2 + orient.ancho / 2;
          cursorY += orient.alto;
        }
      }
    }

    instrucciones.push({
      productoId: it.productoId,
      codigo,
      orientacionMm: orient,
      unidadesEnBulto1: colocadasEsteProd,
      capacidadTeoricaSiSolo: capSolo,
    });

    // Si cortamos por altura (o quedó lleno), no seguimos con otros productos
    if (initialized && cursorY + orient.alto / 2 > di.alto / 2) {
      break;
    }
  }

  // Estimación de bultos necesarios basada en “cuántas entran en el primer bulto”
  const bultosNecesariosEstimados =
    unidadesEnBulto1 > 0
      ? Math.ceil(unidadesTotales / unidadesEnBulto1)
      : 999999;

  const ocupacionVolumetricaPct =
    capM3 > 0 ? Math.min(100, (volumenUsadoM3 / capM3) * 100) : 0;

  return {
    dimInternaMm: di,
    unidadesTotales,
    unidadesEnBulto1,
    bultosNecesariosEstimados,
    ocupacionVolumetricaPct,
    instrucciones,
    placementsBulto1: placements,
  };
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
      let packing3D: Packing3D | null = null;

      if (viable) {
        // Mantener packing volumétrico (opcional / histórico)
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

        // NUEVO: packing geométrico del primer bulto (preview fiel)
        packing3D = packingPrimerBulto3D(itemsValidos, di);
      }

      // Ranking profesional:
      // 1) Menos bultos necesarios (estimado geométrico)
      // 2) Mayor ocupación volumétrica (geométrica)
      // 3) Preferido primero
      const bultosNecesarios = packing3D?.bultosNecesariosEstimados ?? 999999;
      const ocup = packing3D?.ocupacionVolumetricaPct ?? 0;

      const score =
        bultosNecesarios * 1_000_000 - // menor es mejor
        ocup * 1_000 - // mayor ocupación, mejor
        (b.es_preferido ? 100 : 0);

      return {
        bulto: b,
        dimInternaMm: di,
        capacidadInternaM3: cap,
        viable,
        motivosNoViable: motivos,
        packing,
        packing3D,
        score,
      };
    });

  return evaluaciones
    .filter((e) => e.viable && e.packing3D) // para preview exigimos packing3D
    .sort((a, b) => a.score - b.score)
    .slice(0, topN);
}
