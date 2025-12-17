"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";

/* =========================
   Types
========================= */

type DimMm = {
  largo: number;
  ancho: number;
  alto: number;
};

type Placement = {
  tipoProductoId: number;
  codigo: string;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  capa: number;
};

interface Props {
  palletDimMm: DimMm;
  placements: Placement[];
}

/* =========================
   Utils
========================= */

const mmToM = (v: number) => (Number.isFinite(v) ? v / 1000 : 0);

/* =========================
   Meshes
========================= */

function PalletMesh({ dim }: { dim: DimMm }) {
  const largo = mmToM(dim.largo);
  const ancho = mmToM(dim.ancho);
  const alto = mmToM(dim.alto);

  return (
    <mesh position={[0, -alto / 2, 0]}>
      <boxGeometry args={[largo, alto, ancho]} />
      <meshStandardMaterial color="#d1d5db" transparent opacity={0.35} />
      <Edges scale={1.01} color="#6b7280" />
    </mesh>
  );
}

function CajaMesh({ p }: { p: Placement }) {
  return (
    <mesh
      position={[
        mmToM(p.posCentroMm.x),
        mmToM(p.posCentroMm.y),
        mmToM(p.posCentroMm.z),
      ]}
    >
      <boxGeometry
        args={[
          mmToM(p.dimMm.largo),
          mmToM(p.dimMm.alto),
          mmToM(p.dimMm.ancho),
        ]}
      />
      <meshStandardMaterial color="#6366f1" roughness={0.6} metalness={0.05} />
      <Edges scale={1.01} color="#312e81" />
    </mesh>
  );
}

/* =========================
   Component
========================= */

export function CubicacionPalletViewer3D({ palletDimMm, placements }: Props) {
  const { camDist, near, far, gridSize, gridDivisions } = useMemo(() => {
    const maxDimMm = Math.max(
      palletDimMm?.largo ?? 0,
      palletDimMm?.ancho ?? 0,
      palletDimMm?.alto ?? 0
    );

    // Distancia de cámara en función del tamaño máximo del pallet
    const dist = mmToM(maxDimMm * 1.6);

    // Plano de recorte: evitar clipping
    const nearVal = Math.max(0.01, dist / 100);
    const farVal = Math.max(50, dist * 10);

    // Grid proporcional (en metros)
    const baseM = mmToM(maxDimMm);
    const size = Math.max(2, baseM * 2); // al menos 2m
    const divisions = Math.min(50, Math.max(10, Math.round(size)));

    return {
      camDist: dist > 0 ? dist : 3,
      near: nearVal,
      far: farVal,
      gridSize: size,
      gridDivisions: divisions,
    };
  }, [palletDimMm]);

  return (
    <div className="w-full h-105 rounded-md border bg-slate-100">
      <Canvas
        camera={{
          position: [camDist, camDist, camDist],
          fov: 45,
          near,
          far,
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />

        {/* Helpers */}
        <gridHelper args={[gridSize, gridDivisions, "#cbd5f5", "#e5e7eb"]} />

        {/* Pallet */}
        <PalletMesh dim={palletDimMm} />

        {/* Cajas */}
        {placements.map((p, i) => (
          <CajaMesh key={`${p.tipoProductoId}-${p.codigo}-${p.capa}-${i}`} p={p} />
        ))}

        {/* Controls */}
        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>
    </div>
  );
}
