// app/cubicacion/pallet/[loteId]/page.tsx
import { prisma } from "@/lib/prisma";
import { PalletClient } from "./PalletClient";

type PageProps = {
  params: Promise<{ loteId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { loteId } = await params;

  const id = Number(loteId);
  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="p-6">
        <p className="text-red-700">loteId inválido.</p>
      </div>
    );
  }

  const lote = await prisma.cubicacionLote.findUnique({
    where: { id },
    include: {
      bulto_empresa: true,
      items: {
        include: { tipo_producto: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!lote) {
    return (
      <div className="p-6">
        <p className="text-slate-700">No se encontró el lote #{id}.</p>
      </div>
    );
  }

  const contenedores = await prisma.tipoContenedor.findMany({
    where: { habilitado: true },
    orderBy: { descripcion: "asc" },
    select: {
      id: true,
      codigo: true,
      descripcion: true,
      largo_mts: true,
      ancho_mts: true,
      alto_mts: true,
      peso_max_kg: true,
      peso_pallet_kg: true,
    },
  });

  const loteClient = {
    id: lote.id,
    descripcion: lote.descripcion ?? null,
    unidades_totales: lote.unidades_totales ?? 0,
    bultos_totales: lote.bultos_totales ?? 0,
    packing_policy: lote.packing_policy,
    tipo_bulto: lote.tipo_bulto,
    bulto_empresa_id: lote.bulto_empresa_id ?? null,
    bulto_layout: lote.bulto_layout ?? null,
    items: lote.items.map((it) => ({
      id: it.id,
      tipo_producto_id: it.tipo_producto_id,
      cantidad_unidades: it.cantidad_unidades,
      cantidad_bultos: it.cantidad_bultos,
      unidades_por_bulto: it.unidades_por_bulto ?? null,
      volumen_total_m3: it.volumen_total_m3,
      dim_unidad_mm: it.dim_unidad_mm ?? null,
      peso_unidad_kg: it.peso_unidad_kg ?? null,
      tipo_producto: {
        id: it.tipo_producto.id,
        codigo: it.tipo_producto.codigo,
        descripcion: it.tipo_producto.descripcion,
        unidad_entra_por_bulto: it.tipo_producto.unidad_entra_por_bulto,
        largo_por_bulto: it.tipo_producto.largo_por_bulto,
        ancho_por_bulto: it.tipo_producto.ancho_por_bulto,
        alto_por_bulto: it.tipo_producto.alto_por_bulto,
      },
    })),
  };

  const contenedoresClient = contenedores.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descripcion: c.descripcion,
    largo_mts: c.largo_mts,
    ancho_mts: c.ancho_mts,
    alto_mts: c.alto_mts,
    peso_max_kg: c.peso_max_kg,
    peso_pallet_kg: c.peso_pallet_kg ?? null,
  }));

  return (
    <div className="p-6">
      <PalletClient lote={loteClient as any} contenedores={contenedoresClient as any} empresaId={1} />
    </div>
  );
}
