"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { JSX, useMemo } from "react";
import type { CubicacionBulto3DInput } from "../types/cubicacion-3d";

interface Props {
  data: CubicacionBulto3DInput;
  gapFactor?: number; // 0.9–1, solo para “aire visual”
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

  const defaultColors = ["#4F46E5", "#059669", "#DC2626", "#D97706", "#0891B2"];

  const hasPositions = contenido.some((c) => !!c.positionMm);

  return (
    <div className="h-105 w-full rounded-md border bg-slate-50 overflow-hidden">
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
            const color = item.color ?? defaultColors[idx % defaultColors.length];

            const sizeM = {
              x: (item.dimUnidadMm.largo / 1000) * gapFactor,
              y: (item.dimUnidadMm.alto / 1000) * gapFactor,
              z: (item.dimUnidadMm.ancho / 1000) * gapFactor,
            };

            const cubes: JSX.Element[] = [];

            // Si viene con placements, normalmente cada entry es 1 unidad.
            // Igual soportamos unidades > 1 duplicando en el mismo punto (no recomendado).
            const reps = Math.max(1, Math.floor(item.unidades));

            for (let i = 0; i < reps; i++) {
              const pos = item.positionMm!;
              cubes.push(
                <mesh
                  key={`${item.productoId}-${idx}-${i}`}
                  position={[pos.x / 1000, pos.y / 1000, pos.z / 1000]}
                >
                  <boxGeometry args={[sizeM.x, sizeM.y, sizeM.z]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              );
            }

            return <group key={`${item.productoId}-${idx}`}>{cubes}</group>;
          })
        ) : (
          // Si alguna vez faltara layout, no mentimos: no dibujamos.
          <group>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.001, 0.001, 0.001]} />
              <meshStandardMaterial transparent opacity={0} />
            </mesh>
          </group>
        )}
      </Canvas>

      {!hasPositions && (
        <div className="px-3 py-2 text-xs text-amber-700 border-t bg-amber-50">
          No hay layout geométrico disponible para previsualizar esta opción.
        </div>
      )}
    </div>
  );
}
