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
  palletDimMm: DimMm; // base del pallet (largo/ancho) + alto máximo (NO visual)
  placements: Placement[];
}

/* =========================
   Utils
========================= */

const mmToM = (v: number) => (Number.isFinite(v) ? v / 1000 : 0);

/* =========================
   Constantes visuales
========================= */

// Pallet físico real (madera)
const PALLET_REAL_ALTO_MM = 150;
const PALLET_REAL_COLOR = "#8b5a2b";

/* =========================
   Meshes
========================= */

function PalletMeshReal({ dim }: { dim: DimMm }) {
  const largo = mmToM(dim.largo);
  const ancho = mmToM(dim.ancho);
  const alto = mmToM(PALLET_REAL_ALTO_MM);

  return (
    <mesh position={[0, alto / 2, 0]} receiveShadow>
      <boxGeometry args={[largo, alto, ancho]} />
      <meshStandardMaterial
        color={PALLET_REAL_COLOR}
        roughness={0.9}
        metalness={0.05}
      />
      <Edges scale={1.01} color="#5b3a1a" />
    </mesh>
  );
}

function CajaMesh({ p }: { p: Placement }) {
  const palletAltoM = mmToM(PALLET_REAL_ALTO_MM);

  return (
    <mesh
      position={[
        mmToM(p.posCentroMm.x),
        mmToM(p.posCentroMm.y) + palletAltoM,
        mmToM(p.posCentroMm.z),
      ]}
      castShadow
    >
      <boxGeometry
        args={[
          mmToM(p.dimMm.largo),
          mmToM(p.dimMm.alto),
          mmToM(p.dimMm.ancho),
        ]}
      />
      <meshStandardMaterial
        color="#4f46e5"
        roughness={0.6}
        metalness={0.05}
      />
      <Edges scale={1.01} color="#f5f5f5" />
    </mesh>
  );
}

/* =========================
   Component
========================= */

export function CubicacionPalletViewer3D({ palletDimMm, placements }: Props) {
  const { camDist, near, far, gridSize, gridDivisions } = useMemo(() => {
    const baseMm = Math.max(palletDimMm.largo, palletDimMm.ancho);
    const heightMm =
      placements.length > 0
        ? Math.max(...placements.map((p) => p.posCentroMm.y + p.dimMm.alto))
        : PALLET_REAL_ALTO_MM;

    const maxMm = Math.max(baseMm, heightMm);

    const dist = mmToM(maxMm * 1.6);

    return {
      camDist: dist || 3,
      near: 0.01,
      far: Math.max(50, dist * 10),
      gridSize: Math.max(2, mmToM(baseMm * 2)),
      gridDivisions: Math.min(50, Math.max(10, Math.round(mmToM(baseMm * 2)))),
    };
  }, [palletDimMm, placements]);

  return (
    <div className="w-full h-105 rounded-md border bg-slate-100">
      <Canvas
        shadows
        camera={{
          position: [camDist, camDist, camDist],
          fov: 45,
          near,
          far,
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={0.9}
          castShadow
        />
        <directionalLight position={[-5, 6, -5]} intensity={0.4} />

        {/* Grid */}
        <gridHelper
          args={[gridSize, gridDivisions, "#cbd5f5", "#e5e7eb"]}
        />

        {/* Pallet real */}
        <PalletMeshReal dim={palletDimMm} />

        {/* Bultos */}
        {placements.map((p, i) => (
          <CajaMesh
            key={`${p.tipoProductoId}-${p.codigo}-${p.capa}-${i}`}
            p={p}
          />
        ))}

        {/* Controls */}
        <OrbitControls
          makeDefault
          target={[0, mmToM(PALLET_REAL_ALTO_MM), 0]}
          enablePan
          enableZoom
          enableRotate
        />
      </Canvas>
    </div>
  );
}
