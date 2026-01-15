"use client";

import {
  Bounds,
  Edges,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { JSX, useMemo, useState } from "react";
import type { CubicacionBulto3DInput } from "../types/cubicacion-3d";

interface Props {
  data: CubicacionBulto3DInput;
  gapFactor?: number;
  visualGapMm?: number;
}

type ViewerMode = "OPERATIVO" | "TECNICO";

const PALETTE = [
  "#2563EB",
  "#16A34A",
  "#DC2626",
  "#F59E0B",
  "#7C3AED",
  "#0EA5E9",
  "#DB2777",
  "#64748B",
];

function colorForProducto(productoId: number) {
  return PALETTE[Math.abs(productoId) % PALETTE.length];
}

function roundKey(v: number) {
  return Math.round(v * 1000) / 1000;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// =========================
// Compat helpers (NO rompe legacy)
// =========================
type DimMm = { largo: number; ancho: number; alto: number };
type PosMm = { x: number; y: number; z: number };

type PlacementCompat = {
  tipo_producto_id?: number;
  productoId?: number;
  codigo?: string;
  dim_unidad_mm?: DimMm;
  dimUnidadMm?: DimMm;
  positionMm?: PosMm;
};

function getPlacements(data: CubicacionBulto3DInput): PlacementCompat[] {
  const p = (data as any).placements;
  return Array.isArray(p) ? (p as PlacementCompat[]) : [];
}

function getPidFromPlacement(p: PlacementCompat) {
  const n = Number(p.tipo_producto_id ?? p.productoId ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getDimFromPlacement(p: PlacementCompat): DimMm | null {
  return (p.dim_unidad_mm ?? p.dimUnidadMm ?? null) as any;
}

export function CubicacionBultoViewer3D({
  data,
  gapFactor = 0.98,
  visualGapMm = 1.5,
}: Props) {
  const { bulto, contenido } = data;

  // ✅ NUEVO: placements (si existe en el flujo nuevo)
  const placements = useMemo(() => getPlacements(data), [data]);

  const bultoSizeM = useMemo(() => {
    return {
      x: bulto.dimInternaMm.largo / 1000,
      y: bulto.dimInternaMm.alto / 1000,
      z: bulto.dimInternaMm.ancho / 1000,
    };
  }, [bulto.dimInternaMm]);

  // ✅ NUEVO: detecta layout en placements primero; si no, usa contenido (legacy)
  const hasPositionsPlacements = placements.some((p) => !!p.positionMm);
  const hasPositionsContenido = contenido.some((c) => !!c.positionMm);
  const sourceMode: "PLACEMENTS" | "CONTENIDO" | "NONE" = hasPositionsPlacements
    ? "PLACEMENTS"
    : hasPositionsContenido
    ? "CONTENIDO"
    : "NONE";

  const hasPositions = sourceMode !== "NONE";

  const [mode, setMode] = useState<ViewerMode>("OPERATIVO");

  const legend = useMemo(() => {
    const map = new Map<number, { codigo: string; count: number; color: string }>();

    // Preferimos la semántica del contenido (legacy) si está
    if (contenido?.length) {
      for (const it of contenido) {
        const pid = it.productoId;
        const reps = Math.max(1, Math.floor(it.unidades ?? 1));
        const codigo = String(it.codigo ?? `PROD-${pid}`).trim() || `PROD-${pid}`;

        const prev = map.get(pid);
        if (!prev) map.set(pid, { codigo, count: reps, color: colorForProducto(pid) });
        else prev.count += reps;
      }
    } else if (placements.length) {
      // placements suele venir “1 por unidad”
      for (const p of placements) {
        const pid = getPidFromPlacement(p);
        const codigo = String(p.codigo ?? `PROD-${pid}`).trim() || `PROD-${pid}`;

        const prev = map.get(pid);
        if (!prev) map.set(pid, { codigo, count: 1, color: colorForProducto(pid) });
        else prev.count += 1;
      }
    }

    return Array.from(map.entries())
      .map(([productoId, v]) => ({ productoId, ...v }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [contenido, placements]);

  const capas = useMemo(() => {
    if (!hasPositions) return [];

    const ys =
      sourceMode === "PLACEMENTS"
        ? placements
            .map((p) => p.positionMm?.y)
            .filter((y): y is number => typeof y === "number")
            .map((y) => roundKey(y / 1000))
        : contenido
            .map((c) => c.positionMm?.y)
            .filter((y): y is number => typeof y === "number")
            .map((y) => roundKey(y / 1000));

    return Array.from(new Set(ys)).sort((a, b) => a - b);
  }, [placements, contenido, hasPositions, sourceMode]);

  const [capaSeleccionada, setCapaSeleccionada] = useState<number | null>(null);

  const totalUnidadesDibujadas = useMemo(() => {
    if (!hasPositions) return 0;

    // placements: 1 placement = 1 unidad (lo más común)
    if (sourceMode === "PLACEMENTS") return placements.length;

    // legacy
    return contenido.reduce(
      (acc, it) => acc + Math.max(1, Math.floor(it.unidades ?? 1)),
      0
    );
  }, [contenido, hasPositions, sourceMode, placements.length]);

  const sizeWithVisualGap = (mm: number) => {
    const scaled = mm * gapFactor;
    const adjusted = Math.max(0.1, scaled - visualGapMm);
    return adjusted / 1000;
  };

  const bultoOpacity = mode === "OPERATIVO" ? 0.03 : 0.06;
  const bultoEdgesOpacity = mode === "OPERATIVO" ? 0.25 : 0.55;

  const cubeOpacityBase = mode === "OPERATIVO" ? 0.92 : 0.9;
  const cubeEdgesOpacity = mode === "OPERATIVO" ? 0.35 : 0.7;

  const pisoY = -bultoSizeM.y / 2;

  return (
    <div className="w-full rounded-md border bg-slate-50 overflow-hidden">
      <div className="px-3 py-2 border-b bg-white space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-700">
              Leyenda (producto → color)
            </p>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-700">
              {legend.length ? (
                legend.map((l) => (
                  <div key={l.productoId} className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-sm border border-slate-300"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="font-medium">{l.codigo}</span>
                    <span className="text-slate-500">× {l.count}</span>
                  </div>
                ))
              ) : (
                <span className="text-slate-500">Sin contenido para mostrar.</span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-600 text-right space-y-1">
            <div>
              Bulto interno:{" "}
              <span className="font-semibold">
                {bulto.dimInternaMm.largo}×{bulto.dimInternaMm.ancho}×
                {bulto.dimInternaMm.alto} mm
              </span>
            </div>

            {hasPositions && (
              <div>
                Unidades dibujadas:{" "}
                <span className="font-semibold">{totalUnidadesDibujadas}</span>
              </div>
            )}

            <div className="pt-1">
              <span className="text-[11px] text-slate-500 mr-2">Modo:</span>
              <div className="inline-flex rounded-md overflow-hidden border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMode("OPERATIVO")}
                  className={[
                    "px-2 py-1 text-[11px]",
                    mode === "OPERATIVO"
                      ? "bg-indigo-50 text-indigo-800"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Operativo
                </button>
                <button
                  type="button"
                  onClick={() => setMode("TECNICO")}
                  className={[
                    "px-2 py-1 text-[11px] border-l border-slate-200",
                    mode === "TECNICO"
                      ? "bg-indigo-50 text-indigo-800"
                      : "bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Técnico
                </button>
              </div>
            </div>

            {/* ✅ Debug: te dice qué fuente está usando */}
            <div className="text-[11px] text-slate-500">
              Fuente:{" "}
              <span className="font-medium">
                {sourceMode === "PLACEMENTS"
                  ? `placements (${placements.length})`
                  : sourceMode === "CONTENIDO"
                  ? `contenido (${contenido.length})`
                  : "sin layout"}
              </span>
            </div>
          </div>
        </div>

        {mode === "TECNICO" && hasPositions && capas.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-700">
              Foco por capas:
            </span>

            <button
              type="button"
              onClick={() => setCapaSeleccionada(null)}
              className={[
                "px-2 py-1 rounded border text-[11px]",
                capaSeleccionada === null
                  ? "bg-indigo-50 border-indigo-300"
                  : "bg-white border-slate-200",
              ].join(" ")}
            >
              Todas
            </button>

            {capas.map((yM, idx) => (
              <button
                key={`${yM}-${idx}`}
                type="button"
                onClick={() => setCapaSeleccionada(yM)}
                className={[
                  "px-2 py-1 rounded border text-[11px]",
                  capaSeleccionada === yM
                    ? "bg-indigo-50 border-indigo-300"
                    : "bg-white border-slate-200",
                ].join(" ")}
                title={`Capa con centro Y=${(yM * 1000).toFixed(0)} mm`}
              >
                Capa {idx + 1}
              </button>
            ))}

            <span className="text-[11px] text-slate-500">
              (solo atenúa lo no enfocado)
            </span>
          </div>
        )}
      </div>

      <div className="h-105 w-full">
        <Canvas
          camera={{ position: [1.25, 1.15, 1.25], fov: 45 }}
          shadows={mode === "OPERATIVO"}
        >
          <ambientLight intensity={0.9} />
          <directionalLight
            position={[3, 4, 3]}
            intensity={0.9}
            castShadow={mode === "OPERATIVO"}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />

          <OrbitControls makeDefault />

          {mode === "TECNICO" && (
            <>
              <GizmoHelper alignment="top-right" margin={[12, 12]}>
                <GizmoViewport />
              </GizmoHelper>

              <Grid
                args={[2, 2]}
                position={[0, pisoY - 0.001, 0]}
                cellSize={0.1}
                sectionSize={0.5}
                fadeDistance={3}
                fadeStrength={1}
              />
            </>
          )}

          <Bounds fit observe margin={1.25}>
            {/* Piso */}
            <mesh
              renderOrder={0}
              position={[0, pisoY - 0.0005, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              receiveShadow={mode === "OPERATIVO"}
              frustumCulled={false}
            >
              <planeGeometry args={[bultoSizeM.x, bultoSizeM.z]} />
              <meshStandardMaterial
                color="#94a3b8"
                transparent
                opacity={mode === "OPERATIVO" ? 0.12 : 0.08}
                roughness={1}
                metalness={0}
                depthWrite={false}
              />
            </mesh>

            {/* Bulto */}
            <mesh renderOrder={1} frustumCulled={false}>
              <boxGeometry args={[bultoSizeM.x, bultoSizeM.y, bultoSizeM.z]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={bultoOpacity}
                depthWrite={false}
              />
              <Edges color="#334155" opacity={bultoEdgesOpacity} transparent />
            </mesh>

            {/* Contenido */}
            {hasPositions ? (
              sourceMode === "PLACEMENTS" ? (
                placements.map((p, idx) => {
                  const pid = getPidFromPlacement(p);
                  const color = colorForProducto(pid);

                  const dim = getDimFromPlacement(p);
                  const pos = p.positionMm;

                  if (!dim || !pos) return null;

                  const sizeM = {
                    x: sizeWithVisualGap(dim.largo),
                    y: sizeWithVisualGap(dim.alto),
                    z: sizeWithVisualGap(dim.ancho),
                  };

                  const yKey = roundKey(pos.y / 1000);
                  const focusAlpha =
                    mode === "TECNICO" && capaSeleccionada !== null
                      ? yKey === capaSeleccionada
                        ? 1
                        : 0.18
                      : 1;

                  return (
                    <mesh
                      key={`${pid}-${idx}`}
                      renderOrder={2}
                      frustumCulled={false}
                      position={[pos.x / 1000, pos.y / 1000, pos.z / 1000]}
                      castShadow={mode === "OPERATIVO"}
                      receiveShadow={mode === "OPERATIVO"}
                    >
                      <boxGeometry args={[sizeM.x, sizeM.y, sizeM.z]} />
                      <meshStandardMaterial
                        color={color}
                        transparent
                        opacity={clamp01(cubeOpacityBase * focusAlpha)}
                        roughness={mode === "OPERATIVO" ? 0.65 : 0.75}
                        metalness={0}
                      />
                      <Edges
                        color="#0f172a"
                        opacity={clamp01(cubeEdgesOpacity * focusAlpha)}
                        transparent
                      />
                    </mesh>
                  );
                })
              ) : (
                contenido.map((item, idx) => {
                  const pid = item.productoId;
                  const color = colorForProducto(pid);

                  const sizeM = {
                    x: sizeWithVisualGap(item.dimUnidadMm.largo),
                    y: sizeWithVisualGap(item.dimUnidadMm.alto),
                    z: sizeWithVisualGap(item.dimUnidadMm.ancho),
                  };

                  const reps = Math.max(1, Math.floor(item.unidades ?? 1));
                  const pos = item.positionMm!;

                  const yKey = roundKey(pos.y / 1000);
                  const focusAlpha =
                    mode === "TECNICO" && capaSeleccionada !== null
                      ? yKey === capaSeleccionada
                        ? 1
                        : 0.18
                      : 1;

                  const cubes: JSX.Element[] = [];
                  for (let i = 0; i < reps; i++) {
                    cubes.push(
                      <mesh
                        key={`${pid}-${idx}-${i}`}
                        renderOrder={2}
                        frustumCulled={false}
                        position={[pos.x / 1000, pos.y / 1000, pos.z / 1000]}
                        castShadow={mode === "OPERATIVO"}
                        receiveShadow={mode === "OPERATIVO"}
                      >
                        <boxGeometry args={[sizeM.x, sizeM.y, sizeM.z]} />
                        <meshStandardMaterial
                          color={color}
                          transparent
                          opacity={clamp01(cubeOpacityBase * focusAlpha)}
                          roughness={mode === "OPERATIVO" ? 0.65 : 0.75}
                          metalness={0}
                        />
                        <Edges
                          color="#0f172a"
                          opacity={clamp01(cubeEdgesOpacity * focusAlpha)}
                          transparent
                        />
                      </mesh>
                    );
                  }

                  return <group key={`${pid}-${idx}`}>{cubes}</group>;
                })
              )
            ) : (
              <group />
            )}
          </Bounds>
        </Canvas>
      </div>

      {!hasPositions && (
        <div className="px-3 py-2 text-xs text-amber-700 border-t bg-amber-50">
          No hay layout geométrico disponible para previsualizar esta opción.
        </div>
      )}

      {hasPositions && (
        <div className="px-3 py-2 text-[11px] text-slate-500 border-t bg-white">
          Nota: la separación entre cajas es solo visual (no altera el packing).
        </div>
      )}
    </div>
  );
}
