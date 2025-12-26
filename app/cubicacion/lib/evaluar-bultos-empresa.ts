// app/cubicacion/lib/evaluar-bultos-empresa.ts

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
   Debug helper
============================ */

// Si esto corre en server actions / RSC, podés usar process.env.DEBUG_PACKING
const DEBUG_PACKING =
  typeof process !== "undefined" &&
  (process.env.NEXT_PUBLIC_DEBUG_PACKING === "true" ||
    process.env.DEBUG_PACKING === "true");

function dbg(...args: any[]) {
  if (!DEBUG_PACKING) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

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

// Mensaje explicativo: por qué NO entra en ninguna orientación
function motivoNoEntra(codigo: string, dim: DimMm, di: DimMm): string {
  const ors = orientaciones(dim);
  const entra = ors.some(
    (o) => o.largo <= di.largo && o.ancho <= di.ancho && o.alto <= di.alto
  );
  if (entra) return "";

  const ejemplos = ors
    .slice(0, 3)
    .map((o) => `${o.largo}×${o.ancho}×${o.alto}`)
    .join(" | ");

  return `El producto ${codigo} (${dim.largo}×${dim.ancho}×${dim.alto} mm) NO entra en el bulto (interna ${di.largo}×${di.ancho}×${di.alto} mm). Orientaciones probadas (muestra): ${ejemplos}.`;
}

/* ============================
   Packing geométrico (mezcla permitida)
   - Usado para OPTIMIZAR_VOLUMEN y BUSCAR_MEJOR_ACOMODO
============================ */

function packingPrimerBulto3D(
  items: MultiProductoUnidadInputReal[],
  di: DimMm
): Packing3D {
  const unidadesTotales = items.reduce((a, b) => a + b.cantidadUnidades, 0);
  const capM3 = volumenM3(di);

  const placements: PlacementMm[] = [];
  const instrucciones: InstruccionArmado[] = [];

  // Cursor por “esquinas” en X/Z
  let cursorX = 0;
  let cursorZ = 0;
  let initialized = false;

  // Capas
  let layerBaseY = 0; // base de capa
  let layerHeight = 0; // alto max en capa actual

  let unidadesEnBulto1 = 0;
  let volumenUsadoM3 = 0;

  const init = () => {
    if (initialized) return;
    cursorX = -di.largo / 2;
    cursorZ = -di.ancho / 2;
    layerBaseY = -di.alto / 2;
    layerHeight = 0;
    initialized = true;
  };

  const entraEnAltura = (altoItem: number) =>
    layerBaseY + altoItem <= di.alto / 2;

  for (const it of items) {
    const codigo = it.codigoProducto?.trim() || `PROD-${it.productoId}`;

    const orient = mejorOrientacion(it.dimUnidadMm, di) ?? it.dimUnidadMm;
    const capSolo = capacidadGrid(orient, di);

    dbg("[ORIENT]", {
      codigo,
      dimUnidadOriginal: it.dimUnidadMm,
      orientElegida: orient,
      capSolo,
      di,
    });

    let colocadas = 0;
    let cortoPorAltura = false;

    for (let i = 0; i < it.cantidadUnidades; i++) {
      init();

      if (!entraEnAltura(orient.alto)) {
        cortoPorAltura = true;
        dbg("[FULL]", {
          codigo,
          razon: "sin altura",
          layerBaseY,
          layerHeight,
          orient,
          di,
          colocadasHastaAhora: colocadas,
        });
        break; // corta SOLO este producto
      }

      const posCentroX = cursorX + orient.largo / 2;
      const posCentroZ = cursorZ + orient.ancho / 2;
      const posCentroY = layerBaseY + orient.alto / 2;

      placements.push({
        productoId: it.productoId,
        codigo,
        dimUnidadMm: orient,
        posCentroMm: { x: posCentroX, y: posCentroY, z: posCentroZ },
      });

      unidadesEnBulto1++;
      colocadas++;
      volumenUsadoM3 += it.volumenUnidadM3;

      layerHeight = Math.max(layerHeight, orient.alto);

      // avance X
      cursorX += orient.largo;

      // si se pasa en X, resetea X y avanza Z
      if (cursorX + orient.largo > di.largo / 2) {
        cursorX = -di.largo / 2;
        cursorZ += orient.ancho;

        // si se pasa en Z, nueva capa
        if (cursorZ + orient.ancho > di.ancho / 2) {
          cursorZ = -di.ancho / 2;
          layerBaseY += layerHeight;
          layerHeight = 0;
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

    dbg("[RESUMEN_PRODUCTO]", {
      codigo,
      colocadas,
      cortoPorAltura,
      cursorFinal: { cursorX, layerBaseY, cursorZ, layerHeight },
      unidadesEnBulto1Global: unidadesEnBulto1,
    });
  }

  const bultosNecesariosEstimados =
    unidadesEnBulto1 > 0
      ? Math.ceil(unidadesTotales / unidadesEnBulto1)
      : 999999;

  dbg("=== PACKING PRIMER BULTO ===", {
    dimInterna: di,
    unidadesTotales,
    unidadesEnBulto1,
    bultosNecesariosEstimados,
    ocupacionPct: capM3 > 0 ? Math.min(100, (volumenUsadoM3 / capM3) * 100) : 0,
  });

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
   Estrategias de orden + utilidades
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
   ✅ OPERATIVO: NO mezcla (agrupado por producto)
   - Estima bultos por SKU: sum(ceil(qty/capSolo))
   - Preview bulto1: SOLO primer SKU del orden (estable)
============================ */

function buildGridPlacementsMm(
  di: DimMm,
  orient: DimMm,
  count: number,
  productoId: number,
  codigo: string
): PlacementMm[] {
  const nx = Math.floor(di.largo / orient.largo);
  const nz = Math.floor(di.ancho / orient.ancho);
  const ny = Math.floor(di.alto / orient.alto);

  if (nx <= 0 || nz <= 0 || ny <= 0) return [];

  const max = nx * nz * ny;
  const take = Math.max(0, Math.min(count, max));

  const startX = -di.largo / 2 + orient.largo / 2;
  const startZ = -di.ancho / 2 + orient.ancho / 2;
  const startY = -di.alto / 2 + orient.alto / 2;

  const out: PlacementMm[] = [];
  let placed = 0;

  for (let iy = 0; iy < ny && placed < take; iy++) {
    for (let iz = 0; iz < nz && placed < take; iz++) {
      for (let ix = 0; ix < nx && placed < take; ix++) {
        out.push({
          productoId,
          codigo,
          dimUnidadMm: orient,
          posCentroMm: {
            x: startX + ix * orient.largo,
            y: startY + iy * orient.alto,
            z: startZ + iz * orient.ancho,
          },
        });
        placed++;
      }
    }
  }

  return out;
}

function packingOperativoAgrupado(
  items: MultiProductoUnidadInputReal[],
  di: DimMm
): Packing3D {
  const orden = ordenarItems(items, "AGRUPADO");

  const unidadesTotales = orden.reduce((a, b) => a + b.cantidadUnidades, 0);
  const capM3 = volumenM3(di);

  const instrucciones: InstruccionArmado[] = [];

  let bultosNecesariosEstimados = 0;

  for (const it of orden) {
    const codigo = it.codigoProducto?.trim() || `PROD-${it.productoId}`;
    const orientOk = mejorOrientacion(it.dimUnidadMm, di) ?? it.dimUnidadMm;
    const capSolo = capacidadGrid(orientOk, di);

    instrucciones.push({
      productoId: it.productoId,
      codigo,
      orientacionMm: orientOk,
      unidadesEnBulto1: 0,
      capacidadTeoricaSiSolo: capSolo,
    });

    bultosNecesariosEstimados +=
      capSolo > 0 ? Math.ceil(it.cantidadUnidades / capSolo) : 999999;
  }

  // Preview: SOLO primer producto del orden (estable)
  const first = orden[0];
  const codigoFirst =
    first.codigoProducto?.trim() || `PROD-${first.productoId}`;
  const orientFirst =
    mejorOrientacion(first.dimUnidadMm, di) ?? first.dimUnidadMm;
  const capSoloFirst = capacidadGrid(orientFirst, di);

  const unidadesEnBulto1 =
    capSoloFirst > 0 ? Math.min(first.cantidadUnidades, capSoloFirst) : 0;

  if (instrucciones.length) {
    instrucciones[0] = {
      ...instrucciones[0],
      unidadesEnBulto1,
      capacidadTeoricaSiSolo: capSoloFirst,
      orientacionMm: orientFirst,
    };
  }

  const placements = buildGridPlacementsMm(
    di,
    orientFirst,
    unidadesEnBulto1,
    first.productoId,
    codigoFirst
  );

  const volumenUsadoM3 = unidadesEnBulto1 * first.volumenUnidadM3;

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
   ✅ API: evaluaciones completas
============================ */

export function evaluarBultosEmpresa(
  items: MultiProductoUnidadInputReal[],
  bultos: IEmpresaBulto[],
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

      // 1) descarte duro: no entra
      for (const it of itemsValidos) {
        const codigo = it.codigoProducto?.trim() || `PROD-${it.productoId}`;
        const m = motivoNoEntra(codigo, it.dimUnidadMm, di);
        if (m) motivos.push(m);
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

      // 2) packing real según policy
      let packing3D: Packing3D | null = null;

      if (packingPolicy === "OPERATIVO_AGRUPADO") {
        // ✅ NO MEZCLA
        packing3D = packingOperativoAgrupado(itemsValidos, di);
      } else if (packingPolicy === "BUSCAR_MEJOR_ACOMODO") {
        // ✅ mezcla con múltiples intentos
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
        // OPTIMIZAR_VOLUMEN: ✅ mezcla permitida
        const orden = ordenarItems(itemsValidos, "VOLUMEN");
        packing3D = packingPrimerBulto3D(orden, di);
      }

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

      // ✅ viabilidad mínima: al menos 1 unidad en bulto1
      if (packing3D.unidadesEnBulto1 <= 0) {
        return {
          bulto: b,
          dimInternaMm: di,
          capacidadInternaM3: cap,
          viable: false,
          motivosNoViable: [
            "No entra ninguna unidad en el primer bulto (packing).",
          ],
          packing: null,
          packing3D,
          score: Number.MAX_SAFE_INTEGER,
        };
      }

      // ⚠️ Importante:
      // Esta regla ("que aparezcan todos los productos en el primer bulto") SOLO tiene sentido
      // cuando la policy permite mezclar. En OPERATIVO, por definición, NO corresponde.
      if (packingPolicy !== "OPERATIVO_AGRUPADO") {
        const porProd = new Map<number, number>();
        for (const pl of packing3D.placementsBulto1) {
          porProd.set(pl.productoId, (porProd.get(pl.productoId) ?? 0) + 1);
        }
        const faltantes = itemsValidos
          .filter((it) => (porProd.get(it.productoId) ?? 0) <= 0)
          .map((it) => it.codigoProducto?.trim() || `PROD-${it.productoId}`);

        if (faltantes.length) {
          return {
            bulto: b,
            dimInternaMm: di,
            capacidadInternaM3: cap,
            viable: false,
            motivosNoViable: [
              `El packing no pudo ubicar unidades para: ${faltantes.join(
                ", "
              )}.`,
            ],
            packing: null,
            packing3D,
            score: Number.MAX_SAFE_INTEGER,
          };
        }
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

  return evaluaciones.sort((a, b) => a.score - b.score);
}

/* ============================
   ✅ API existente: topN viables
============================ */

export function evaluarTopBultosEmpresa(
  items: MultiProductoUnidadInputReal[],
  bultos: IEmpresaBulto[],
  topN = 3,
  packingPolicy: PackingPolicy = "OPERATIVO_AGRUPADO"
): EvaluacionBultoEmpresa[] {
  return evaluarBultosEmpresa(items, bultos, packingPolicy)
    .filter((e) => e.viable && e.packing3D)
    .slice(0, topN);
}
