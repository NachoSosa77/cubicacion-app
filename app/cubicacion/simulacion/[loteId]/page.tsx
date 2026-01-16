// app/cubicacion/simulacion/[loteId]/page.tsx
import { prisma } from "@/lib/prisma";
import { SimulacionClient } from "../../components/SimulacionClient";

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

  // ✅ EmpresaId: idealmente viene del lote (si tu modelo lo tiene)
  // Si tu modelo no tiene empresa_id, dejalo fijo en 1 por ahora.
  const empresaId =
    (lote.empresa_id as number | undefined) ?? 1;

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

  const empresaBultos = await prisma.empresaBulto.findMany({
    where: {
      empresa_id: empresaId,
      habilitado: true,
      deleted_at: null,
    },
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
  <div className="min-h-screen bg-slate-50">
    <div className="mx-auto max-w-6xl p-6 space-y-4">
      {/* Header de pantalla */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">
            Simulación de cubicación
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Lote #{lote.id}
            {lote.descripcion ? ` · ${lote.descripcion}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
          <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
            Tipo bulto: {lote.tipo_bulto}
          </span>
          <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
            Ítems: {lote.items.length}
          </span>
          <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
            Empresa: {empresaId}
          </span>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="rounded-2xl border bg-white p-4 shadow-sm">
        <SimulacionClient
          empresaId={empresaId}
          lote={loteClient as any}
          contenedores={contenedoresClient as any}
          empresaBultos={empresaBultos as any}
        />
      </main>
    </div>
  </div>
);

}
