export type Mm = number;

export type DimMm = { largo: Mm; ancho: Mm; alto: Mm };

export type PalletInput = {
  contenedor: {
    id: number;
    codigo: string;
    largo_mts: number;
    ancho_mts: number;
    alto_mts: number;
    peso_pallet_kg: number;
    peso_max_kg: number;
  };

  reglas?: {
    maxAlturaM?: number | null;
    maxCodigosPorPallet?: number | null;
    permitirMezcla?: boolean | null;
  } | null;

  mixPolicy: "NO_MEZCLAR" | "PERMITIR_MEZCLA";

  // ✅ Limpio: sin duplicados
  objective: "OPERATIVO_ESTABLE" | "OPERATIVO_PARAMETRIZABLE";

  // ✅ Feature independiente del objective
  rotacion2D?: "ON" | "OFF";

  // ✅ Parámetros PRO (solo se usan si objective=OPERATIVO_PARAMETRIZABLE)
  parametros?: {
    limiteBultos?: number | null; // (hoy no lo usamos acá: lo resolvés en preview)
    limiteCapas?: number | null; // 1..N (además de altura/pallet)
    objetivoOcupacion01?: number | null; // (hoy no lo usamos acá: lo resolvés en preview)
    apilableOverride?: boolean | null; // false => forzar NO apilable (max 1 capa)
  } | null;

  // legacy (compat)
  objetivoUnidades?: number; // bultos
  objetivoOcupacion?: number; // 0–1
  modoSimulacion?: boolean;

  items: Array<{
    tipoProductoId: number;
    codigo: string;
    descripcion?: string;
    cantidadBultos: number;
    dimBultoMm: DimMm;
    pesoBultoKg: number;
    apilable: boolean;
  }>;
};

export type PalletPlacement = {
  tipoProductoId: number;
  codigo: string;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  capa: number;
};

export type PalletPlanResult = {
  palletsRequeridos: number;

  pallet1: {
    cajasTotales: number;
    unidadesColocadas: number;
    cajasPorCapa: number;
    capas: number;

    ocupacionBasePct: number;
    ocupacionVolumenPct: number;
    ocupacionLogradaPct: number;
    volumenLibreMm3: number;

    pesoTotalKg: number;
    alturaTotalM: number;

    items: Array<{
      tipoProductoId: number;
      bultosEnPallet1: number;
      porCapa: number;
    }>;

    warnings: string[];
    placements: PalletPlacement[];
    palletDimMm: DimMm;

    referencias: {
      alturaFisicaMm: number;
      alturaUtilMm: number;
      alturaUsadaMm: number;
      volumenMaxMm3: number;
      volumenUsadoAlturaMm3: number;
      volumenCajasMm3: number;
      objetivoOcupacion01?: number | null;
      objetivoUnidades?: number | null;
      modoSimulacion: boolean;
      rotacion2D: "ON" | "OFF";
      orientacionElegida?: "NORMAL" | "ROTADA";
    };
  };
};

/* =========================
   Utils
========================= */

function mToMm(m: number) {
  return Math.round((Number(m) || 0) * 1000);
}

function baseArea(d: DimMm) {
  return d.largo * d.ancho;
}

function volumenMm3(d: DimMm) {
  return d.largo * d.ancho * d.alto;
}

function sameDimMm(a: DimMm, b: DimMm) {
  return a.largo === b.largo && a.ancho === b.ancho && a.alto === b.alto;
}

/**
 * Devuelve la mejor capacidad de grid (nx*nz) para (largo/ancho) del pallet
 * con caja (largo/ancho) y, opcionalmente, rotación 2D.
 * rotated=true => se usa box.ancho como X y box.largo como Z
 */
function gridCapacityBest(
  palletBase: { largo: number; ancho: number },
  box: { largo: number; ancho: number },
  allowRotation: boolean,
) {
  const normal = {
    nx: Math.floor(palletBase.largo / box.largo),
    nz: Math.floor(palletBase.ancho / box.ancho),
  };
  const capNormal = normal.nx > 0 && normal.nz > 0 ? normal.nx * normal.nz : 0;

  if (!allowRotation) {
    return {
      ...normal,
      cap: capNormal,
      rotated: false,
    };
  }

  const rotated = {
    nx: Math.floor(palletBase.largo / box.ancho),
    nz: Math.floor(palletBase.ancho / box.largo),
  };
  const capRot = rotated.nx > 0 && rotated.nz > 0 ? rotated.nx * rotated.nz : 0;

  if (capRot > capNormal) {
    return {
      ...rotated,
      cap: capRot,
      rotated: true,
    };
  }

  return {
    ...normal,
    cap: capNormal,
    rotated: false,
  };
}

/**
 * Cálculo PRO del origen para centrar el grid dentro del pallet:
 * start = -L/2 + (free/2) + (dim/2)
 */
function gridStartCentered(palletLen: number, n: number, dim: number) {
  const used = n * dim;
  const free = Math.max(0, palletLen - used);
  return -palletLen / 2 + free / 2 + dim / 2;
}

/* =========================
   Motor principal
========================= */

export function calcularPalletPlan(input: PalletInput): PalletPlanResult {
  const warnings: string[] = [];

  const palletDimMm = {
    largo: mToMm(input.contenedor.largo_mts),
    ancho: mToMm(input.contenedor.ancho_mts),
    alto: mToMm(input.contenedor.alto_mts),
  };

  const maxAlturaMm = Math.min(
    palletDimMm.alto,
    input.reglas?.maxAlturaM
      ? mToMm(Number(input.reglas.maxAlturaM))
      : palletDimMm.alto,
  );

  const permitirMezclaFinal =
    (input.reglas?.permitirMezcla ?? true) &&
    input.mixPolicy === "PERMITIR_MEZCLA";

  const pendientes = input.items
    .filter((x) => x.cantidadBultos > 0)
    .map((x) => ({ ...x }));

  const modoSimulacion = Boolean(input.modoSimulacion);

  // ✅ Rotación 2D independiente
  const allowRotation2D = (input.rotacion2D ?? "OFF") === "ON";

  // =========================
  // Límites PRO (capas + apilable)
  // =========================
  const limiteCapas =
    input.parametros?.limiteCapas != null &&
    Number(input.parametros.limiteCapas) > 0
      ? Math.floor(Number(input.parametros.limiteCapas))
      : null;

  const apilableOverride =
    typeof input.parametros?.apilableOverride === "boolean"
      ? input.parametros.apilableOverride
      : null;

  let maxCapasPermitidas =
    limiteCapas != null ? limiteCapas : Number.POSITIVE_INFINITY;

  // override explícito del usuario (PRO)
  if (apilableOverride === false) {
    maxCapasPermitidas = Math.min(maxCapasPermitidas, 1);
    warnings.push(
      "Modo parametrizable: apilable=NO. Se limita a 1 capa por pallet.",
    );
  } else if (apilableOverride == null) {
    // si no hay override, respetamos catálogo: si existe algún NO apilable => 1 capa
    const hayNoApilable = pendientes.some((p) => p.apilable === false);
    if (hayNoApilable) {
      maxCapasPermitidas = Math.min(maxCapasPermitidas, 1);
      warnings.push("Hay bultos NO apilables: se limita a 1 capa por pallet.");
    }
  }

  // =========================
  // Objetivos legacy (corte)
  // =========================
  const objetivoUnidades =
    modoSimulacion && input.objetivoUnidades != null
      ? Math.max(0, Math.floor(Number(input.objetivoUnidades)))
      : null;

  const objetivoOcupacion =
    modoSimulacion && input.objetivoOcupacion != null
      ? Math.min(1, Math.max(0, Number(input.objetivoOcupacion)))
      : null;

  const volumenObjetivoMm3 =
    objetivoOcupacion != null
      ? objetivoOcupacion * palletDimMm.largo * palletDimMm.ancho * maxAlturaMm
      : null;

  // =========================
  // Estado
  // =========================
  let pesoActualKg = Number(input.contenedor.peso_pallet_kg || 0);
  const pesoMaxKg = Number(input.contenedor.peso_max_kg || 0);

  let volumenColocadoMm3 = 0;
  let alturaUsadaMm = 0;
  let capas = 0;
  let cajasTotales = 0;
  let cajasPorCapaRef = 0;

  const placements: PalletPlacement[] = [];
  const porProducto = new Map<number, { bultos: number; porCapa: number }>();

  let orientacionElegida: "NORMAL" | "ROTADA" | undefined;

  while (pendientes.some((p) => p.cantidadBultos > 0)) {
    // ✅ Límite por capas (PRO / apilable)
    if (capas >= maxCapasPermitidas) break;

    // ✅ Cortes por objetivos
    if (objetivoUnidades != null && cajasTotales >= objetivoUnidades) break;
    if (volumenObjetivoMm3 != null && volumenColocadoMm3 >= volumenObjetivoMm3)
      break;

    const base = pendientes.find((p) => p.cantidadBultos > 0);
    if (!base) break;

    const altoCapa = base.dimBultoMm.alto;

    // ✅ Si no hay altura disponible, cortamos
    if (alturaUsadaMm + altoCapa > maxAlturaMm) break;

    // ✅ Capacidad de grid + orientación
    const capBase = gridCapacityBest(
      { largo: palletDimMm.largo, ancho: palletDimMm.ancho },
      { largo: base.dimBultoMm.largo, ancho: base.dimBultoMm.ancho },
      allowRotation2D,
    );

    orientacionElegida = capBase.rotated ? "ROTADA" : "NORMAL";

    // ✅ Dimensiones del grid (si rotó, se invierte)
    const dimX = capBase.rotated
      ? base.dimBultoMm.ancho
      : base.dimBultoMm.largo;
    const dimZ = capBase.rotated
      ? base.dimBultoMm.largo
      : base.dimBultoMm.ancho;

    if (capBase.cap <= 0) {
      base.cantidadBultos = 0;
      continue;
    }

    let cajasEnEstaCapa = 0;
    const yBase = alturaUsadaMm;

    // ✅ inicio centrado (PRO)
    const startX = gridStartCentered(palletDimMm.largo, capBase.nx, dimX);
    const startZ = gridStartCentered(palletDimMm.ancho, capBase.nz, dimZ);

    for (let slot = 0; slot < capBase.cap; slot++) {
      if (objetivoUnidades != null && cajasTotales >= objetivoUnidades) break;

      const volumenRestante =
        volumenObjetivoMm3 != null
          ? volumenObjetivoMm3 - volumenColocadoMm3
          : Number.POSITIVE_INFINITY;

      if (volumenRestante <= 0) break;

      const nx = capBase.nx;
      const nz = capBase.nz;

      const ix = slot % nx;
      const iz = Math.floor(slot / nx);
      if (iz >= nz) break;

      // ✅ Elegir item:
      let chosen = base;

      if (permitirMezclaFinal) {
        const alt = pendientes.find(
          (p) =>
            p.cantidadBultos > 0 &&
            sameDimMm(p.dimBultoMm, base.dimBultoMm) &&
            (pesoMaxKg <= 0 || pesoActualKg + p.pesoBultoKg <= pesoMaxKg),
        );
        if (alt) chosen = alt;
      }

      // ✅ Peso
      if (pesoMaxKg > 0 && pesoActualKg + chosen.pesoBultoKg > pesoMaxKg) break;

      // ✅ Dimensión real del placement (si el grid rotó, rotamos la caja visual)
      const placedDim: DimMm = capBase.rotated
        ? {
            largo: chosen.dimBultoMm.ancho,
            ancho: chosen.dimBultoMm.largo,
            alto: chosen.dimBultoMm.alto,
          }
        : chosen.dimBultoMm;

      placements.push({
        tipoProductoId: chosen.tipoProductoId,
        codigo: chosen.codigo,
        dimMm: placedDim,
        posCentroMm: {
          x: startX + ix * dimX,
          y: yBase + placedDim.alto / 2,
          z: startZ + iz * dimZ,
        },
        capa: capas + 1,
      });

      chosen.cantidadBultos -= 1;
      cajasEnEstaCapa += 1;
      cajasTotales += 1;

      pesoActualKg += chosen.pesoBultoKg;
      volumenColocadoMm3 += volumenMm3(chosen.dimBultoMm);

      if (objetivoUnidades != null && cajasTotales >= objetivoUnidades) break;

      const acc = porProducto.get(chosen.tipoProductoId) ?? {
        bultos: 0,
        porCapa: 0,
      };
      acc.bultos += 1;
      acc.porCapa = Math.max(acc.porCapa, 1);
      porProducto.set(chosen.tipoProductoId, acc);
    }

    if (cajasEnEstaCapa <= 0) break;

    capas += 1;
    alturaUsadaMm += altoCapa;
    cajasPorCapaRef = Math.max(cajasPorCapaRef, cajasEnEstaCapa);
  }

  const totalBultosObjetivo = input.items.reduce(
    (acc, it) => acc + Math.max(0, Math.floor(Number(it.cantidadBultos || 0))),
    0,
  );

  // Si no entró nada en el pallet1, no podemos estimar (0 o error)
  const palletsRequeridos =
    cajasTotales > 0
      ? Math.max(1, Math.ceil(totalBultosObjetivo / cajasTotales))
      : 0;

  // Si querés advertir cuando el pallet1 no pudo colocar nada:
  if (totalBultosObjetivo > 0 && cajasTotales === 0) {
    warnings.push(
      "No se pudo colocar ningún bulto en pallet1 con las restricciones actuales.",
    );
  }

  const areaPallet = palletDimMm.largo * palletDimMm.ancho;
  const areaOcupada =
    placements.reduce((acc, p) => acc + baseArea(p.dimMm), 0) /
    Math.max(1, capas);

  const ocupacionBasePct =
    areaPallet > 0 ? (areaOcupada / areaPallet) * 100 : 0;

  const volumenUsadoAlturaMm3 =
    palletDimMm.largo * palletDimMm.ancho * Math.max(1, alturaUsadaMm);

  const volumenMaxMm3 =
    palletDimMm.largo * palletDimMm.ancho * Math.max(1, maxAlturaMm);

  const volumenCajasMm3 = volumenColocadoMm3;

  const ocupacionVolumenPct =
    volumenUsadoAlturaMm3 > 0
      ? (volumenCajasMm3 / volumenUsadoAlturaMm3) * 100
      : 0;

  const volumenLibreMm3 = Math.max(0, volumenMaxMm3 - volumenCajasMm3);

  const ocupacionLogradaPct =
    volumenMaxMm3 > 0 ? (volumenCajasMm3 / volumenMaxMm3) * 100 : 0;

  const itemsOut = Array.from(porProducto.entries()).map(
    ([tipoProductoId, v]) => ({
      tipoProductoId,
      bultosEnPallet1: v.bultos,
      porCapa: v.porCapa,
    }),
  );

  console.log("[PALLET_PLAN_RESUMEN]", {
    palletDimMm,
    alturaUtilMm: maxAlturaMm,
    cajasTotales,
    cajasPorCapa: cajasPorCapaRef,
    capas,
    alturaUsadaMm,
    pesoTotalKg: pesoActualKg,
    ocupacionBasePct,
    ocupacionVolumenPct,
    ocupacionLogradaPct,
    volumenCajasMm3,
    volumenMaxMm3,
    orientacionElegida,
  });

  return {
    palletsRequeridos,
    pallet1: {
      cajasTotales,
      unidadesColocadas: cajasTotales,
      cajasPorCapa: cajasPorCapaRef,
      capas,
      ocupacionBasePct,
      ocupacionVolumenPct,
      ocupacionLogradaPct,
      volumenLibreMm3,
      pesoTotalKg: pesoActualKg,
      alturaTotalM: alturaUsadaMm / 1000,
      items: itemsOut,
      warnings,
      placements,
      palletDimMm,
      referencias: {
        alturaFisicaMm: palletDimMm.alto,
        alturaUtilMm: maxAlturaMm,
        alturaUsadaMm,
        volumenMaxMm3,
        volumenUsadoAlturaMm3,
        volumenCajasMm3,
        objetivoOcupacion01: objetivoOcupacion,
        objetivoUnidades,
        modoSimulacion,
        rotacion2D: allowRotation2D ? "ON" : "OFF",
        orientacionElegida,
      },
    },
  };
}
