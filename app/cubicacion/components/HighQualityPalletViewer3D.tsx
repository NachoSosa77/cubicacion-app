// app/cubicacion/components/HighQualityPalletViewer3D.tsx
"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { JSX } from "react";
import { ITipoProducto } from "../actions/productoActions";
import { ITipoContenedor } from "../actions/tipoContenedorActions";
import { ResultadoCubicacion } from "../lib/cubicacion";

export interface HighQualityPalletViewer3DProps {
  producto: ITipoProducto;
  contenedor: ITipoContenedor;
  resultado: ResultadoCubicacion;
}

// Normalizamos las medidas para que entren “cómodas” en la escena
function getScaleFactors(contenedor: ITipoContenedor) {
  const maxBase = Math.max(contenedor.largo_mts, contenedor.ancho_mts);
  const targetSize = 2; // cuánto ocupa en “unidad 3D” la base máx
  const scale = targetSize / maxBase;

  return {
    baseLargo: contenedor.largo_mts * scale,
    baseAncho: contenedor.ancho_mts * scale,
    scale,
  };
}

function PalletBase({ largo, ancho }: { largo: number; ancho: number }) {
  const height = 0.12; // grosor visual del pallet

  return (
    <mesh position={[0, height / 2, 0]} >
      <boxGeometry args={[largo, height, ancho]} />
      <meshStandardMaterial color="#8b5a2b" />
    </mesh>
  );
}

function BoxesStack({
  producto,
  resultado,
  scale,
}: {
  producto: ITipoProducto;
  resultado: ResultadoCubicacion;
  scale: number;
}) {
  const largoBulto = (producto.largo_por_bulto / 1000) * scale;
  const anchoBulto = (producto.ancho_por_bulto / 1000) * scale;
  const altoBulto = (producto.alto_por_bulto / 1000) * scale;

  const boxes: JSX.Element[] = [];

  for (let ix = 0; ix < resultado.cajasPorLargo; ix++) {
    for (let iy = 0; iy < resultado.cajasPorAncho; iy++) {
      for (let iz = 0; iz < resultado.capas; iz++) {
        const x =
          -((resultado.cajasPorLargo * largoBulto) / 2) +
          largoBulto / 2 +
          ix * largoBulto;
        const z =
          -((resultado.cajasPorAncho * anchoBulto) / 2) +
          anchoBulto / 2 +
          iy * anchoBulto;
        const y = 0.12 + altoBulto / 2 + iz * altoBulto; // 0.12 = altura pallet

        boxes.push(
          <mesh key={`${ix}-${iy}-${iz}`} position={[x, y, z]}>
            <boxGeometry
              args={[largoBulto * 0.98, altoBulto * 0.98, anchoBulto * 0.98]}
            />
            <meshStandardMaterial color="#4b6584" />
          </mesh>
        );
      }
    }
  }

  return <>{boxes}</>;
}

export function HighQualityPalletViewer3D({
  producto,
  contenedor,
  resultado,
}: HighQualityPalletViewer3DProps) {
  if (resultado.cajasPorCapa <= 0 || resultado.capas <= 0) return null;

  const { baseLargo, baseAncho, scale } = getScaleFactors(contenedor);

  const isPallet =
    contenedor.codigo.toUpperCase().includes("PALLET") ||
    contenedor.descripcion.toUpperCase().includes("PALLET");

  return (
    <div className="mt-6 h-80 md:h-96 rounded-md overflow-hidden border border-slate-800 bg-slate-950">
      <Canvas shadows={false}>
        {/* Cámara */}
        <PerspectiveCamera makeDefault position={[3, 3, 3]} fov={40} />
        <OrbitControls
          enablePan={false} // Evitamos que el usuario mueva toda la escena sin querer
          enableZoom
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={0.4}
          target={[0, 0.6, 0]} // 👈 Apuntamos al centro de cajas+pallet
        />

        {/* Luces */}
        <ambientLight intensity={1.1} />
        <directionalLight position={[5, 8, 5]} intensity={1.2}  />


        {/* Pallet base */}
        <PalletBase largo={baseLargo} ancho={baseAncho} />

        {/* Cajas apiladas */}
        <BoxesStack producto={producto} resultado={resultado} scale={scale} />
      </Canvas>

      <p className="px-3 pb-2 pt-1 text-[10px] text-slate-400">
        Vista 3D de la carga sobre el {isPallet ? "pallet" : "contenedor"} según
        la mejor cubicación calculada. Podés rotar y hacer zoom con el mouse.
      </p>
    </div>
  );
}
