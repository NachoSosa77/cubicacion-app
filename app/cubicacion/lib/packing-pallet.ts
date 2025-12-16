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
  // posición centro en mm (para viewer)
  posCentroMm: { x: number; y: number; z: number };
  capa: number;
};

export type PalletPlanResult = {
  palletsRequeridos: number;

  pallet1: {
    cajasTotales: number;
    cajasPorCapa: number;
    capas: number;

    ocupacionBasePct: number;
    ocupacionVolumenPct: number;

    pesoTotalKg: number;
    alturaTotalM: number;

    items: Array<{
      tipoProductoId: number;
      bultosEnPallet1: number;
      porCapa: number;
    }>;
    warnings: string[];

    placements: PalletPlacement[];
    palletDimMm: { largo: number; ancho: number; alto: number };
  };
};

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
  yBase: number; // mm
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

  const maxCodigos =
    input.reglas?.maxCodigosPorPallet &&
    Number(input.reglas.maxCodigosPorPallet) > 0
      ? Number(input.reglas.maxCodigosPorPallet)
      : null;

  // expandimos “cajas pendientes” por SKU
  const pendientes = input.items
    .filter((x) => x.cantidadBultos > 0)
    .map((x) => ({ ...x }));

  const sortKey = (it: (typeof pendientes)[number]) => {
    if (input.objective === "OPTIMIZAR_VOLUMEN")
      return -volumenMm3(it.dimBultoMm);
    if (input.objective === "CUIDADO_PRODUCTO")
      return -(it.pesoBultoKg * 1000000 + baseArea(it.dimBultoMm));
    return -(baseArea(it.dimBultoMm) * 1000000 + it.pesoBultoKg); // OPERATIVO_ESTABLE
  };

  pendientes.sort((a, b) => sortKey(a) - sortKey(b));

  // control de codigos
  if (maxCodigos && pendientes.length > maxCodigos && permitirMezclaFinal) {
    warnings.push(
      `Hay ${pendientes.length} códigos, pero el máximo permitido por regla es ${maxCodigos}. Se priorizarán los primeros.`
    );
    pendientes.splice(maxCodigos);
  }

  // Peso
  let pesoActualKg = Number(input.contenedor.peso_pallet_kg || 0);
  const pesoMaxKg = Number(input.contenedor.peso_max_kg || 0);

  // Armado pallet1 por capas
  let alturaUsadaMm = 0;
  let capas = 0;
  let cajasTotales = 0;
  let cajasPorCapaRef = 0;

  const placements: PalletPlacement[] = [];
  const porProducto = new Map<number, { bultos: number; porCapa: number }>();

  while (pendientes.some((p) => p.cantidadBultos > 0)) {
    // elegimos el “producto base” para la capa
    const base = pendientes.find((p) => p.cantidadBultos > 0);
    if (!base) break;

    // altura capa = alto del bulto base (si mezclamos, mantenemos altura “máxima” por capa)
    const altoCapa = base.dimBultoMm.alto;
    if (alturaUsadaMm + altoCapa > maxAlturaMm) {
      warnings.push(
        "Se alcanzó la altura máxima del pallet. Quedan bultos para otro pallet."
      );
      break;
    }

    // cuántas cajas entran en la base por grid del producto base
    const capBase = gridCapacity(
      { largo: palletDimMm.largo, ancho: palletDimMm.ancho },
      { largo: base.dimBultoMm.largo, ancho: base.dimBultoMm.ancho }
    );

    if (capBase.cap <= 0) {
      warnings.push(
        `El bulto ${base.codigo} no entra en la base del pallet (ni una unidad).`
      );
      // descartamos para no loop infinito
      base.cantidadBultos = 0;
      continue;
    }

    // llenado capa
    let cajasEnEstaCapa = 0;
    const yBase = alturaUsadaMm;

    // (1) si NO mezclamos: capa homogénea
    if (!permitirMezclaFinal) {
      const maxPorPeso =
        pesoMaxKg > 0
          ? Math.floor((pesoMaxKg - pesoActualKg) / base.pesoBultoKg)
          : 999999;
      const take = Math.max(
        0,
        Math.min(base.cantidadBultos, capBase.cap, maxPorPeso)
      );

      if (take <= 0) {
        warnings.push(
          "Se alcanzó el peso máximo del pallet. Quedan bultos para otro pallet."
        );
        break;
      }

      const pos = buildGridPlacementsLayer({
        palletBase: { largo: palletDimMm.largo, ancho: palletDimMm.ancho },
        box: base.dimBultoMm,
        count: take,
        capa: capas + 1,
        yBase,
      });

      for (const p of pos) {
        placements.push({
          tipoProductoId: base.tipoProductoId,
          codigo: base.codigo,
          dimMm: base.dimBultoMm,
          posCentroMm: p,
          capa: capas + 1,
        });
      }

      base.cantidadBultos -= take;
      cajasEnEstaCapa += take;
      pesoActualKg += take * base.pesoBultoKg;

      const acc = porProducto.get(base.tipoProductoId) ?? {
        bultos: 0,
        porCapa: 0,
      };
      acc.bultos += take;
      acc.porCapa = Math.max(acc.porCapa, take);
      porProducto.set(base.tipoProductoId, acc);
    } else {
      // (2) mezclamos: primero llenamos con base, luego intentamos “rellenar” con otros que entren
      // Nota: para demo profesional usamos grilla del “base” (misma huella). Es consistente y estable.
      const maxSlots = capBase.cap;

      for (let slot = 0; slot < maxSlots; slot++) {
        // elegimos el siguiente item que:
        // - tenga stock
        // - no rompa altura (alto <= altoCapa para mantener capa plana)
        // - no rompa peso
        const next = pendientes.find((p) => {
          if (p.cantidadBultos <= 0) return false;
          if (p.dimBultoMm.alto > altoCapa) return false;
          if (pesoMaxKg > 0 && pesoActualKg + p.pesoBultoKg > pesoMaxKg)
            return false;
          // adicional: para evitar daño, en cuidado_producto priorizamos pesados al inicio ya por sorting
          return true;
        });

        if (!next) break;

        // posición del slot en grilla del base
        const nx = capBase.nx;
        const nz = capBase.nz;
        const ix = slot % nx;
        const iz = Math.floor(slot / nx);
        if (iz >= nz) break;

        const startX = -palletDimMm.largo / 2 + base.dimBultoMm.largo / 2;
        const startZ = -palletDimMm.ancho / 2 + base.dimBultoMm.ancho / 2;

        placements.push({
          tipoProductoId: next.tipoProductoId,
          codigo: next.codigo,
          dimMm: next.dimBultoMm,
          posCentroMm: {
            x: startX + ix * base.dimBultoMm.largo,
            y: yBase + next.dimBultoMm.alto / 2,
            z: startZ + iz * base.dimBultoMm.ancho,
          },
          capa: capas + 1,
        });

        next.cantidadBultos -= 1;
        cajasEnEstaCapa += 1;
        pesoActualKg += next.pesoBultoKg;

        const acc = porProducto.get(next.tipoProductoId) ?? {
          bultos: 0,
          porCapa: 0,
        };
        acc.bultos += 1;
        acc.porCapa = Math.max(acc.porCapa, 1); // en mezcla porCapa es “mínimo”; lo dejamos 1
        porProducto.set(next.tipoProductoId, acc);
      }
    }

    if (cajasEnEstaCapa <= 0) break;

    capas += 1;
    alturaUsadaMm += altoCapa;
    cajasTotales += cajasEnEstaCapa;
    cajasPorCapaRef = Math.max(cajasPorCapaRef, cajasEnEstaCapa);
  }

  // estimar pallets requeridos: por ahora simple
  // (demo): si quedaron pendientes -> 2 pallets; si no -> 1
  const quedan = pendientes.some((p) => p.cantidadBultos > 0);
  const palletsRequeridos = cajasTotales > 0 ? (quedan ? 2 : 1) : 0;

  const areaPallet = palletDimMm.largo * palletDimMm.ancho;
  const areaOcupada =
    placements.reduce((acc, p) => acc + baseArea(p.dimMm), 0) /
    Math.max(1, capas);
  const ocupacionBasePct =
    areaPallet > 0 ? (areaOcupada / areaPallet) * 100 : 0;

  const volPalletMm3 =
    palletDimMm.largo * palletDimMm.ancho * Math.max(1, alturaUsadaMm);
  const volCajasMm3 = placements.reduce(
    (acc, p) => acc + volumenMm3(p.dimMm),
    0
  );
  const ocupacionVolumenPct =
    volPalletMm3 > 0 ? (volCajasMm3 / volPalletMm3) * 100 : 0;

  const alturaTotalM = alturaUsadaMm / 1000;

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
      cajasPorCapa: cajasPorCapaRef,
      capas,
      ocupacionBasePct,
      ocupacionVolumenPct,
      pesoTotalKg: pesoActualKg,
      alturaTotalM,
      items: itemsOut,
      warnings,
      placements,
      palletDimMm,
    },
  };
}
