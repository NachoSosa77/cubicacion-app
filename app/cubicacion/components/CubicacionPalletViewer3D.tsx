"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

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

const mmToM = (v: number) => v / 1000;

/* =========================
   Meshes
========================= */

function PalletMesh({ dim }: { dim: DimMm }) {
  return (
    <mesh position={[0, -mmToM(dim.alto) / 2, 0]}>
      <boxGeometry
        args={[
          mmToM(dim.largo),
          mmToM(dim.alto),
          mmToM(dim.ancho),
        ]}
      />
      <meshStandardMaterial
        color="#d1d5db"
        transparent
        opacity={0.35}
      />
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
      <meshStandardMaterial
        color="#6366f1"
        roughness={0.6}
        metalness={0.05}
      />
      <Edges scale={1.01} color="#312e81" />
    </mesh>
  );
}

/* =========================
   Scene
========================= */

export function CubicacionPalletViewer3D({
  palletDimMm,
  placements,
}: Props) {
  const maxDim = Math.max(
    palletDimMm.largo,
    palletDimMm.ancho,
    palletDimMm.alto
  );

  const camDist = mmToM(maxDim * 1.6);

  return (
    <div className="w-full h-105 rounded-md border bg-slate-100">
      <Canvas
        camera={{
          position: [camDist, camDist, camDist],
          fov: 45,
        }}
      >
        {/* Lights */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />

        {/* Helpers */}
        <gridHelper args={[10, 10, "#cbd5f5", "#e5e7eb"]} />

        {/* Pallet */}
        <PalletMesh dim={palletDimMm} />

        {/* Cajas */}
        {placements.map((p, i) => (
          <CajaMesh key={`${p.codigo}-${i}`} p={p} />
        ))}

        {/* Controls */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          makeDefault
        />
      </Canvas>
    </div>
  );
}
