import { CubicacionCamionViewer3D } from "@/app/cubicacion/components/CubicacionCamionViewer3D";
import { toPlain } from "@/app/cubicacion/lib/toPlain";
import { prisma } from "@/lib/prisma";

export default async function CamionPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const camionPlanId = Number(id);

  if (!Number.isFinite(camionPlanId) || camionPlanId <= 0) {
    return <div className="p-6">id inválido: {String(id)}</div>;
  }

  const plan = await prisma.cubicacionCamionPlan.findUnique({
    where: { id: camionPlanId },
    include: {
      lote: true,
      transporte: true,
    },
  });

  if (!plan) return <div className="p-6">Plan no encontrado.</div>;

  const layout = plan.layout as any;

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-md border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-slate-500">Plan guardado</p>
            <p className="text-lg font-semibold text-slate-900">
              Camión Plan #{plan.id}
            </p>
            <p className="text-sm text-slate-700">
              Lote #{plan.loteId} · Transporte #{plan.transporteId} · Strategy:{" "}
              <span className="font-semibold">{String(plan.strategy)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md border bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Pallets en camión</p>
              <p className="font-semibold">{plan.pallets_en_camion}</p>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Camiones</p>
              <p className="font-semibold">{plan.camiones_requeridos}</p>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Ocupación base</p>
              <p className="font-semibold">{Number(plan.ocupacion_base_pct).toFixed(1)}%</p>
            </div>
            <div className="rounded-md border bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Peso total</p>
              <p className="font-semibold">{plan.peso_total_kg.toFixed(1)} kg</p>
            </div>
          </div>
        </div>
      </div>

      <CubicacionCamionViewer3D
        camionDimMm={toPlain(layout.camionDimMm)}
        placements={toPlain(layout.placements)}
      />
    </div>
  );
}
