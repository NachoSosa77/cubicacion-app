// app/cubicacion/components/CubicacionViewer3D.tsx
"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

type CajaDimsM = {
  largoM: number; // Eje X
  anchoM: number; // Eje Z
  altoM: number;  // Eje Y
};

type UnidadDimsM = CajaDimsM;

type Grid = {
  x: number; // cuántas unidades a lo largo (X)
  y: number; // cuántas unidades en altura (Y)
  z: number; // cuántas unidades a lo ancho (Z)
};

interface Props {
  caja: CajaDimsM;
  unidad: UnidadDimsM; // ya ORIENTADA
  grid: Grid;
  /** 1 = tamaño real, <1 las hace un poco más chicas solo visualmente */
  gapFactor?: number;
}

export function CubicacionViewer3D({
  caja,
  unidad,
  grid,
  gapFactor,
}: Props) {
  // 1) Escala global para que la caja entre cómoda en escena
  const maxDimCaja = Math.max(caja.largoM, caja.anchoM, caja.altoM);
  const TARGET_SIZE = 2; // tamaño máximo en unidades 3D
  const scale = maxDimCaja > 0 ? TARGET_SIZE / maxDimCaja : 1;

  const cajaEscalada = {
    x: caja.largoM * scale,
    y: caja.altoM * scale,
    z: caja.anchoM * scale,
  };

  // Unidad escalada "bruta"
  const unidadEscaladaBase = {
    x: unidad.largoM * scale,
    y: unidad.altoM * scale,
    z: unidad.anchoM * scale,
  };

  // 2) Ajuste por si grid * unidad se pasara de la caja
  const ocupadoX = grid.x * unidadEscaladaBase.x;
  const ocupadoY = grid.y * unidadEscaladaBase.y;
  const ocupadoZ = grid.z * unidadEscaladaBase.z;

  const factorX =
    ocupadoX > 0 ? Math.min(1, cajaEscalada.x / ocupadoX) : 1;
  const factorY =
    ocupadoY > 0 ? Math.min(1, cajaEscalada.y / ocupadoY) : 1;
  const factorZ =
    ocupadoZ > 0 ? Math.min(1, cajaEscalada.z / ocupadoZ) : 1;

  const ajuste = Math.min(factorX, factorY, factorZ, 1);

  // Tamaño real con el que calculamos posiciones (sin separación)
  const unidadEscaladaReal = {
    x: unidadEscaladaBase.x * ajuste,
    y: unidadEscaladaBase.y * ajuste,
    z: unidadEscaladaBase.z * ajuste,
  };

  // GAP visual configurable (default 0.95)
  const GAP_FACTOR = gapFactor ?? 0.95;

  // Tamaño VISUAL un poco más chico para que se vean huecos
  const unidadEscaladaVisual = {
    x: unidadEscaladaReal.x * GAP_FACTOR,
    y: unidadEscaladaReal.y * GAP_FACTOR,
    z: unidadEscaladaReal.z * GAP_FACTOR,
  };

  // 3) Caja centrada en (0,0,0) y unidades apoyadas dentro
  const halfCaja = {
    x: cajaEscalada.x / 2,
    y: cajaEscalada.y / 2,
    z: cajaEscalada.z / 2,
  };

  // Las unidades arrancan en una esquina interna de la caja
  const startX = -halfCaja.x + unidadEscaladaReal.x / 2;
  const startY = -halfCaja.y + unidadEscaladaReal.y / 2;
  const startZ = -halfCaja.z + unidadEscaladaReal.z / 2;

  const getUnidadPosition = (ix: number, iy: number, iz: number) => {
    return [
      startX + ix * unidadEscaladaReal.x,
      startY + iy * unidadEscaladaReal.y,
      startZ + iz * unidadEscaladaReal.z,
    ] as [number, number, number];
  };

  return (
    <div className="w-full h-80 md:h-96 border rounded-md bg-slate-950/90">
      <Canvas camera={{ position: [4, 4, 4], fov: 50 }}>
        <color attach="background" args={["#020617"]} />

        {/* Luces */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />

        {/* Caja (bulto) como wireframe */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry
            args={[cajaEscalada.x, cajaEscalada.y, cajaEscalada.z]}
          />
          <meshStandardMaterial
            wireframe
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Unidades (productos) dentro de la caja */}
        {Array.from({ length: grid.x }).map((_, ix) =>
          Array.from({ length: grid.y }).map((_, iy) =>
            Array.from({ length: grid.z }).map((_, iz) => {
              const [x, y, z] = getUnidadPosition(ix, iy, iz);
              const color =
                (ix + iy + iz) % 2 === 0 ? "#64748b" : "#94a3b8"; // alternamos

              return (
                <mesh key={`${ix}-${iy}-${iz}`} position={[x, y, z]}>
                  <boxGeometry
                    args={[
                      unidadEscaladaVisual.x,
                      unidadEscaladaVisual.y,
                      unidadEscaladaVisual.z,
                    ]}
                  />
                  <meshStandardMaterial color={color} />
                </mesh>
              );
            })
          )
        )}

        {/* Piso de referencia */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -halfCaja.y - 0.05, 0]}
        >
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
