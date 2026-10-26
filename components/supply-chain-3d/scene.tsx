'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { Mesh } from 'three';
import { CHAIN_STAGES } from '@/lib/calc/play';
import type { Traced } from '@/lib/calc/traced';
import { LAYER_HEX, stack } from '@/lib/layers';
import type { BranchModel } from './compute';

const DX = 2.2;
const DZ = 2.6;
const MAX_H = 6;

/** Goods in transit along a lane. */
function Particle({ x0, x1, z, phase, speed }: { x0: number; x1: number; z: number; phase: number; speed: number }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed + phase) % 1;
    ref.current.position.x = x0 + (x1 - x0) * t;
  });
  return (
    <mesh ref={ref} position={[x0, 0.12, z]}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshStandardMaterial color="#ffffff" emissive="#9ab4ff" emissiveIntensity={0.6} />
    </mesh>
  );
}

const pointer = {
  onPointerOver: (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  },
  onPointerOut: () => {
    document.body.style.cursor = '';
  },
};

/**
 * Stylised stage-by-stage chain (spec §11.1). X = stages, Z = one branch per channel/market.
 * Each stage shows a column of stacked per-unit cost layers rising like a staircase to the shelf price;
 * the newest layers are solid, earlier ones faded. Green = contribution, red cap = loss.
 */
export default function ChainScene({ models, onSelect, reducedMotion }: { models: BranchModel[]; onSelect: (t: Traced) => void; reducedMotion: boolean }) {
  const maxTop = useMemo(() => Math.max(1e-9, ...models.map((m) => stack(m.layers).reduce((mx, s) => Math.max(mx, s.top), 0))), [models]);
  const maxQ = Math.max(1, ...models.map((m) => m.volume.value));
  const maxStock = Math.max(1, ...models.map((m) => m.stock.value));
  const h = (v: number) => (v / maxTop) * MAX_H;
  const z0 = -((models.length - 1) * DZ) / 2;
  const x0 = -((CHAIN_STAGES.length - 1) * DX) / 2;
  const whIndex = CHAIN_STAGES.indexOf('Warehouse');

  return (
    <Canvas camera={{ position: [9, 8, 12], fov: 45 }} dpr={[1, 1.75]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 12, 8]} intensity={0.9} />
      <OrbitControls enablePan makeDefault maxPolarAngle={Math.PI / 2.05} />
      <gridHelper args={[40, 40, '#888888', '#444444']} position={[0, -0.01, 0]} />

      {CHAIN_STAGES.map((s, si) => (
        <Html key={s} position={[x0 + si * DX, -0.2, z0 + (models.length - 1) * DZ + 1.4]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <span className="rounded bg-card/80 px-1 text-[11px] whitespace-nowrap text-foreground">{s}</span>
        </Html>
      ))}

      {models.map((m, bi) => {
        const z = z0 + bi * DZ;
        const tube = 0.05 + (m.volume.value / maxQ) * 0.22;
        const stacked = stack(m.layers);
        const foot = 0.6 + (m.stock.value / maxStock) * 1.1;
        return (
          <group key={m.branch.id}>
            <Html position={[x0 - 1.6, 0.3, z]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
              <span className="rounded bg-card/80 px-1 text-[11px] font-medium whitespace-nowrap text-foreground">{m.branch.channel}</span>
            </Html>
            {CHAIN_STAGES.slice(0, -1).map((_, si) => (
              <group key={si}>
                <mesh
                  position={[x0 + si * DX + DX / 2, 0.12, z]}
                  rotation={[0, 0, Math.PI / 2]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(m.volume);
                  }}
                  {...pointer}
                >
                  <cylinderGeometry args={[tube, tube, DX - 0.8, 12]} />
                  <meshStandardMaterial color="#6d93ff" transparent opacity={0.45} />
                </mesh>
                {!reducedMotion ? <Particle x0={x0 + si * DX + 0.4} x1={x0 + (si + 1) * DX - 0.4} z={z} phase={(si * 0.37 + bi * 0.21) % 1} speed={0.35} /> : null}
              </group>
            ))}
            <mesh
              position={[x0 + whIndex * DX, 0.01, z]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.stock);
              }}
              {...pointer}
            >
              <boxGeometry args={[foot, 0.02, foot]} />
              <meshStandardMaterial color="#d98a00" transparent opacity={0.35} />
            </mesh>
            {CHAIN_STAGES.map((stage, si) => {
              const x = x0 + si * DX;
              return stacked
                .filter((s) => CHAIN_STAGES.indexOf(s.layer.stage) <= si)
                .map((s, li) => {
                  const isNew = s.layer.stage === stage;
                  const height = Math.max(0.005, h(s.top - s.bottom));
                  const solid = isNew || s.layer.kind === 'loss' || s.layer.kind === 'contribution';
                  return (
                    <mesh
                      key={`${si}-${li}`}
                      position={[x, h(s.bottom) + height / 2, z]}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(s.layer.t);
                      }}
                      {...pointer}
                    >
                      <boxGeometry args={[0.7, height, 0.7]} />
                      <meshStandardMaterial color={LAYER_HEX[s.layer.kind]} transparent opacity={solid ? 0.95 : 0.3} />
                    </mesh>
                  );
                });
            })}
          </group>
        );
      })}
    </Canvas>
  );
}
