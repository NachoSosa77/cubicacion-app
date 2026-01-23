"use server";

import { prisma } from "@/lib/prisma";

export type TipoProductoSearchItem = {
  id: number;
  codigo: string;
  descripcion: string;

  // cubicación base (bulto)
  unidad_entra_por_bulto: number;
  largo_por_bulto: number;
  ancho_por_bulto: number;
  alto_por_bulto: number;

  // para snapshot/peso (venta)
  peso_por_unidad_venta: string | null; // Decimal -> string en Prisma

  // opcionales útiles si querés más adelante
  peso_por_bulto: string | null;
  volumen_por_bulto: string | null;
};

export async function searchTipoProducto(
  query: string
): Promise<TipoProductoSearchItem[]> {
  const q = (query ?? "").trim();
  if (!q) return [];

  // Evitar queries enormes
  const qSafe = q.slice(0, 60);

  const rows = await prisma.tipoProducto.findMany({
    where: {
      habilitado: true,
      deleted_at: null,
      OR: [
        { codigo: { contains: qSafe } },
        { descripcion: { contains: qSafe } },
      ],
    },
    select: {
      id: true,
      codigo: true,
      descripcion: true,

      unidad_entra_por_bulto: true,
      largo_por_bulto: true,
      ancho_por_bulto: true,
      alto_por_bulto: true,

      peso_por_unidad_venta: true,
      peso_por_bulto: true,
      volumen_por_bulto: true,
    },
    orderBy: [{ codigo: "asc" }],
    take: 20,
  });

  // Normalizar Decimal => string (por seguridad)
  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    descripcion: r.descripcion,

    unidad_entra_por_bulto: r.unidad_entra_por_bulto,
    largo_por_bulto: r.largo_por_bulto,
    ancho_por_bulto: r.ancho_por_bulto,
    alto_por_bulto: r.alto_por_bulto,

    peso_por_unidad_venta: r.peso_por_unidad_venta?.toString() ?? null,
    peso_por_bulto: r.peso_por_bulto?.toString() ?? null,
    volumen_por_bulto: r.volumen_por_bulto?.toString() ?? null,
  }));
}
