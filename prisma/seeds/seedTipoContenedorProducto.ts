// prisma/seeds/seedTipoContenedorProducto.ts
import { PrismaClient } from "@prisma/client";

export async function seedTipoContenedorProducto(prisma: PrismaClient) {
  console.log("🔗 Creando relaciones tipo_contenedor_producto...");

  const contenedores = await prisma.tipoContenedor.findMany({
    where: { habilitado: true, deleted_at: null },
    select: { id: true, codigo: true },
  });

  const productos = await prisma.tipoProducto.findMany({
    where: { habilitado: true, deleted_at: null },
    select: { id: true, codigo: true },
  });

  const byC = new Map(contenedores.map((c) => [c.codigo, c]));
  const byP = new Map(productos.map((p) => [p.codigo, p]));

  const pickC = (codigo: string) => {
    const c = byC.get(codigo);
    if (!c) throw new Error(`No existe TipoContenedor ${codigo}`);
    return c.id;
  };

  const pickP = (codigo: string) => {
    const p = byP.get(codigo);
    if (!p) throw new Error(`No existe TipoProducto ${codigo}`);
    return p.id;
  };

  // Demo: habilitamos los 4 productos en los 3 pallets
  const palletCodes = ["PALLET-AMERICANO", "PALLET-ARLOG", "PALLET-EUROPALETA"];
  const prodCodes = [
    "CM0916BM",
    "GALLETAS-TEST-CAJA12",
    "CAFÉ-TEST-CAJA6",
    "ARROZ-TEST-BOLSA10",
  ];

  const rows = [];
  for (const pc of palletCodes) {
    for (const pr of prodCodes) {
      rows.push({
        tipo_contenedor_id: pickC(pc),
        tipo_producto_id: pickP(pr),
        cantidad_max_items: 999999, // default amplio; el “pro” lo controlamos con reglas
      });
    }
  }

  // Upsert manual (porque es tabla con @@id compuesto)
  for (const r of rows) {
    await prisma.tipoContenedorProducto.upsert({
      where: {
        tipo_contenedor_id_tipo_producto_id: {
          tipo_contenedor_id: r.tipo_contenedor_id,
          tipo_producto_id: r.tipo_producto_id,
        },
      },
      update: { cantidad_max_items: r.cantidad_max_items },
      create: r,
    });
  }

  console.log(`✅ tipo_contenedor_producto listo (${rows.length} relaciones).`);
}
