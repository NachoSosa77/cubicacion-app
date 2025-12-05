"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ITipoContenedor } from "../actions/tipoContenedorActions";
import { ITransporteClasificacion } from "../actions/transporteActions";

interface TruckViewer3DProps {
  transporte: ITransporteClasificacion;
  contenedor: ITipoContenedor | null;
  resultadoPalletEnTransporte: any; // si querés, después tipamos más fino
}

function getTruckScale(transporte: ITransporteClasificacion) {
  const targetLength = 6; // largo del camión en unidades 3D
  const scale = targetLength / transporte.mt_largo_cub;

  return {
    scale,
    truckL: transporte.mt_largo_cub * scale,
    truckW: transporte.mt_ancho_cub * scale,
    truckH: transporte.mt_alto_cub * scale,
  };
}

function TruckBody({
  largo,
  ancho,
  alto,
}: {
  largo: number;
  ancho: number;
  alto: number;
}) {
  return (
    <group>
      {/* Caja del camión (paredes semi-transparente) */}
      <mesh>
        <boxGeometry args={[largo, alto, ancho]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.08}
          wireframe={false}
        />
      </mesh>

      {/* Piso más marcado */}
      <mesh position={[0, -alto / 2 + 0.01, 0]}>
        <boxGeometry args={[largo, 0.02, ancho]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
    </group>
  );
}

function PalletWithLoad(params: {
  idxX: number;
  idxZ: number;
  palletsPorLargo: number;
  palletsPorAncho: number;
  palletL: number;
  palletW: number;
  palletH: number;
  truckL: number;
  truckW: number;
  pisoY: number;
}) {
  const {
    idxX,
    idxZ,
    palletsPorLargo,
    palletsPorAncho,
    palletL,
    palletW,
    palletH,
    truckL,
    truckW,
    pisoY,
  } = params;

  const gap = 0.02 * palletL; // pequeño espacio entre pallets

  const totalLargoPallets = palletsPorLargo * palletL + (palletsPorLargo - 1) * gap;
  const totalAnchoPallets = palletsPorAncho * palletW + (palletsPorAncho - 1) * gap;

  const startX = -totalLargoPallets / 2 + palletL / 2;
  const startZ = -totalAnchoPallets / 2 + palletW / 2;

  const x = startX + idxX * (palletL + gap);
  const z = startZ + idxZ * (palletW + gap);

  const palletHeight = 0.12 * (palletL / 1.2); // aprox, solo visual
  const palletY = pisoY + palletHeight / 2;
  const cargaY = palletY + palletHeight / 2 + palletH / 2;

  return (
    <group>
      {/* Pallet */}
      <mesh position={[x, palletY, z]}>
        <boxGeometry args={[palletL, palletHeight, palletW]} />
        <meshStandardMaterial color="#8b5a2b" />
      </mesh>

      {/* Carga (bultos apilados) */}
      <mesh position={[x, cargaY, z]}>
        <boxGeometry args={[palletL * 0.96, palletH, palletW * 0.96]} />
        <meshStandardMaterial color="#4b6584" />
      </mesh>
    </group>
  );
}

export function TruckViewer3D({
  transporte,
  contenedor,
  resultadoPalletEnTransporte,
}: TruckViewer3DProps) {
  if (!contenedor || !resultadoPalletEnTransporte) return null;

  const {
    palletsPorLargo,
    palletsPorAncho,
    capas, // ahora asumimos 1, pero está listo por si apilás pallets
  } = resultadoPalletEnTransporte;

  if (palletsPorLargo <= 0 || palletsPorAncho <= 0 || capas <= 0) {
    return null;
  }

  const { scale, truckL, truckW, truckH } = getTruckScale(transporte);

  // Pallet real → 3D
  const palletL = contenedor.largo_mts * scale;
  const palletW = contenedor.ancho_mts * scale;

  // Altura de carga sobre el pallet: por ahora usamos alto_mts del contenedor
  const alturaCargaPalletM = contenedor.alto_mts; // si querés super fino, pasamos alturaMaxCarga
  const palletCargaH = alturaCargaPalletM * scale;

  const pisoY = -truckH / 2 + 0.02;

  return (
    <div className="mt-4 h-80 md:h-112 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
      <Canvas>
        <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={45} />
        <OrbitControls
          enablePan
          enableZoom
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.3}
          target={[0, 0, 0]}
        />

        <ambientLight intensity={1.1} />
        <directionalLight position={[10, 12, 10]} intensity={1.3} />

        {/* Camión (caja) */}
        <TruckBody largo={truckL} ancho={truckW} alto={truckH} />

        {/* Pallets + carga dentro del camión */}
        {Array.from({ length: palletsPorLargo }).map((_, ix) =>
          Array.from({ length: palletsPorAncho }).map((__, iz) => (
            <PalletWithLoad
              key={`${ix}-${iz}`}
              idxX={ix}
              idxZ={iz}
              palletsPorLargo={palletsPorLargo}
              palletsPorAncho={palletsPorAncho}
              palletL={palletL}
              palletW={palletW}
              palletH={palletCargaH}
              truckL={truckL}
              truckW={truckW}
              pisoY={pisoY}
            />
          ))
        )}
      </Canvas>

      <p className="px-3 pb-2 pt-1 text-[10px] text-slate-400">
        Vista 3D del camión con los pallets y la carga, usando las dimensiones
        reales (escaladas). Podés rotar y hacer zoom con el mouse.
      </p>
    </div>
  );
}
