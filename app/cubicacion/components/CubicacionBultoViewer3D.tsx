"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { JSX, useMemo } from "react";
import type { CubicacionBulto3DInput } from "../types/cubicacion-3d";

interface Props {
  data: CubicacionBulto3DInput;
  gapFactor?: number; // 0.9–1, solo para “aire visual”
}

const PALETTE = [
  "#2563EB", // azul
  "#16A34A", // verde
  "#DC2626", // rojo
  "#F59E0B", // ámbar
  "#7C3AED", // violeta
  "#0EA5E9", // celeste
  "#DB2777", // fucsia
  "#64748B", // slate
];

function colorForProducto(productoId: number) {
  return PALETTE[Math.abs(productoId) % PALETTE.length];
}

export function CubicacionBultoViewer3D({ data, gapFactor = 0.98 }: Props) {
  const { bulto, contenido } = data;

  // mm → metros (interno)
  const bultoSizeM = useMemo(() => {
    return {
      x: bulto.dimInternaMm.largo / 1000,
      y: bulto.dimInternaMm.alto / 1000,
      z: bulto.dimInternaMm.ancho / 1000,
    };
  }, [bulto.dimInternaMm]);

  const hasPositions = contenido.some((c) => !!c.positionMm);

  // Leyenda por producto (codigo + cantidad de unidades dibujadas)
  const legend = useMemo(() => {
    const map = new Map<number, { codigo: string; count: number; color: string }>();

    for (const it of contenido) {
      const pid = it.productoId;
      const reps = Math.max(1, Math.floor(it.unidades ?? 1));
      const codigo = String(it.codigo ?? `PROD-${pid}`).trim() || `PROD-${pid}`;

      const prev = map.get(pid);
      if (!prev) {
        map.set(pid, { codigo, count: reps, color: colorForProducto(pid) });
      } else {
        prev.count += reps;
      }
    }

    return Array.from(map.entries())
      .map(([productoId, v]) => ({ productoId, ...v }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [contenido]);

  return (
    <div className="w-full rounded-md border bg-slate-50 overflow-hidden">
      {/* Leyenda */}
      <div className="px-3 py-2 border-b bg-white">
        <p className="text-xs font-medium text-slate-700">Leyenda (producto → color)</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700">
          {legend.length ? (
            legend.map((l) => (
              <div key={l.productoId} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-sm border border-slate-300"
                  style={{ backgroundColor: l.color }}
                />
                <span className="font-medium">{l.codigo}</span>
                <span className="text-slate-500">× {l.count}</span>
              </div>
            ))
          ) : (
            <span className="text-slate-500">Sin contenido para mostrar.</span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="h-105 w-full">
        <Canvas camera={{ position: [1.2, 1.2, 1.2], fov: 45 }}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 3, 3]} intensity={0.85} />

          <OrbitControls makeDefault />

          {/* Bulto interno */}
          <mesh>
            <boxGeometry args={[bultoSizeM.x, bultoSizeM.y, bultoSizeM.z]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.08} />
            <Edges color="#334155" />
          </mesh>

          {/* Contenido: SOLO dibuja si tiene layout (positionMm) */}
          {hasPositions ? (
            contenido.map((item, idx) => {
              const pid = item.productoId;
              const color = colorForProducto(pid);

              const sizeM = {
                x: (item.dimUnidadMm.largo / 1000) * gapFactor,
                y: (item.dimUnidadMm.alto / 1000) * gapFactor,
                z: (item.dimUnidadMm.ancho / 1000) * gapFactor,
              };

              const cubes: JSX.Element[] = [];

              // Normalmente cada entry es 1 unidad (placements). Igual soportamos unidades > 1.
              const reps = Math.max(1, Math.floor(item.unidades ?? 1));
              const pos = item.positionMm!;

              for (let i = 0; i < reps; i++) {
                cubes.push(
                  <mesh
                    key={`${pid}-${idx}-${i}`}
                    position={[pos.x / 1000, pos.y / 1000, pos.z / 1000]}
                  >
                    <boxGeometry args={[sizeM.x, sizeM.y, sizeM.z]} />
                    <meshStandardMaterial color={color} />
                    {/* Contorno para diferenciar unidades */}
                    <Edges color="#0f172a" />
                  </mesh>
                );
              }

              return <group key={`${pid}-${idx}`}>{cubes}</group>;
            })
          ) : (
            // Si falta layout, no mentimos: no dibujamos.
            <group>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.001, 0.001, 0.001]} />
                <meshStandardMaterial transparent opacity={0} />
              </mesh>
            </group>
          )}
        </Canvas>
      </div>

      {!hasPositions && (
        <div className="px-3 py-2 text-xs text-amber-700 border-t bg-amber-50">
          No hay layout geométrico disponible para previsualizar esta opción.
        </div>
      )}
    </div>
  );
}
