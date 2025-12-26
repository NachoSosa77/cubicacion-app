// src/app/cubicacion/actions/saveMultiProductoConfiguracion.ts
"use server";

import { prisma } from "@/lib/prisma";
import type { PackingPolicy } from "../lib/packing-policy";

export interface MultiProductoConfiguracionItemInput {
  tipoProductoId: number;
  cantidadUnidades: number;
  cantidadBultos: number; // hoy no se persiste en lote_item (tu modelo no lo tiene)
  volumenTotalM3: number;
}

export interface MultiProductoConfiguracionInput {
  descripcion?: string | null;
  packingPolicy: PackingPolicy;
  tipoBulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bultoEmpresaId?: number | null;
  items: MultiProductoConfiguracionItemInput[];
}

export type SaveMultiProductoConfiguracionResult = {
  loteId: number;
};

function assertValidInput(input: MultiProductoConfiguracionInput) {
  if (!input.items?.length) throw new Error("No hay ítems para guardar.");

  for (const [idx, it] of input.items.entries()) {
    if (!Number.isInteger(it.tipoProductoId) || it.tipoProductoId <= 0) {
      throw new Error(`Item ${idx + 1}: tipoProductoId inválido.`);
    }
    if (!Number.isFinite(it.cantidadUnidades) || it.cantidadUnidades <= 0) {
      throw new Error(`Item ${idx + 1}: cantidadUnidades inválida.`);
    }
    if (!Number.isFinite(it.volumenTotalM3) || it.volumenTotalM3 <= 0) {
      throw new Error(`Item ${idx + 1}: volumenTotalM3 inválido.`);
    }
  }

  if (input.tipoBulto === "EMPRESA_BULTO") {
    // En modo empresa, bultoEmpresaId debería venir
    if (
      input.bultoEmpresaId == null ||
      !Number.isInteger(input.bultoEmpresaId) ||
      input.bultoEmpresaId <= 0
    ) {
      throw new Error("bultoEmpresaId inválido para tipoBulto EMPRESA_BULTO.");
    }
  } else {
    // En estándar, lo normal es null
    // (no tiramos error si viene, pero podrías forzarlo a null)
  }
}

export async function saveMultiProductoConfiguracion(
  input: MultiProductoConfiguracionInput
): Promise<SaveMultiProductoConfiguracionResult> {
  assertValidInput(input);

  const empresaId = 1; // TODO: derivar desde usuario logueado

  // Prearmamos data fuera (reduce aún más el tiempo dentro de tx)
  const itemsData = input.items.map((it) => ({
    tipoProductoId: it.tipoProductoId,
    cantidad_unidades: it.cantidadUnidades,
    volumen_total_m3: it.volumenTotalM3,
  }));

  const res = await prisma.$transaction(
    async (tx) => {
      // 1) lote
      const lote = await tx.cubicacionLote.create({
        data: {
          empresaId,
          descripcion: input.descripcion ?? null,
          packing_policy: input.packingPolicy as any,
          tipo_bulto: input.tipoBulto as any,
          bulto_empresa_id:
            input.tipoBulto === "EMPRESA_BULTO"
              ? input.bultoEmpresaId ?? null
              : null,
        },
        select: { id: true },
      });

      // 2) items (1 query)
      await tx.cubicacionLoteItem.createMany({
        data: itemsData.map((d) => ({
          loteId: lote.id,
          ...d,
        })),
      });

      return { loteId: lote.id };
    },
    {
      // IMPORTANTE: evita P2028 cuando hay latencia/espera de conexión
      maxWait: 10_000, // cuánto espera para conseguir conexión
      timeout: 20_000, // cuánto dura la transacción interactiva
    }
  );

  return res;
}
