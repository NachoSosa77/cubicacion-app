// app/cubicacion/pallet/[loteId]/page.tsx
import { prisma } from "@/lib/prisma";
import { PalletClient } from "./PalletClient";

// Importá tus server actions reales (ajustá rutas/nombres)
import { previewPalletPlan } from "@/app/cubicacion/actions/previewPalletPlan";
import { savePalletPlan } from "@/app/cubicacion/actions/savePalletPlan";

export default async function Page({
  params,
}: {
  params: Promise<{ loteId: string }>;
}) {
  const { loteId } = await params;
  const id = Number(loteId);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="p-6">
        <p className="text-red-600">loteId inválido.</p>
      </div>
    );
  }

  // ✅ IMPORTANTE: relaciones snake_case según tu schema
  const loteDb = await prisma.cubicacionLote.findUnique({
    where: { id },
    include: {
      bulto_empresa: true, // ✅ NO bultoEmpresa
      items: {
        include: {
          tipo_producto: {
            select: {
              id: true,
              codigo: true,
              descripcion: true,
              unidad_entra_por_bulto: true,
              largo_por_bulto: true,
              ancho_por_bulto: true,
              alto_por_bulto: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!loteDb) {
    return (
      <div className="p-6">
        <p className="text-slate-700">Lote no encontrado.</p>
      </div>
    );
  }

  const contenedores = await prisma.tipoContenedor.findMany({
    where: { habilitado: true, deleted_at: null },
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

  // ✅ Adaptación: PalletClient hoy está tipado con camelCase adentro de items (tipoProductoId, tipoProducto)
  // Como tu DB ahora es snake_case, tenés 2 caminos:
  // A) cambiar PalletClient para que use snake_case (recomendado),
  // B) mapear acá a lo que espera PalletClient (rápido y seguro).
  //
  // Te dejo el B para destrabar ya:

  const lote = {
    id: loteDb.id,
    descripcion: loteDb.descripcion ?? null,
    items: loteDb.items.map((it) => ({
      id: it.id,
      tipoProductoId: it.tipo_producto_id, // 👈 mapeo
      cantidad_unidades: it.cantidad_unidades,
      cantidad_bultos: it.cantidad_bultos,
      unidades_por_bulto: it.unidades_por_bulto ?? null,
      volumen_total_m3: it.volumen_total_m3,
      dim_unidad_mm: it.dim_unidad_mm ?? null,
      peso_unidad_kg: it.peso_unidad_kg ?? null,
      tipoProducto: {
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

  return (
    <div className="p-6">
      <PalletClient
        lote={lote as any}
        contenedores={contenedores as any}
        onPreview={async (params) => {
          "use server";
          return previewPalletPlan({ loteId: loteDb.id, ...params });
        }}
        onGuardar={async (params) => {
          "use server";
          return savePalletPlan({ loteId: loteDb.id, ...params });
        }}
      />
    </div>
  );
}
