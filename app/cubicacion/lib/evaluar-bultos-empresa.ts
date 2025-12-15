import type { IEmpresaBulto } from "../actions/empresaBultoActions";
import { type ResultadoCubicacionMultiProducto } from "./cubicacion-multiproducto";

/* ============================
   Packing policy
============================ */

export type PackingPolicy =
  | "OPERATIVO_AGRUPADO"
  | "OPTIMIZAR_VOLUMEN"
  | "BUSCAR_MEJOR_ACOMODO";

/* ============================
   Tipos base
============================ */

export type DimMm = { largo: number; ancho: number; alto: number };

export type MultiProductoUnidadInputReal = {
  itemKey: string;
  productoId: number;
  codigoProducto?: string;
  descripcionProducto?: string;
  cantidadUnidades: number;
  volumenUnidadM3: number;
  dimUnidadMm: DimMm;
};

/* ============================
   Tipos 3D / preview
============================ */

export type PlacementMm = {
  productoId: number;
  codigo: string;
  dimUnidadMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
};

export type InstruccionArmado = {
  productoId: number;
  codigo: string;
  orientacionMm: DimMm;
  unidadesEnBulto1: number;
  capacidadTeoricaSiSolo: number;
};

export type Packing3D = {
  dimInternaMm: DimMm;
  unidadesTotales: number;
  unidadesEnBulto1: number;
  bultosNecesariosEstimados: number;
  ocupacionVolumetricaPct: number;
  instrucciones: InstruccionArmado[];
  placementsBulto1: PlacementMm[];
};

export type EvaluacionBultoEmpresa = {
  bulto: IEmpresaBulto;
  dimInternaMm: DimMm;
  capacidadInternaM3: number;
  viable: boolean;
  motivosNoViable: string[];
  packing: ResultadoCubicacionMultiProducto | null;
  packing3D: Packing3D | null;
  score: number;
};

/* ============================
   Utils geométricos
============================ */

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

function entraEnBulto(dimUnidad: DimMm, di: DimMm): boolean {
  return orientaciones(dimUnidad).some(
    (o) => o.largo <= di.largo && o.ancho <= di.ancho && o.alto <= di.alto
  );
}

function capacidadGrid(orient: DimMm, di: DimMm): number {
  const nx = Math.floor(di.largo / orient.largo);
  const nz = Math.floor(di.ancho / orient.ancho);
  const ny = Math.floor(di.alto / orient.alto);
  return nx > 0 && nz > 0 && ny > 0 ? nx * nz * ny : 0;
}

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

/* ============================
   Packing geométrico bulto 1
============================ */

function packingPrimerBulto3D(
  items: MultiProductoUnidadInputReal[],
  di: DimMm
): Packing3D {
  const unidadesTotales = items.reduce((a, b) => a + b.cantidadUnidades, 0);
  const capM3 = volumenM3(di);

  const placements: PlacementMm[] = [];
  const instrucciones: InstruccionArmado[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let cursorZ = 0;
  let initialized = false;

  let unidadesEnBulto1 = 0;
  let volumenUsadoM3 = 0;

  for (const it of items) {
    const orient = mejorOrientacion(it.dimUnidadMm, di) ?? it.dimUnidadMm;
    const capSolo = capacidadGrid(orient, di);
    let colocadas = 0;

    const init = () => {
      if (!initialized) {
        cursorX = -di.largo / 2 + orient.largo / 2;
        cursorY = -di.alto / 2 + orient.alto / 2;
        cursorZ = -di.ancho / 2 + orient.ancho / 2;
        initialized = true;
      }
    };

    const codigo = it.codigoProducto?.trim() || `PROD-${it.productoId}`;

    for (let i = 0; i < it.cantidadUnidades; i++) {
      init();

      if (cursorY + orient.alto / 2 > di.alto / 2) break;

      placements.push({
        productoId: it.productoId,
        codigo,
        dimUnidadMm: orient,
        posCentroMm: { x: cursorX, y: cursorY, z: cursorZ },
      });

      unidadesEnBulto1++;
      colocadas++;
      volumenUsadoM3 += it.volumenUnidadM3;

      cursorX += orient.largo;
      if (cursorX + orient.largo / 2 > di.largo / 2) {
        cursorX = -di.largo / 2 + orient.largo / 2;
        cursorZ += orient.ancho;
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
      unidadesEnBulto1: colocadas,
      capacidadTeoricaSiSolo: capSolo,
    });

    if (cursorY + orient.alto / 2 > di.alto / 2) break;
  }

  const bultosNecesariosEstimados =
    unidadesEnBulto1 > 0
      ? Math.ceil(unidadesTotales / unidadesEnBulto1)
      : 999999;

  console.log("=== PACKING PRIMER BULTO ===");
  console.log("DIM INTERNA:", di);
  console.log(
    "INSTRUCCIONES:",
    instrucciones.map((i) => ({
      codigo: i.codigo,
      unidadesEnBulto1: i.unidadesEnBulto1,
      capSolo: i.capacidadTeoricaSiSolo,
    }))
  );
  console.log(
    "PLACEMENTS POR PRODUCTO:",
    placements.reduce<Record<string, number>>((acc, p) => {
      acc[p.codigo] = (acc[p.codigo] ?? 0) + 1;
      return acc;
    }, {})
  );

  return {
    dimInternaMm: di,
    unidadesTotales,
    unidadesEnBulto1,
    bultosNecesariosEstimados,
    ocupacionVolumetricaPct:
      capM3 > 0 ? Math.min(100, (volumenUsadoM3 / capM3) * 100) : 0,
    instrucciones,
    placementsBulto1: placements,
  };
}

/* ============================
   Estrategias de orden
============================ */

function ordenarItems(
  items: MultiProductoUnidadInputReal[],
  modo: "AGRUPADO" | "VOLUMEN"
) {
  if (modo === "AGRUPADO") {
    return [...items].sort((a, b) =>
      (a.codigoProducto ?? "").localeCompare(b.codigoProducto ?? "")
    );
  }
  return [...items].sort((a, b) => b.volumenUnidadM3 - a.volumenUnidadM3);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esMejor(a: Packing3D, b: Packing3D) {
  if (a.bultosNecesariosEstimados !== b.bultosNecesariosEstimados) {
    return a.bultosNecesariosEstimados < b.bultosNecesariosEstimados;
  }
  return a.ocupacionVolumetricaPct > b.ocupacionVolumetricaPct;
}

/* ============================
   API pública
============================ */

export function evaluarTopBultosEmpresa(
  items: MultiProductoUnidadInputReal[],
  bultos: IEmpresaBulto[],
  topN = 3,
  packingPolicy: PackingPolicy = "OPERATIVO_AGRUPADO"
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

      if (cap <= 0) motivos.push("Capacidad interna inválida.");

      for (const it of itemsValidos) {
        if (!entraEnBulto(it.dimUnidadMm, di)) {
          motivos.push(
            `El producto ${
              it.codigoProducto ?? it.productoId
            } no entra en el bulto.`
          );
        }
      }

      if (motivos.length) {
        return {
          bulto: b,
          dimInternaMm: di,
          capacidadInternaM3: cap,
          viable: false,
          motivosNoViable: motivos,
          packing: null,
          packing3D: null,
          score: Number.MAX_SAFE_INTEGER,
        };
      }

      let packing3D: Packing3D | null = null;

      if (packingPolicy === "BUSCAR_MEJOR_ACOMODO") {
        const estrategias: ("AGRUPADO" | "VOLUMEN")[] = ["AGRUPADO", "VOLUMEN"];
        const INTENTOS = 24;

        for (const est of estrategias) {
          for (let i = 0; i < INTENTOS; i++) {
            const orden = shuffle(ordenarItems(itemsValidos, est));
            const p = packingPrimerBulto3D(orden, di);
            if (!packing3D || esMejor(p, packing3D)) {
              packing3D = p;
            }
          }
        }
      } else {
        const orden =
          packingPolicy === "OPTIMIZAR_VOLUMEN"
            ? ordenarItems(itemsValidos, "VOLUMEN")
            : ordenarItems(itemsValidos, "AGRUPADO");
        packing3D = packingPrimerBulto3D(orden, di);
      }

      // 🔒 FIX TS: guard clause explícito
      if (!packing3D) {
        return {
          bulto: b,
          dimInternaMm: di,
          capacidadInternaM3: cap,
          viable: false,
          motivosNoViable: ["No se pudo generar un packing válido."],
          packing: null,
          packing3D: null,
          score: Number.MAX_SAFE_INTEGER,
        };
      }

      const score =
        packing3D.bultosNecesariosEstimados * 1_000_000 -
        packing3D.ocupacionVolumetricaPct * 1_000 -
        (b.es_preferido ? 100 : 0);

      return {
        bulto: b,
        dimInternaMm: di,
        capacidadInternaM3: cap,
        viable: true,
        motivosNoViable: [],
        packing: null,
        packing3D,
        score,
      };
    });

  return evaluaciones
    .filter((e) => e.viable && e.packing3D)
    .sort((a, b) => a.score - b.score)
    .slice(0, topN);
}
