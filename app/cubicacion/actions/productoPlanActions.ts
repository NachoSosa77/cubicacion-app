// app/cubicacion/actions/productoPlanActions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type DimMm = { largo: number; ancho: number; alto: number };

export type ProductoPlanUpsertInput = {
  codigo: string;
  descripcion?: string | null;
  cantidad_unidades: number;

  tipo_producto_id?: number | null;

  // Puede venir como objeto (desde client) o lo armamos desde campos sueltos (desde form)
  dim_unidad_mm?: any | null;

  // Alternativa compatible con <form action>: campos sueltos
  largo_unidad_mm?: unknown;
  ancho_unidad_mm?: unknown;
  alto_unidad_mm?: unknown;

  // opcional
  peso_unidad_kg?: number | null;
};

function toPosNumber(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function toDimMmFromObject(v: any): DimMm | null {
  if (!v) return null;

  // soporta llaves comunes
  const largo = toPosNumber(v.largo ?? v.largo_mm ?? v.l);
  const ancho = toPosNumber(v.ancho ?? v.ancho_mm ?? v.a);
  const alto = toPosNumber(v.alto ?? v.alto_mm ?? v.h);

  if (!largo || !ancho || !alto) return null;
  return { largo, ancho, alto };
}

function toDimMmFromLooseFields(input: ProductoPlanUpsertInput): DimMm | null {
  const largo = toPosNumber(input.largo_unidad_mm);
  const ancho = toPosNumber(input.ancho_unidad_mm);
  const alto = toPosNumber(input.alto_unidad_mm);
  if (!largo || !ancho || !alto) return null;
  return { largo, ancho, alto };
}

export async function listProductosPlan(simulacionId: number) {
  return prisma.cubicacionProductoPlan.findMany({
    where: { simulacion_id: simulacionId },
    orderBy: { id: "asc" },
  });
}

export async function upsertProductoPlan(
  simulacionId: number,
  input: ProductoPlanUpsertInput
) {
  const codigo = (input.codigo ?? "").trim();
  if (!codigo) throw new Error("codigo requerido");

  const cantidad = Number(input.cantidad_unidades);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new Error("cantidad_unidades inválida");
  }

  // 1) dim unidad (obligatorio)
  const dimUnidad: DimMm | null =
    toDimMmFromObject(input.dim_unidad_mm) ?? toDimMmFromLooseFields(input);

  if (!dimUnidad) {
    throw new Error("dim_unidad_mm requerido (largo/ancho/alto > 0)");
  }

  // 2) Si viene tipo_producto_id, completamos defaults desde catálogo
  const tipoProductoId =
    typeof input.tipo_producto_id === "number" && input.tipo_producto_id > 0
      ? input.tipo_producto_id
      : null;

  const tipo = tipoProductoId
    ? await prisma.tipoProducto.findUnique({
        where: { id: tipoProductoId },
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          unidad_entra_por_bulto: true,
          largo_por_bulto: true,
          ancho_por_bulto: true,
          alto_por_bulto: true,
          peso_por_unidad_venta: true, // Decimal?
        },
      })
    : null;

  const descripcion =
    input.descripcion ?? (tipo?.descripcion ? String(tipo.descripcion) : null);

  const unidadesPorBulto =
    typeof tipo?.unidad_entra_por_bulto === "number" &&
    tipo.unidad_entra_por_bulto > 0
      ? tipo.unidad_entra_por_bulto
      : null;

  const dimBultoMm: DimMm | null =
    tipo &&
    typeof tipo.largo_por_bulto === "number" &&
    typeof tipo.ancho_por_bulto === "number" &&
    typeof tipo.alto_por_bulto === "number" &&
    tipo.largo_por_bulto > 0 &&
    tipo.ancho_por_bulto > 0 &&
    tipo.alto_por_bulto > 0
      ? {
          largo: tipo.largo_por_bulto,
          ancho: tipo.ancho_por_bulto,
          alto: tipo.alto_por_bulto,
        }
      : null;

  const pesoUnidad =
    input.peso_unidad_kg != null
      ? Number(input.peso_unidad_kg)
      : tipo?.peso_por_unidad_venta != null
        ? Number(tipo.peso_por_unidad_venta)
        : null;

  return prisma.cubicacionProductoPlan.upsert({
    where: {
      simulacion_id_codigo: {
        simulacion_id: simulacionId,
        codigo,
      },
    },
    create: {
      simulacion_id: simulacionId,
      codigo,
      descripcion,
      cantidad_unidades: cantidad,

      tipo_producto_id: tipoProductoId,

      // JSON: nunca mandar null literal; si no hay, undefined
      dim_unidad_mm: dimUnidad as Prisma.InputJsonValue,
      peso_unidad_kg: Number.isFinite(pesoUnidad as any) ? pesoUnidad : null,

      unidades_por_bulto: unidadesPorBulto,
      dim_bulto_mm: dimBultoMm
        ? (dimBultoMm as Prisma.InputJsonValue)
        : undefined,
    },
    update: {
      descripcion,
      cantidad_unidades: cantidad,

      tipo_producto_id: tipoProductoId,

      dim_unidad_mm: dimUnidad as Prisma.InputJsonValue,
      peso_unidad_kg: Number.isFinite(pesoUnidad as any) ? pesoUnidad : null,

      // si hay defaults, los completamos; si no, no tocamos
      unidades_por_bulto: unidadesPorBulto ?? undefined,
      dim_bulto_mm: dimBultoMm
        ? (dimBultoMm as Prisma.InputJsonValue)
        : undefined,
    },
  });
}
