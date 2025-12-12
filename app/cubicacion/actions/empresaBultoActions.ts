"use server";

import { prisma } from "@/lib/prisma";
// Si tenés un helper de auth, úsalo. Ej: getLoggedUser()
// import { getLoggedUser } from "@/utils/auth/getLoggedUser";

export type IEmpresaBulto = {
  id: number;
  empresa_id: number;
  codigo: string;
  descripcion: string | null;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  espesor_pared_mm: number;
  tara_kg: number | null;
  max_peso_kg: number | null;
  es_preferido: boolean;
  habilitado: boolean;
};

export async function getEmpresaBultosByEmpresaId(
  empresaId: number
): Promise<IEmpresaBulto[]> {
  const rows = await prisma.empresaBulto.findMany({
    where: { empresa_id: empresaId, habilitado: true, deleted_at: null },
    orderBy: [{ es_preferido: "desc" }, { codigo: "asc" }],
    select: {
      id: true,
      empresa_id: true,
      codigo: true,
      descripcion: true,
      largo_mm: true,
      ancho_mm: true,
      alto_mm: true,
      espesor_pared_mm: true,
      tara_kg: true,
      max_peso_kg: true,
      es_preferido: true,
      habilitado: true,
    },
  });

  return rows;
}

/**
 * Variante si querés traer por usuario logueado (recomendado):
 * Ajustá esto a TU auth real.
 */
// export async function getEmpresaBultos(): Promise<IEmpresaBulto[]> {
//   const user = await getLoggedUser();
//   const empresaId = user?.empresa?.id;
//   if (!empresaId) return [];
//   return getEmpresaBultosByEmpresaId(empresaId);
// }
