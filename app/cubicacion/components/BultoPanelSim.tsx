"use client";

import { useEffect, useMemo, useState } from "react";
import { listProductosPlan } from "../actions/productoPlanActions";
import { BultoPanel } from "../simulacion/[simulacionId]/BultoPanel";

type EmpresaBulto = {
  id: number;
  empresa_id: number;
  codigo: string;
  descripcion?: string | null;
  largo_mm: number;
  ancho_mm: number;
  alto_mm: number;
  espesor_pared_mm: number;
  tara_kg?: number | null;
  max_peso_kg?: number | null;
  es_preferido: boolean;
  habilitado: boolean;
};

type TipoProductoMini = {
  id: number;
  codigo: string;
  descripcion: string;
  unidad_entra_por_bulto: number;
  largo_por_bulto: number;
  ancho_por_bulto: number;
  alto_por_bulto: number;
};

type ProductoPlanRow = {
  id: number;
  simulacion_id: number;
  tipo_producto_id: number | null;
  codigo: string;
  descripcion: string | null;

  cantidad_unidades: number;
  cantidad_bultos: number;
  unidades_por_bulto: number | null;

  dim_unidad_mm: any | null;
  peso_unidad_kg: number | null;

  dim_bulto_mm: any | null; // {largo,ancho,alto} si lo guardaste
};

type ClientLoteItem = {
  id: number;
  tipo_producto_id: number;
  cantidad_unidades: number;
  cantidad_bultos: number;
  unidades_por_bulto?: number | null;
  dim_unidad_mm?: any | null;
  peso_unidad_kg?: number | null;
  tipo_producto: TipoProductoMini;
};

type ClientLote = {
  id: number;
  descripcion: string | null | undefined;
  tipo_bulto: "PRODUCTO_ESTANDAR" | "EMPRESA_BULTO";
  bulto_empresa_id?: number | null;
  unidades_totales: number;
  bultos_totales: number;
  items: ClientLoteItem[];
};

export function BultoPanelSim({
  simulacionId,
  empresaBultos,
  onApply,
}: {
  simulacionId: number;
  empresaBultos: EmpresaBulto[];
  onApply: (snap: any) => void;
}) {
  const [rows, setRows] = useState<ProductoPlanRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await listProductosPlan(simulacionId);
      if (!alive) return;
      setRows(r as any);
    })();
    return () => {
      alive = false;
    };
  }, [simulacionId]);

  const loteVirtual = useMemo<ClientLote | null>(() => {
    if (!rows) return null;

    // filtramos los que no están linkeados a tipo_producto (por ahora)
    const valid = rows.filter((p) => p.tipo_producto_id != null);

    const items: ClientLoteItem[] = valid.map((p, idx) => {
      const dimBulto = p.dim_bulto_mm as any;
      const tipoProducto: TipoProductoMini = {
        id: p.tipo_producto_id!,
        codigo: p.codigo,
        descripcion: p.descripcion ?? p.codigo,
        // fallback: si unidades_por_bulto es null, lo dejamos en 1 (pero tu action ya lo completa)
        unidad_entra_por_bulto: p.unidades_por_bulto ?? 1,
        largo_por_bulto: dimBulto?.largo ?? 0,
        ancho_por_bulto: dimBulto?.ancho ?? 0,
        alto_por_bulto: dimBulto?.alto ?? 0,
      };

      return {
        id: idx + 1, // id virtual
        tipo_producto_id: p.tipo_producto_id!,
        cantidad_unidades: p.cantidad_unidades,
        cantidad_bultos: p.cantidad_bultos ?? 0,
        unidades_por_bulto: p.unidades_por_bulto ?? null,
        dim_unidad_mm: p.dim_unidad_mm ?? null,
        peso_unidad_kg: p.peso_unidad_kg ?? null,
        tipo_producto: tipoProducto,
      };
    });

    const unidades_totales = items.reduce((a, it) => a + (it.cantidad_unidades ?? 0), 0);

    return {
      id: -simulacionId, // id virtual estable
      descripcion: `Simulación #${simulacionId}`,
      tipo_bulto: "PRODUCTO_ESTANDAR",
      bulto_empresa_id: null,
      unidades_totales,
      bultos_totales: 0,
      items,
    };
  }, [rows, simulacionId]);

  if (!loteVirtual) {
    return (
      <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
        Cargando productos de la simulación...
      </div>
    );
  }

  if (!loteVirtual.items.length) {
    return (
      <div className="rounded-lg border bg-amber-50 p-3 text-xs text-amber-900">
        La simulación no tiene productos vinculados a TipoProducto. Agregá al menos uno desde el buscador.
      </div>
    );
  }

  return (
    <BultoPanel lote={loteVirtual} empresaBultos={empresaBultos} onApply={onApply} simulacionId={simulacionId} />
  );
}
