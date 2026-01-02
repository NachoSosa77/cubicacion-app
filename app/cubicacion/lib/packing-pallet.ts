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
  objective: "OPERATIVO_ESTABLE" | "OPTIMIZAR_VOLUMEN" | "CUIDADO_PRODUCTO";

  objetivoUnidades?: number;
  objetivoOcupacion?: number; // 0–1
  modoSimulacion?: boolean;

  items: Array<{
    tipoProductoId: number;
    codigo: string;
    descripcion?: string;
    cantidadBultos: number;
    dimBultoMm: DimMm;
    pesoBultoKg: number;
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

function gridCapacity(
  palletBase: { largo: number; ancho: number },
  box: { largo: number; ancho: number }
) {
  const nx = Math.floor(palletBase.largo / box.largo);
  const nz = Math.floor(palletBase.ancho / box.ancho);
  if (nx <= 0 || nz <= 0) return { nx: 0, nz: 0, cap: 0 };
  return { nx, nz, cap: nx * nz };
}

function buildGridPlacementsLayer(params: {
  palletBase: { largo: number; ancho: number };
  box: { largo: number; ancho: number; alto: number };
  count: number;
  capa: number;
  yBase: number;
}) {
  const { nx, nz, cap } = gridCapacity(params.palletBase, params.box);
  const take = Math.min(params.count, cap);
  if (take <= 0) return [];

  const startX = -params.palletBase.largo / 2 + params.box.largo / 2;
  const startZ = -params.palletBase.ancho / 2 + params.box.ancho / 2;
  const y = params.yBase + params.box.alto / 2;

  const out: { x: number; y: number; z: number }[] = [];
  let placed = 0;

  for (let iz = 0; iz < nz && placed < take; iz++) {
    for (let ix = 0; ix < nx && placed < take; ix++) {
      out.push({
        x: startX + ix * params.box.largo,
        y,
        z: startZ + iz * params.box.ancho,
      });
      placed++;
    }
  }
  return out;
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
      : palletDimMm.alto
  );

  const permitirMezclaFinal =
    (input.reglas?.permitirMezcla ?? true) &&
    input.mixPolicy === "PERMITIR_MEZCLA";

  const pendientes = input.items
    .filter((x) => x.cantidadBultos > 0)
    .map((x) => ({ ...x }));

  const modoSimulacion = Boolean(input.modoSimulacion);
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

  let pesoActualKg = Number(input.contenedor.peso_pallet_kg || 0);
  const pesoMaxKg = Number(input.contenedor.peso_max_kg || 0);

  let volumenColocadoMm3 = 0;
  let alturaUsadaMm = 0;
  let capas = 0;
  let cajasTotales = 0;
  let cajasPorCapaRef = 0;

  const placements: PalletPlacement[] = [];
  const porProducto = new Map<number, { bultos: number; porCapa: number }>();

  while (pendientes.some((p) => p.cantidadBultos > 0)) {
    if (objetivoUnidades != null && cajasTotales >= objetivoUnidades) break;
    if (volumenObjetivoMm3 != null && volumenColocadoMm3 >= volumenObjetivoMm3)
      break;

    const base = pendientes.find((p) => p.cantidadBultos > 0);
    if (!base) break;

    const altoCapa = base.dimBultoMm.alto;
    if (alturaUsadaMm + altoCapa > maxAlturaMm) break;

    const capBase = gridCapacity(
      { largo: palletDimMm.largo, ancho: palletDimMm.ancho },
      { largo: base.dimBultoMm.largo, ancho: base.dimBultoMm.ancho }
    );

    if (capBase.cap <= 0) {
      base.cantidadBultos = 0;
      continue;
    }

    let cajasEnEstaCapa = 0;
    const yBase = alturaUsadaMm;

    const maxSlots = capBase.cap;

    for (let slot = 0; slot < maxSlots; slot++) {
      const volumenRestante =
        volumenObjetivoMm3 != null
          ? volumenObjetivoMm3 - volumenColocadoMm3
          : Number.POSITIVE_INFINITY;

      if (volumenRestante <= 0) break;

      if (pesoMaxKg > 0 && pesoActualKg + base.pesoBultoKg > pesoMaxKg) break;

      const nx = capBase.nx;
      const nz = capBase.nz;
      const ix = slot % nx;
      const iz = Math.floor(slot / nx);
      if (iz >= nz) break;

      const startX = -palletDimMm.largo / 2 + base.dimBultoMm.largo / 2;
      const startZ = -palletDimMm.ancho / 2 + base.dimBultoMm.ancho / 2;

      placements.push({
        tipoProductoId: base.tipoProductoId,
        codigo: base.codigo,
        dimMm: base.dimBultoMm,
        posCentroMm: {
          x: startX + ix * base.dimBultoMm.largo,
          y: yBase + base.dimBultoMm.alto / 2,
          z: startZ + iz * base.dimBultoMm.ancho,
        },
        capa: capas + 1,
      });

      base.cantidadBultos -= 1;
      cajasEnEstaCapa += 1;
      cajasTotales += 1;
      pesoActualKg += base.pesoBultoKg;
      volumenColocadoMm3 += volumenMm3(base.dimBultoMm);

      const acc = porProducto.get(base.tipoProductoId) ?? {
        bultos: 0,
        porCapa: 0,
      };
      acc.bultos += 1;
      acc.porCapa = Math.max(acc.porCapa, 1);
      porProducto.set(base.tipoProductoId, acc);
    }

    if (cajasEnEstaCapa <= 0) break;

    capas += 1;
    alturaUsadaMm += altoCapa;
    cajasPorCapaRef = Math.max(cajasPorCapaRef, cajasEnEstaCapa);
  }

  const quedan = pendientes.some((p) => p.cantidadBultos > 0);
  const palletsRequeridos = cajasTotales > 0 ? (quedan ? 2 : 1) : 0;

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
    })
  );

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
      },
    },
  };
}
