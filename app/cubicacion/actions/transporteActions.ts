import { prisma } from "@/lib/prisma";

// app/cubicacion/actions/transporteActions.ts (o similar)
export interface ITransporteClasificacion {
  id: number;
  denominacion_de_vehiculo: string;
  mt_largo_cub: number;
  mt_ancho_cub: number;
  mt_alto_cub: number;
  max_peso_kg: number;
}

// Mejor nombre para no confundir con la tabla "transporte"
export async function getTransporteClasificaciones(): Promise<
  ITransporteClasificacion[]
> {
  const rows = await prisma.transporteClasificacion.findMany({
    orderBy: {
      denominacion_de_vehiculo: "asc",
    },
    select: {
      id: true,
      denominacion_de_vehiculo: true,
      mt_largo_cub: true,
      mt_ancho_cub: true,
      mt_alto_cub: true,
      max_peso_kg: true,
    },
  });

  // Mapeamos al shape que espera el front
  return rows.map((r) => ({
    id: r.id,
    denominacion_de_vehiculo: r.denominacion_de_vehiculo,
    mt_largo_cub: r.mt_largo_cub,
    mt_ancho_cub: r.mt_ancho_cub,
    mt_alto_cub: r.mt_alto_cub,
    max_peso_kg: r.max_peso_kg,
  }));
}
