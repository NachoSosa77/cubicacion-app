// prisma/seeds/seedEmpresaBulto.ts
import { PrismaClient } from "@prisma/client";

type BultoSeed = {
  codigo: string;
  descripcion?: string | null;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  espesor_pared_mm: number;
  tara_kg?: number | null;
  max_peso_kg?: number | null;
  es_preferido?: boolean;
  habilitado?: boolean;
};

function calcInternas(b: BultoSeed) {
  const e = Math.max(0, Number(b.espesor_pared_mm ?? 0));
  const largo_int = b.largo_mm - 2 * e;
  const ancho_int = b.ancho_mm - 2 * e;
  const alto_int = b.alto_mm - 2 * e;

  if (largo_int <= 0 || ancho_int <= 0 || alto_int <= 0) {
    throw new Error(
      `Dimensiones internas inválidas para ${b.codigo}. ` +
        `Externas: ${b.largo_mm}x${b.ancho_mm}x${b.alto_mm} mm, espesor=${e} mm → ` +
        `Internas: ${largo_int}x${ancho_int}x${alto_int} mm`,
    );
  }

  return {
    largo_int_mm: largo_int,
    ancho_int_mm: ancho_int,
    alto_int_mm: alto_int,
  };
}

export async function seedEmpresaBulto(prisma: PrismaClient) {
  const empresas = await prisma.empresa.findMany({
    where: { habilitado: true, deleted_at: null },
    orderBy: { id: "asc" },
    select: { id: true, razon_social: true },
  });

  if (!empresas.length) {
    throw new Error(
      "No existe ninguna empresa habilitada para asociar bultos.",
    );
  }

  // 6 bultos (3 existentes + 3 nuevos) con variedad para testear:
  // - chico ecommerce
  // - estándar ecommerce (preferido)
  // - grande voluminosos livianos
  // - flat / bajo (tipo sobres/catálogos)
  // - cubo mediano robusto (mayor espesor, mayor carga)
  // - extra grande (para ver límites de packing)
  const bultos: BultoSeed[] = [
    {
      codigo: "CAJA-30x20x15",
      descripcion: "Caja chica (repuestos pequeños)",
      largo_mm: 300,
      ancho_mm: 200,
      alto_mm: 150,
      espesor_pared_mm: 3,
      tara_kg: 0.25,
      max_peso_kg: 8,
      es_preferido: false,
      habilitado: true,
    },
    {
      codigo: "CAJA-40x30x25",
      descripcion: "Caja estándar ecommerce",
      largo_mm: 400,
      ancho_mm: 300,
      alto_mm: 250,
      espesor_pared_mm: 4,
      tara_kg: 0.45,
      max_peso_kg: 15,
      es_preferido: true,
      habilitado: true,
    },
    {
      codigo: "CAJA-60x40x40",
      descripcion: "Caja grande (voluminosos livianos)",
      largo_mm: 600,
      ancho_mm: 400,
      alto_mm: 400,
      espesor_pared_mm: 5,
      tara_kg: 0.9,
      max_peso_kg: 20,
      es_preferido: false,
      habilitado: true,
    },

    // ✅ NUEVOS (3 más)
    {
      codigo: "CAJA-35x25x10",
      descripcion: "Caja baja / plana (catálogos, textiles plegados)",
      largo_mm: 350,
      ancho_mm: 250,
      alto_mm: 100,
      espesor_pared_mm: 3,
      tara_kg: 0.22,
      max_peso_kg: 6,
      es_preferido: false,
      habilitado: true,
    },
    {
      codigo: "CAJA-50x50x40",
      descripcion: "Caja cubo mediana (fragiles, mejor apilado)",
      largo_mm: 500,
      ancho_mm: 500,
      alto_mm: 400,
      espesor_pared_mm: 6,
      tara_kg: 1.2,
      max_peso_kg: 25,
      es_preferido: false,
      habilitado: true,
    },
    {
      codigo: "CAJA-80x60x60",
      descripcion: "Caja extra grande (bultos voluminosos, test límites)",
      largo_mm: 800,
      ancho_mm: 600,
      alto_mm: 600,
      espesor_pared_mm: 7,
      tara_kg: 2.2,
      max_peso_kg: 35,
      es_preferido: false,
      habilitado: true,
    },
  ];

  for (const emp of empresas) {
    for (const b of bultos) {
      const internas = calcInternas(b);

      await prisma.empresaBulto.upsert({
        where: {
          empresa_id_codigo: {
            empresa_id: emp.id,
            codigo: b.codigo,
          },
        },
        update: {
          ...b,
          ...internas,
          empresa_id: emp.id,
        },
        create: {
          ...b,
          ...internas,
          empresa_id: emp.id,
        },
      });
    }

    console.log(
      `Seed EmpresaBulto OK → ${bultos.length} bultos para empresa ${emp.razon_social}`,
    );
  }
}
