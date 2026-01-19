// lib/packing/bulto.ts
 

export type DimMm = { largo: number; ancho: number; alto: number };

export type CubicacionBulto3DInput = {
  bulto: {
    codigo: string;
    dimExternaMm: DimMm;
    dimInternaMm: DimMm;
    taraKg?: number | null;
    maxPesoKg?: number | null;
  };
  contenido: {
    productoId: number;
    codigo: string;
    unidades: number; // en el viewer lo usás como "1" por placement
    dimUnidadMm: DimMm;
    positionMm: { x: number; y: number; z: number };
  }[];
};

export type SimulacionBultoModo =
  | { kind: "MAX" }
  | { kind: "PCT"; pct: number };

export type SimulacionProductoBultoInput = {
  productoId: number;
  codigoProducto: string;

  dimUnidadMm: DimMm;
  pesoUnidadKg: number | null;

  bulto: {
    codigo: string;
    dimInternaMm: DimMm;
    dimExternaMm: DimMm;
    taraKg?: number | null;
    maxPesoKg?: number | null;
  };

  reglas: {
    apilable: boolean;
    maxCargaSuperiorKg: number | null; // max carga superior por unidad (kg)
    factorSeguridad: number;
  };

  cantidadSolicitada: number; // demanda (q)
  modo: SimulacionBultoModo;
};

export type SimulacionProductoBultoResult = {
  capGeometrica: number;
  capA2: number;
  capPeso: number; // ✅ nuevo: límite por peso total del bulto (si aplica)
  capMaxOperativa: number;

  unidadesObjetivo: number;
  nivelesPermitidos: number;

  ocupacionVolumetricaPct: number | null;
  warnings: string[];

  packing3d: CubicacionBulto3DInput;
};

/* =========================
   Utils
========================= */

const isFinitePos = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const mm3 = (d: DimMm) => d.largo * d.ancho * d.alto;

function gridDims(dimInterna: DimMm, dimUnidad: DimMm) {
  const nx = Math.floor(dimInterna.largo / dimUnidad.largo);
  const nz = Math.floor(dimInterna.ancho / dimUnidad.ancho);
  const ny = Math.floor(dimInterna.alto / dimUnidad.alto);
  return { nx, nz, ny };
}

function buildGridPlacementsLimited(
  dimInterna: DimMm,
  dimUnidad: DimMm,
  count: number,
  nivelesPermitidos: number
): { x: number; y: number; z: number }[] {
  const { nx, nz, ny } = gridDims(dimInterna, dimUnidad);

  const nyEff = Math.max(0, Math.min(ny, nivelesPermitidos));
  if (nx <= 0 || nz <= 0 || nyEff <= 0) return [];

  const max = nx * nz * nyEff;
  const take = Math.max(0, Math.min(count, max));

  const out: { x: number; y: number; z: number }[] = [];

  const startX = -dimInterna.largo / 2 + dimUnidad.largo / 2;
  const startZ = -dimInterna.ancho / 2 + dimUnidad.ancho / 2;
  const startY = -dimInterna.alto / 2 + dimUnidad.alto / 2;

  let placed = 0;
  for (let iy = 0; iy < nyEff && placed < take; iy++) {
    for (let iz = 0; iz < nz && placed < take; iz++) {
      for (let ix = 0; ix < nx && placed < take; ix++) {
        out.push({
          x: startX + ix * dimUnidad.largo,
          y: startY + iy * dimUnidad.alto,
          z: startZ + iz * dimUnidad.ancho,
        });
        placed++;
      }
    }
  }
  return out;
}

function buildSinglePlacementOnFloor(
  dimInterna: DimMm,
  dimUnidad: DimMm
): { x: number; y: number; z: number } {
  return {
    x: 0,
    z: 0,
    y: -dimInterna.alto / 2 + dimUnidad.alto / 2,
  };
}

/* =========================
   Core
========================= */

/**
 * Simula un solo producto dentro de un bulto.
 * - Capacidad geométrica por grilla (sin rotaciones).
 * - Límite A2 por compresión (si hay datos).
 * - Límite por peso total del bulto (si hay maxPesoKg y pesoUnidadKg).
 * - Modo MAX o % objetivo sobre la capacidad operativa.
 */
export function simulateProductoEnBulto(
  input: SimulacionProductoBultoInput
): SimulacionProductoBultoResult {
  const warnings: string[] = [];

  const q = Number(input.cantidadSolicitada);
  const pct = input.modo.kind === "PCT" ? Number(input.modo.pct ?? NaN) : null;

  // Validaciones mínimas
  if (!Number.isFinite(q) || q <= 0) {
    throw new Error("cantidadSolicitada debe ser un número positivo.");
  }
  if (
    !isFinitePos(input.dimUnidadMm?.largo) ||
    !isFinitePos(input.dimUnidadMm?.ancho) ||
    !isFinitePos(input.dimUnidadMm?.alto)
  ) {
    throw new Error("dimUnidadMm inválida (largo/ancho/alto > 0).");
  }
  if (
    !isFinitePos(input.bulto?.dimInternaMm?.largo) ||
    !isFinitePos(input.bulto?.dimInternaMm?.ancho) ||
    !isFinitePos(input.bulto?.dimInternaMm?.alto)
  ) {
    throw new Error("bulto.dimInternaMm inválida (largo/ancho/alto > 0).");
  }
  if (
    !isFinitePos(input.bulto?.dimExternaMm?.largo) ||
    !isFinitePos(input.bulto?.dimExternaMm?.ancho) ||
    !isFinitePos(input.bulto?.dimExternaMm?.alto)
  ) {
    warnings.push(
      "dimExternaMm inválida; se usará dimInternaMm para visualización."
    );
  }

  if (input.modo.kind === "PCT") {
    if (!Number.isFinite(pct) || pct === null) {
      throw new Error("modo PCT requiere pct numérico.");
    }
    if (pct <= 0 || pct > 100) {
      throw new Error("pct debe estar en (0, 100].");
    }
  }

  const dimInterna = input.bulto.dimInternaMm;
  const dimExternaOk =
    isFinitePos(input.bulto.dimExternaMm?.largo) &&
    isFinitePos(input.bulto.dimExternaMm?.ancho) &&
    isFinitePos(input.bulto.dimExternaMm?.alto);

  const dimExterna = dimExternaOk ? input.bulto.dimExternaMm : dimInterna;

  // A) Capacidad geométrica (grilla sin rotaciones)
  const { nx, nz, ny } = gridDims(dimInterna, input.dimUnidadMm);
  const capGeometrica = nx > 0 && nz > 0 && ny > 0 ? nx * nz * ny : 0;

  // B) Límite A2 (compresión)
  let nivelesPermitidos = ny; // por defecto, todo lo geométrico
  let capA2 = capGeometrica;

  const apilable = Boolean(input.reglas.apilable);
  const pesoUnidadKg =
    input.pesoUnidadKg !== null && Number.isFinite(input.pesoUnidadKg)
      ? Number(input.pesoUnidadKg)
      : null;

  const maxCarga = Number(input.reglas.maxCargaSuperiorKg ?? NaN);
  const factor = Number(input.reglas.factorSeguridad ?? NaN);

  if (!apilable) {
    nivelesPermitidos = Math.min(ny, 1);
    capA2 =
      nx > 0 && nz > 0 && nivelesPermitidos > 0
        ? nx * nz * nivelesPermitidos
        : 0;
    warnings.push("Producto no apilable: se limita a 1 nivel.");
  } else if (capGeometrica > 0) {
    if (pesoUnidadKg === null || !isFinitePos(pesoUnidadKg)) {
      warnings.push(
        "A2 no aplicado: pesoUnidadKg no disponible (se usa solo geometría)."
      );
    } else if (!Number.isFinite(maxCarga) || maxCarga <= 0) {
      warnings.push(
        "A2 no aplicado: max_carga_superior_por_unidad_kg no definido (se usa solo geometría)."
      );
    } else {
      const f = Number.isFinite(factor) && factor > 0 ? factor : 1.0;
      if (!Number.isFinite(factor) || factor <= 0) {
        warnings.push("factor_seguridad_compresion inválido; se asume 1.0.");
      }

      // (niveles - 1) * pesoUnidadKg <= maxCarga * f
      const nivelesPorA2 = Math.floor((maxCarga * f) / pesoUnidadKg) + 1;

      nivelesPermitidos = clamp(nivelesPorA2, 1, ny);
      capA2 =
        nx > 0 && nz > 0 && nivelesPermitidos > 0
          ? nx * nz * nivelesPermitidos
          : 0;

      if (nivelesPermitidos < ny) {
        warnings.push(
          `A2 limita apilado: ${nivelesPermitidos} nivel(es) permitidos de ${ny}.`
        );
      }
    }
  }

  // C) Límite por peso total del bulto (opcional)
  // - peso permitido para contenido = maxPesoKg - taraKg
  // - capPeso = floor(pesoContenidoMax / pesoUnidadKg)
  // Si faltan datos, capPeso = Infinity
  let capPeso = Number.POSITIVE_INFINITY;

  const maxPesoKg = Number(input.bulto.maxPesoKg ?? NaN);
  const taraKgRaw = Number(input.bulto.taraKg ?? 0);
  const taraKg = Number.isFinite(taraKgRaw) && taraKgRaw >= 0 ? taraKgRaw : 0;

  if (Number.isFinite(maxPesoKg) && maxPesoKg > 0) {
    if (pesoUnidadKg === null || !isFinitePos(pesoUnidadKg)) {
      warnings.push(
        "Límite de peso del bulto no aplicado: pesoUnidadKg no disponible."
      );
    } else {
      const contenidoMax = Math.max(0, maxPesoKg - taraKg);
      capPeso = Math.floor(contenidoMax / pesoUnidadKg);

      if (capPeso <= 0) {
        warnings.push(
          "Límite de peso del bulto: no permite cargar unidades (maxPesoKg - taraKg insuficiente)."
        );
        capPeso = 0;
      }
    }
  }

  // D) Capacidad máxima operativa
  const capMaxOperativa = Math.min(capGeometrica, capA2, capPeso);

  // E) Objetivo por modo
  let unidadesObjetivo = 0;
  if (input.modo.kind === "MAX") {
    unidadesObjetivo = Math.min(q, capMaxOperativa);
  } else {
    const p = Number(input.modo.pct);
    const objetivo = Math.floor((capMaxOperativa * p) / 100);
    unidadesObjetivo = Math.min(q, objetivo);
    if (unidadesObjetivo < q) {
      warnings.push(
        `Modo %: objetivo ${p.toFixed(
          1
        )}% => ${unidadesObjetivo} unidad(es) en bulto 1.`
      );
    }
  }

  // F) Placements
  let placements =
    unidadesObjetivo > 0
      ? buildGridPlacementsLimited(
          dimInterna,
          input.dimUnidadMm,
          unidadesObjetivo,
          nivelesPermitidos
        )
      : [];

  if (placements.length === 0) {
    warnings.push(
      capMaxOperativa === 0
        ? "No hay capacidad operativa (0). Se muestra 1 unidad de referencia."
        : "No se generaron placements. Se muestra 1 unidad de referencia."
    );
    placements = [buildSinglePlacementOnFloor(dimInterna, input.dimUnidadMm)];
  }

  // Ocupación volumétrica (aprox)
  let ocupacionVolumetricaPct: number | null = null;
  const volInterno = mm3(dimInterna);
  const volUnidad = mm3(input.dimUnidadMm);

  if (volInterno > 0 && unidadesObjetivo > 0) {
    ocupacionVolumetricaPct = (unidadesObjetivo * volUnidad * 100) / volInterno;
  }

  const packing3d: CubicacionBulto3DInput = {
    bulto: {
      codigo: String(input.bulto.codigo ?? "").trim() || "BULTO",
      dimExternaMm: dimExterna,
      dimInternaMm: dimInterna,
      taraKg: input.bulto.taraKg ?? null,
      maxPesoKg: input.bulto.maxPesoKg ?? null,
    },
    contenido: placements.map((pos) => ({
      productoId: input.productoId,
      codigo: input.codigoProducto?.trim() || `PROD-${input.productoId}`,
      unidades: 1,
      dimUnidadMm: input.dimUnidadMm,
      positionMm: pos,
    })),
  };

  return {
    capGeometrica,
    capA2,
    capPeso: Number.isFinite(capPeso) ? capPeso : 999999999, // para debug/lectura
    capMaxOperativa,
    unidadesObjetivo,
    nivelesPermitidos,
    ocupacionVolumetricaPct,
    warnings,
    packing3d,
  };
}
