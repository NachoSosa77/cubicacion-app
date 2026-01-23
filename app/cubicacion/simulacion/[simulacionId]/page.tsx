// app/cubicacion/simulacion/[loteId]/page.tsx
import { prisma } from "@/lib/prisma";
import { SimulacionClient } from "../../components/SimulacionClient";

// AJUSTA estas rutas si en tu proyecto están en otra carpeta:
import { commitProductosYContinuar } from "../../actions/commitProductosYContinuar";
import { previewCamionPlan } from "../../actions/previewCamionPlan";
import {
  listProductosPlan,
  upsertProductoPlan,
} from "../../actions/productoPlanActions";
import { saveCamionPlan } from "../../actions/saveCamionPlan";
import { searchTipoProducto } from "../../actions/tipoProductoActions";

type PageProps = {
  params: Promise<{ simulacionId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { simulacionId } = await params;

  const simId = Number(simulacionId);
  if (!Number.isFinite(simId) || simId <= 0) {
    return (
      <div className="p-6">
        <p className="text-red-700">simulacionId inválido.</p>
      </div>
    );
  }

  // 1) Cargar simulación (cabecera)
  const simulacion = await prisma.cubicacionSimulacion.findUnique({
    where: { id: simId },
  });

  if (!simulacion) {
    return (
      <div className="p-6">
        <p className="text-slate-700">No se encontró la simulación #{simId}.</p>
      </div>
    );
  }

  // 2) Si la simulación tiene lote_id, traemos lote como antes
  const loteId = simulacion.lote_id ? Number(simulacion.lote_id) : null;

  const lote = loteId
    ? await prisma.cubicacionLote.findUnique({
        where: { id: loteId },
        include: {
          bulto_empresa: true,
          items: {
            include: { tipo_producto: true },
            orderBy: { id: "asc" },
          },
        },
      })
    : null;

  // empresaId: preferimos simulación.empresa_id; fallback a lote; fallback 1
  const empresaId =
    (simulacion.empresa_id as number | null) ??
    (lote?.empresa_id as number | undefined) ??
    1;

  // 3) Catálogos (igual que antes)
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

  // === NUEVO: Transportes para Step Camión ===
  const transportes = await prisma.transporteClasificacion.findMany({
    orderBy: { denominacion_de_vehiculo: "asc" },
    select: {
      id: true,
      denominacion_de_vehiculo: true,
      mt_largo_cub: true,
      mt_ancho_cub: true,
      mt_alto_cub: true,
      max_peso_kg: true,
    },
  });

  // 4) Pallet summary: por ahora se deriva del lote (si existe)
  const palletPlans = lote
    ? await prisma.cubicacionPalletPlan.findMany({
        where: { loteId: lote.id }, // AJUSTA si tu modelo usa lote_id
        select: {
          id: true,
          peso_total_kg: true,
          updatedAt: true, // AJUSTA si es updated_at
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const palletsGuardados = palletPlans.length;
  const pesoEstimadoKg = palletPlans.reduce(
    (acc, p) => acc + Number(p.peso_total_kg ?? 0),
    0
  );
  const lastUpdatedAt = palletPlans[0]?.updatedAt ?? null;

  const palletSummary = {
    palletsGuardados,
    pesoEstimadoKg,
    lastUpdatedAt: lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : null,
  };

  // 5) Server actions wrappers: ahora pasan simulacionId además de loteId (si hay)
  async function onPreviewCamion(form: { transporteId: number }) {
    "use server";
    if (!lote) {
      throw new Error("La simulación no tiene lote asociado.");
    }
    return previewCamionPlan({
      empresaId,
      loteId: lote.id,
      transporteId: form.transporteId,
    });
  }

  async function onGuardarCamion(payload: {
    transporteId: number;
    strategy: "ESTABLE" | "OPTIMIZAR" | "DESCARGA_RAPIDA";
    status?: "BORRADOR" | "SELECCIONADO" | "DESCARTADO";
    plan: any;
  }) {
    "use server";
    if (!lote) {
      throw new Error("La simulación no tiene lote asociado.");
    }
    return saveCamionPlan({
      empresaId,
      loteId: lote.id,
      transporteId: payload.transporteId,
      strategy: payload.strategy,
      status: payload.status,
      plan: payload.plan,
    });
  }

  async function onContinuarABulto() {
  "use server";
  await commitProductosYContinuar(simId); // crea/asegura lote + sync items + totales
  }

  const loteClient = lote
    ? {
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
      }
    : null;

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

  const productosPlan = await listProductosPlan(simId);

  async function onUpsertProductoPlan(input: {
  codigo: string;
  cantidad_unidades: number;
  tipo_producto_id?: number | null;
  largo_unidad_mm?: unknown;
  ancho_unidad_mm?: unknown;
  alto_unidad_mm?: unknown;
  peso_unidad_kg?: number | null;
}) {
  "use server";
  await upsertProductoPlan(simId, input);
}

  async function onSearchTipoProducto(form: { q: string }) {
    "use server";
    return searchTipoProducto(form.q);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-6 space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">
              Simulación de cubicación
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Simulación #{simId}
              {lote
                ? ` · Lote #${lote.id}${lote.descripcion ? ` · ${lote.descripcion}` : ""}`
                : " · (sin lote)"}{" "}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
              Estado: {String(simulacion?.status)}{" "}
            </span>
            <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
              Empresa: {empresaId}{" "}
            </span>
            {lote ? (
              <>
                <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
                  Tipo bulto: {lote.tipo_bulto}
                </span>
                <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
                  Ítems: {lote.items.length}
                </span>
              </>
            ) : null}
          </div>
        </header>

        <main className="rounded-2xl border bg-white p-4 shadow-sm">
          <SimulacionClient
            simulacionId={simId}
            simulacionLoteId={simulacion?.lote_id ? Number(simulacion.lote_id) : null}
            empresaId={empresaId}
            lote={loteClient as any}
            contenedores={contenedoresClient as any}
            empresaBultos={empresaBultos as any}
            transportes={transportes as any}
            palletSummary={palletSummary as any}
            onPreviewCamion={onPreviewCamion}
            onGuardarCamion={onGuardarCamion}
            productosPlan={productosPlan}
            onUpsertProductoPlan={onUpsertProductoPlan}
            onSearchTipoProducto={onSearchTipoProducto}
            onContinuarABulto={onContinuarABulto}
          />
        </main>
      </div>
    </div>
  );
} 
