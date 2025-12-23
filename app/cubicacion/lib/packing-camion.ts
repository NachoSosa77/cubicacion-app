// app/cubicacion/lib/packing-camion.ts

export type Mm = number;

export type DimMm = { largo: Mm; ancho: Mm; alto: Mm };

export type CamionInput = {
  transporte: {
    id: number;
    codigo: string;
    largo_mts: number; // largo útil interior
    ancho_mts: number; // ancho útil interior
    alto_mts: number; // alto útil interior
    max_peso_kg?: number | null;
  };

  pallets: Array<{
    palletPlanId: number;
    dimPalletMm: DimMm; // footprint del pallet
    alturaUtilizadaMm: number; // altura usada real (no la altura max del contenedor)
    pesoTotalKg: number;
  }>;
};

export type PalletPlacementCamion = {
  palletPlanId: number;
  dimMm: DimMm; // dim real colocada (alto = alturaUtilizadaMm)
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

export type CamionPlanResult = {
  palletsTotales: number;
  palletsEnCamion: number;
  camionesRequeridos: number; // estimación simple
  pesoTotalKg: number;
  ocupacionBasePct: number;
  warnings: string[];
  placements: PalletPlacementCamion[];
  camionDimMm: DimMm;
};

export type CamionStrategy = "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";

type PalletItem = CamionInput["pallets"][number];

function mToMm(m: number) {
  return Math.round((Number(m) || 0) * 1000);
}

function areaBaseMm2(d: { largo: number; ancho: number }) {
  return d.largo * d.ancho;
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function uniqAnchors(
  anchors: Array<{ x: number; z: number }>,
  eps = 1
): Array<{ x: number; z: number }> {
  // dedupe por llave simple
  const seen = new Set<string>();
  const out: Array<{ x: number; z: number }> = [];
  for (const a of anchors) {
    const x = Math.max(0, Math.round(a.x));
    const z = Math.max(0, Math.round(a.z));
    const key = `${Math.round(x / eps)}:${Math.round(z / eps)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ x, z });
  }
  return out;
}

/**
 * Convención de ejes:
 * - X = largo del camión (0..L)
 * - Z = ancho del camión (0..W)
 * - Origen del mundo en el centro del camión:
 *   cx = -L/2 + (x + largo/2)
 *   cz = -W/2 + (z + ancho/2)
 */
export function calcularCamionPlan(
  input: CamionInput,
  strategy: CamionStrategy = "ESTABLE",
  opts?: {
    clearanceMm?: number; // separación entre pallets y pared (visual + defensivo)
    puertaEnX?: "FRENTE" | "TRASERA"; // para DESCARGA_RAPIDA (referencial)
  }
): CamionPlanResult {
  const warnings: string[] = [];

  const camionDimMm: DimMm = {
    largo: mToMm(input.transporte.largo_mts),
    ancho: mToMm(input.transporte.ancho_mts),
    alto: mToMm(input.transporte.alto_mts),
  };

  const L = camionDimMm.largo;
  const W = camionDimMm.ancho;
  const H = camionDimMm.alto;

  const CLEAR = Math.max(0, Math.round(opts?.clearanceMm ?? 20));
  const puerta = opts?.puertaEnX ?? "TRASERA"; // por defecto, asumimos puerta en el extremo X=L

  // Filtrar pallets válidos
  const pallets = input.pallets
    .filter(
      (p) => (p.dimPalletMm?.largo ?? 0) > 0 && (p.dimPalletMm?.ancho ?? 0) > 0
    )
    .map((p) => ({ ...p }));

  const palletsTotales = pallets.length;

  if (!palletsTotales) {
    return {
      palletsTotales: 0,
      palletsEnCamion: 0,
      camionesRequeridos: 0,
      pesoTotalKg: 0,
      ocupacionBasePct: 0,
      warnings: ["No hay pallets para ubicar en el camión."],
      placements: [],
      camionDimMm,
    };
  }

  // Orden base: huella grande primero (estabilidad)
  pallets.sort(
    (a, b) =>
      areaBaseMm2({ largo: b.dimPalletMm.largo, ancho: b.dimPalletMm.ancho }) -
      areaBaseMm2({ largo: a.dimPalletMm.largo, ancho: a.dimPalletMm.ancho })
  );

  // Validaciones de altura por pallet (warning, no bloquea)
  for (const p of pallets) {
    if (Number(p.alturaUtilizadaMm || 0) > H) {
      warnings.push(
        `PalletPlan ${p.palletPlanId}: altura utilizada (${p.alturaUtilizadaMm} mm) supera la altura del camión (${H} mm).`
      );
    }
  }

  // Helpers de placement
  const placements: PalletPlacementCamion[] = [];
  const placedRects: Array<{
    x: number;
    z: number;
    largo: number;
    ancho: number;
  }> = [];

  const maxPeso =
    input.transporte.max_peso_kg != null
      ? Number(input.transporte.max_peso_kg)
      : null;
  let pesoAcum = 0;

  const overlapsAny = (rect: {
    x: number;
    z: number;
    largo: number;
    ancho: number;
  }) => {
    // AABB overlap (en plano XZ)
    for (const r of placedRects) {
      const sepX =
        rect.x + rect.largo + CLEAR <= r.x || r.x + r.largo + CLEAR <= rect.x;
      const sepZ =
        rect.z + rect.ancho + CLEAR <= r.z || r.z + r.ancho + CLEAR <= rect.z;
      if (!(sepX || sepZ)) return true;
    }
    return false;
  };

  const fitsBounds = (x: number, z: number, largo: number, ancho: number) => {
    return x >= 0 && z >= 0 && x + largo + CLEAR <= L && z + ancho + CLEAR <= W;
  };

  const place = (
    p: PalletItem,
    x: number,
    z: number,
    useLargo: number,
    useAncho: number,
    rot90: boolean
  ) => {
    if (!fitsBounds(x, z, useLargo, useAncho)) return false;
    if (maxPeso != null && maxPeso > 0 && pesoAcum + p.pesoTotalKg > maxPeso)
      return false;

    const rect = { x, z, largo: useLargo, ancho: useAncho };
    if (overlapsAny(rect)) return false;

    // y: apoyado en piso (centro = alto/2)
    const y = Math.max(0, Math.round(Number(p.alturaUtilizadaMm || 0) / 2));

    // centro mundo
    const cx = -L / 2 + (x + useLargo / 2);
    const cz = -W / 2 + (z + useAncho / 2);

    placements.push({
      palletPlanId: p.palletPlanId,
      dimMm: {
        largo: useLargo,
        ancho: useAncho,
        alto: Number(p.alturaUtilizadaMm || 0),
      },
      posCentroMm: { x: cx, y, z: cz },
      rot90,
    });

    placedRects.push(rect);
    pesoAcum += p.pesoTotalKg;

    return true;
  };

  const orientaciones = (p: PalletItem) => {
    const a = p.dimPalletMm;
    const o1 = {
      largo: Math.round(a.largo),
      ancho: Math.round(a.ancho),
      rot90: false,
    };
    const o2 = {
      largo: Math.round(a.ancho),
      ancho: Math.round(a.largo),
      rot90: true,
    };
    // si es cuadrado, evitamos duplicar
    if (o1.largo === o2.largo && o1.ancho === o2.ancho) return [o1];
    return [o1, o2];
  };

  // =========================
  // Strategy A: ESTABLE (fila por fila)
  // =========================
  const runEstable = () => {
    let xCursor = 0;
    let filaAlturaX = 0; // ocupa en X (largo) de la fila
    let zCursor = 0;

    const tryPlaceInRow = (p: PalletItem) => {
      for (const o of orientaciones(p)) {
        const ok = place(p, xCursor, zCursor, o.largo, o.ancho, o.rot90);
        if (!ok) continue;

        zCursor += o.ancho + CLEAR; // avanzamos en Z con clearance
        filaAlturaX = Math.max(filaAlturaX, o.largo + CLEAR);
        return true;
      }
      return false;
    };

    for (const p of pallets) {
      if (tryPlaceInRow(p)) continue;

      // nueva fila
      xCursor += filaAlturaX;
      zCursor = 0;
      filaAlturaX = 0;

      if (!tryPlaceInRow(p)) {
        warnings.push(
          "No entraron todos los pallets en este camión. Se requieren más camiones."
        );
        break;
      }
    }
  };

  // =========================
  // Strategy B/C: anchors + scoring
  // =========================
  const runAnchors = (mode: "OPTIMIZAR" | "DESCARGA") => {
    let anchors: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];

    const puertaX = puerta === "TRASERA" ? L : 0; // TRASERA ~ cerca de x=L, FRENTE ~ cerca de x=0

    const scorePlacement = (
      x: number,
      z: number,
      largo: number,
      ancho: number
    ) => {
      if (mode === "OPTIMIZAR") {
        // “cerrar” huecos: preferimos ubicaciones que minimicen el remanente
        const remX = L - (x + largo);
        const remZ = W - (z + ancho);
        return remX + remZ;
      }

      // DESCARGA: preferimos cercanía a puerta + menos bloqueo lateral (z chico)
      // normalizamos suave para evitar números gigantes
      const centroX = x + largo / 2;
      const distPuerta = Math.abs(centroX - puertaX);
      return distPuerta * 2 + z * 0.5;
    };

    for (const p of pallets) {
      let best: null | {
        x: number;
        z: number;
        largo: number;
        ancho: number;
        rot90: boolean;
        score: number;
      } = null;

      anchors = uniqAnchors(anchors);

      // ordenar anchors para acelerar (heurística)
      anchors.sort((a, b) => {
        if (mode === "OPTIMIZAR") {
          // preferimos anchors más “cerca del origen” para compactar
          return a.x + a.z - (b.x + b.z);
        }
        // descarga: preferimos anchors más cercanos a la puerta
        const da = Math.abs(a.x - puertaX);
        const db = Math.abs(b.x - puertaX);
        return da - db;
      });

      for (const a of anchors) {
        for (const o of orientaciones(p)) {
          if (!fitsBounds(a.x, a.z, o.largo, o.ancho)) continue;
          if (
            maxPeso != null &&
            maxPeso > 0 &&
            pesoAcum + p.pesoTotalKg > maxPeso
          )
            continue;
          if (overlapsAny({ x: a.x, z: a.z, largo: o.largo, ancho: o.ancho }))
            continue;

          const s = scorePlacement(a.x, a.z, o.largo, o.ancho);
          if (!best || s < best.score) {
            best = {
              x: a.x,
              z: a.z,
              largo: o.largo,
              ancho: o.ancho,
              rot90: o.rot90,
              score: s,
            };
          }
        }
      }

      if (!best) {
        warnings.push(
          "No entraron todos los pallets en este camión. Se requieren más camiones."
        );
        break;
      }

      // aplicar mejor
      place(p, best.x, best.z, best.largo, best.ancho, best.rot90);

      // generar nuevos anchors (derecha y adelante)
      anchors.push({ x: best.x + best.largo + CLEAR, z: best.z });
      anchors.push({ x: best.x, z: best.z + best.ancho + CLEAR });

      // opcional: ancla al “fin” del rectángulo, útil en algunos casos
      anchors.push({
        x: best.x + best.largo + CLEAR,
        z: best.z + best.ancho + CLEAR,
      });

      // limpieza ligera: descartamos anchors fuera de bounds
      anchors = anchors.filter((t) => t.x < L && t.z < W);
    }
  };

  // Ejecutar estrategia
  if (strategy === "ESTABLE") runEstable();
  else if (strategy === "OPTIMIZAR") runAnchors("OPTIMIZAR");
  else runAnchors("DESCARGA");

  const palletsEnCamion = placements.length;

  const areaCamion = L * W;
  const areaOcupada = placements.reduce(
    (acc, pl) => acc + pl.dimMm.largo * pl.dimMm.ancho,
    0
  );
  const ocupacionBasePct =
    areaCamion > 0 ? (areaOcupada / areaCamion) * 100 : 0;

  const quedan = palletsTotales - palletsEnCamion;
  const camionesRequeridos = palletsEnCamion > 0 ? (quedan > 0 ? 2 : 1) : 0;

  // warning por peso máximo (si existía y no entró todo)
  if (maxPeso != null && maxPeso > 0 && pesoAcum > maxPeso) {
    warnings.push("Se alcanzó el peso máximo del camión.");
  } else if (maxPeso != null && maxPeso > 0) {
    // si está cerca, opcionalmente avisar
    const ratio = clamp01(pesoAcum / maxPeso);
    if (ratio >= 0.95)
      warnings.push(
        "Atención: el camión está cerca del peso máximo permitido."
      );
  }

  return {
    palletsTotales,
    palletsEnCamion,
    camionesRequeridos,
    pesoTotalKg: pesoAcum,
    ocupacionBasePct,
    warnings,
    placements,
    camionDimMm,
  };
}
