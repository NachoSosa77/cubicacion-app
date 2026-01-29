"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type DimMm = { largo: number; ancho: number; alto: number };

type PalletPlacementCamion = {
  id: string;
  palletPlanId: number;
  dimMm: DimMm;
  posCentroMm: { x: number; y: number; z: number };
  rot90: boolean;
};

const mmToM = (v: number) => (Number.isFinite(v) ? v / 1000 : 0);

/* =========================
   Scene helpers
========================= */

function AutoFrame({
  camionDimMm,
  placements,
  targetYFactor = 0.15,
}: {
  camionDimMm: DimMm;
  placements: PalletPlacementCamion[];
  targetYFactor?: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  // Bounding box combinado:
  // - camión (para no cortarlo)
  // - pallets (para acercar cuando hay pocos)
  const box = useMemo(() => {
    const b = new THREE.Box3();

    const L = mmToM(camionDimMm.largo);
    const W = mmToM(camionDimMm.ancho);
    const H = mmToM(camionDimMm.alto);

    const camionMin = new THREE.Vector3(-L / 2, 0, -W / 2);
    const camionMax = new THREE.Vector3(L / 2, H, W / 2);
    b.union(new THREE.Box3(camionMin, camionMax));

    for (const p of placements) {
      const cx = mmToM(p.posCentroMm.x);
      const cy = mmToM(p.posCentroMm.y);
      const cz = mmToM(p.posCentroMm.z);

      const pL = mmToM(p.dimMm.largo);
      const pW = mmToM(p.dimMm.ancho);
      const pH = mmToM(p.dimMm.alto);

      const min = new THREE.Vector3(
        cx - pL / 2,
        Math.max(0, cy - pH / 2),
        cz - pW / 2
      );
      const max = new THREE.Vector3(cx + pL / 2, cy + pH / 2, cz + pW / 2);
      b.union(new THREE.Box3(min, max));
    }

    return b;
  }, [camionDimMm, placements]);

  useEffect(() => {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const target = new THREE.Vector3(
      center.x,
      mmToM(camionDimMm.alto) * targetYFactor,
      center.z
    );

    const maxSize = Math.max(size.x, size.y, size.z);

    // ✅ FIX TS: camera puede ser Perspective o Orthographic.
    // Solo usamos fov si es PerspectiveCamera.
    let dist = maxSize * 1.5; // fallback seguro

    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const cam = camera as THREE.PerspectiveCamera;
      const fov = (cam.fov * Math.PI) / 180;
      dist = (maxSize / 2) / Math.tan(fov / 2);
    }

    const desired = new THREE.Vector3(
      target.x + dist * 1.15,
      target.y + dist * 0.75,
      target.z + dist * 1.15
    );

    camera.position.copy(desired);
    camera.near = Math.max(0.02, dist / 200);
    camera.far = Math.max(120, dist * 30);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  }, [box, camera, camionDimMm.alto, targetYFactor]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan
      enableZoom
      enableRotate
    />
  );
}

/* =========================
   Meshes
========================= */

function CamionShell({ dim }: { dim: DimMm }) {
  const L = mmToM(dim.largo);
  const W = mmToM(dim.ancho);
  const H = mmToM(dim.alto);

  return (
    <mesh position={[0, H / 2, 0]}>
      <boxGeometry args={[L, H, W]} />
      <meshStandardMaterial transparent opacity={0.16} color="#94a3b8" />
      <Edges scale={1.01} color="#334155" />
    </mesh>
  );
}

function CamionFloor({ dim }: { dim: DimMm }) {
  const L = mmToM(dim.largo);
  const W = mmToM(dim.ancho);

  return (
    <mesh position={[0, -0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[L, W]} />
      <meshStandardMaterial color="#e5e7eb" roughness={0.95} metalness={0} />
    </mesh>
  );
}

function PalletMesh({ p }: { p: PalletPlacementCamion }) {
  const L = mmToM(p.dimMm.largo);
  const W = mmToM(p.dimMm.ancho);
  const H = mmToM(p.dimMm.alto);

  return (
    <mesh
      position={[
        mmToM(p.posCentroMm.x),
        mmToM(p.posCentroMm.y),
        mmToM(p.posCentroMm.z),
      ]}
    >
      <boxGeometry args={[L, H, W]} />
      <meshStandardMaterial color="#475569" roughness={0.75} metalness={0.08} />
      <Edges scale={1.02} color="#0b1220" />
    </mesh>
  );
}

/* =========================
   Component
========================= */

export function CubicacionCamionViewer3D({
  camionDimMm,
  placements,
}: {
  camionDimMm: DimMm;
  placements: PalletPlacementCamion[];
}) {
  const { gridSize, gridDivisions } = useMemo(() => {
    const maxDimMm = Math.max(
      camionDimMm?.largo ?? 0,
      camionDimMm?.ancho ?? 0,
      camionDimMm?.alto ?? 0
    );
    const baseM = mmToM(maxDimMm);

    const size = Math.max(6, baseM * 1.25);
    const divisions = Math.min(120, Math.max(20, Math.round(size * 3)));

    return { gridSize: size, gridDivisions: divisions };
  }, [camionDimMm]);

  return (
    <div className="w-full h-105 rounded-md border bg-slate-100">
      <Canvas
        camera={{
          position: [6, 4.5, 6], // se recalcula por AutoFrame
          fov: 45,
          near: 0.05,
          far: 400,
        }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 14, 10]} intensity={0.9} />
        <directionalLight position={[-10, 8, -8]} intensity={0.45} />
        <directionalLight position={[0, 6, -14]} intensity={0.25} />

        <gridHelper
          args={[gridSize, gridDivisions]}
          position={[0, -0.01, 0]}
        />

        <CamionFloor dim={camionDimMm} />
        <CamionShell dim={camionDimMm} />
        {placements.map((p) => (
          <PalletMesh key={p.id} p={p} />
        ))}

        <AutoFrame
          camionDimMm={camionDimMm}
          placements={placements}
          targetYFactor={0.12}
        />
      </Canvas>
    </div>
  );
}
