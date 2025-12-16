// app/cubicacion/actions/saveCubicacionLote.ts
"use server";

import { prisma } from "@/lib/prisma";
import type { PackingPolicy, TipoBultoSeleccionado } from "@prisma/client";
import { toPlain } from "../lib/toPlain";

export type SaveLoteInput = {
  empresaId: number;
  descripcion?: string | null;
  packingPolicy: PackingPolicy;
  tipoBulto: TipoBultoSeleccionado;
  bultoEmpresaId?: number | null;

  items: {
    tipoProductoId: number;
    cantidadUnidades: number;
    volumenTotalM3: number;
    dimUnidadMm?: { largo: number; ancho: number; alto: number } | null;
    pesoUnidadKg?: number | null;
  }[];
};

export async function saveCubicacionLote(input: SaveLoteInput) {
  const lote = await prisma.cubicacionLote.create({
    data: {
      empresaId: input.empresaId,
      descripcion: input.descripcion ?? null,
      packing_policy: input.packingPolicy,
      tipo_bulto: input.tipoBulto,
      bulto_empresa_id: input.bultoEmpresaId ?? null,
      items: {
        create: input.items.map((it) => ({
          tipoProductoId: it.tipoProductoId,
          cantidad_unidades: it.cantidadUnidades,
          volumen_total_m3: it.volumenTotalM3,
          dim_unidad_mm: it.dimUnidadMm ? (it.dimUnidadMm as any) : null,
          peso_unidad_kg: it.pesoUnidadKg ?? null,
        })),
      },
    },
    select: { id: true },
  });

  return toPlain(lote); // { id }
}
