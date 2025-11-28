"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import React, { useMemo } from "react";

export interface CajaDims {
  largoM: number; // X
  anchoM: number; // Z
  altoM: number;  // Y
}

export interface ProductoDims {
  largoM: number; // X
  anchoM: number; // Z
  altoM: number;  // Y
}

interface CubicacionViewer3DProps {
  caja: CajaDims;
  producto: ProductoDims;
}

/**
 * Calcula cómo acomodar productos (bultos) en grilla dentro de la caja/pallet.
 * Versión simple: sin rotaciones inteligentes.
 */
function calcularLayout(caja: CajaDims, producto: ProductoDims) {
  const countX = Math.floor(caja.largoM / producto.largoM);
  const countZ = Math.floor(caja.anchoM / producto.anchoM);
  const countY = Math.floor(caja.altoM / producto.altoM);

  const total = countX * countY * countZ;

  const posiciones: [number, number, number][] = [];

  if (total <= 0) {
    return {
      countX: 0,
      countY: 0,
      countZ: 0,
      total: 0,
      posiciones,
    };
  }

  // Centramos los bultos dentro del contenedor
  const offsetX = -caja.largoM / 2 + producto.largoM / 2;
  const offsetY = -caja.altoM / 2 + producto.altoM / 2;
  const offsetZ = -caja.anchoM / 2 + producto.anchoM / 2;

  for (let y = 0; y < countY; y++) {
    for (let z = 0; z < countZ; z++) {
      for (let x = 0; x < countX; x++) {
        const px = offsetX + x * producto.largoM;
        const py = offsetY + y * producto.altoM;
        const pz = offsetZ + z * producto.anchoM;
        posiciones.push([px, py, pz]);
      }
    }
  }

  return {
    countX,
    countY,
    countZ,
    total,
    posiciones,
  };
}

function CajaWireframe({ caja }: { caja: CajaDims }) {
  return (
    <mesh>
      <boxGeometry args={[caja.largoM, caja.altoM, caja.anchoM]} />
      <meshBasicMaterial wireframe transparent opacity={0.5} />
    </mesh>
  );
}

function ProductoBloque(props: { position: [number, number, number]; producto: ProductoDims }) {
  const { position, producto } = props;

  return (
    <mesh position={position}>
      <boxGeometry args={[producto.largoM, producto.altoM, producto.anchoM]} />
      <meshStandardMaterial />
    </mesh>
  );
}

export const CubicacionViewer3D: React.FC<CubicacionViewer3DProps> = ({
  caja,
  producto,
}) => {
  const layout = useMemo(() => calcularLayout(caja, producto), [caja, producto]);

  return (
    <div className="w-full h-80 md:h-96 border rounded-md overflow-hidden bg-slate-50">
      <Canvas camera={{ position: [3, 3, 4], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.7} />
        <OrbitControls enablePan enableZoom enableRotate />

        {/* Piso de referencia */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -caja.altoM / 2 - 0.01, 0]}
        >
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial />
        </mesh>

        {/* Contenedor/pallet */}
        <CajaWireframe caja={caja} />

        {/* Bultos (cajas) */}
        {layout.posiciones.map((pos, idx) => (
          <ProductoBloque key={idx} position={pos} producto={producto} />
        ))}
      </Canvas>
    </div>
  );
};
