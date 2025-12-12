"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { JSX } from "react";
import { CubicacionBulto3DInput } from "../types/cubicacion-3d";

interface Props {
  data: CubicacionBulto3DInput;
  gapFactor?: number; // separación visual (0.9–1)
}

export function CubicacionBultoViewer3D({
  data,
  gapFactor = 0.95,
}: Props) {
  const { bulto, contenido } = data;

  // Pasamos mm → metros
  const bultoSize = {
    x: bulto.dimInternaMm.largo / 1000,
    y: bulto.dimInternaMm.alto / 1000,
    z: bulto.dimInternaMm.ancho / 1000,
  };

  // Colores por defecto si no vienen
  const defaultColors = [
    "#4F46E5",
    "#059669",
    "#DC2626",
    "#D97706",
    "#0891B2",
  ];

  return (
    <div className="h-105 w-full rounded-md border bg-slate-50">
      <Canvas camera={{ position: [1.2, 1.2, 1.2], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 3, 3]} intensity={0.8} />

        <OrbitControls makeDefault />

        {/* Bulto */}
        <mesh>
          <boxGeometry args={[bultoSize.x, bultoSize.y, bultoSize.z]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.08}
          />
          <Edges color="#334155" />
        </mesh>

        {/* Contenido */}
        {contenido.map((item, idx) => {
          const unit = {
            x: (item.dimUnidadMm.largo / 1000) * gapFactor,
            y: (item.dimUnidadMm.alto / 1000) * gapFactor,
            z: (item.dimUnidadMm.ancho / 1000) * gapFactor,
          };

          const color =
            item.color ?? defaultColors[idx % defaultColors.length];

          const cubes: JSX.Element[] = [];

          let cursorX = -bultoSize.x / 2 + unit.x / 2;
          let cursorY = -bultoSize.y / 2 + unit.y / 2;
          let cursorZ = -bultoSize.z / 2 + unit.z / 2;

          for (let i = 0; i < item.unidades; i++) {
            cubes.push(
              <mesh
                key={`${item.productoId}-${i}`}
                position={[cursorX, cursorY, cursorZ]}
              >
                <boxGeometry args={[unit.x, unit.y, unit.z]} />
                <meshStandardMaterial color={color} />
              </mesh>
            );

            cursorX += unit.x;
            if (cursorX + unit.x / 2 > bultoSize.x / 2) {
              cursorX = -bultoSize.x / 2 + unit.x / 2;
              cursorZ += unit.z;

              if (cursorZ + unit.z / 2 > bultoSize.z / 2) {
                cursorZ = -bultoSize.z / 2 + unit.z / 2;
                cursorY += unit.y;
              }
            }
          }

          return <group key={item.productoId}>{cubes}</group>;
        })}
      </Canvas>
    </div>
  );
}
