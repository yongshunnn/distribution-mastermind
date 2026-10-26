'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Html, OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import { stageModel, stageVehicle, type FreightMode } from './models';
import { CHAIN_STAGES } from '@/lib/calc/play';
import type { Traced } from '@/lib/calc/traced';
import { LAYER_HEX, stack } from '@/lib/layers';
import type { BranchModel } from './compute';
import { Num } from '../num';

const DX = 2.2;
const DZ = 2.6;
const MAX_H = 6;

/** Goods in transit along a lane: a small truck, ship or plane matching the leg. Planes fly an arc. */
function Vehicle({ x0, x1, z, phase, speed, children, flying }: { x0: number; x1: number; z: number; phase: number; speed: number; children: React.ReactNode; flying?: boolean }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed + phase) % 1;
    ref.current.position.x = x0 + (x1 - x0) * t;
    if (flying) ref.current.position.y = 0.25 + Math.sin(Math.PI * t) * 0.9;
  });
  return (
    <group ref={ref} position={[x0, flying ? 0.25 : 0.02, z]} scale={0.3}>
      {children}
    </group>
  );
}

/** Pulls the camera back on tall (phone) viewports so the whole chain fits. */
function CameraFit({ branches }: { branches: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const back = aspect < 1.6 ? 1.6 / aspect : 1;
    camera.position.set(3.5 * back, 6.5 * back, (8 + branches * 1.6) * back);
    camera.lookAt(0, 1.2, 0);
  }, [camera, size.width, size.height, branches]);
  return null;
}

const MODEL_SCALE = 0.62;
const MODEL_DZ = 1.08;

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
export default function ChainScene({ models, onSelect, reducedMotion, showPrices = true }: { models: BranchModel[]; onSelect: (t: Traced) => void; reducedMotion: boolean; showPrices?: boolean }) {
  const maxTop = useMemo(() => Math.max(1e-9, ...models.map((m) => stack(m.layers).reduce((mx, s) => Math.max(mx, s.top), 0))), [models]);
  const maxQ = Math.max(1, ...models.map((m) => m.volume.value));
  const maxStock = Math.max(1, ...models.map((m) => m.stock.value));
  const h = (v: number) => (v / maxTop) * MAX_H;
  const z0 = -((models.length - 1) * DZ) / 2;
  const x0 = -((CHAIN_STAGES.length - 1) * DX) / 2;
  const whIndex = CHAIN_STAGES.indexOf('Warehouse');

  return (
    <Canvas camera={{ position: [3.5, 6.5, 8 + models.length * 1.6], fov: 45 }} dpr={[1, 1.75]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 12, 8]} intensity={0.9} />
      <hemisphereLight args={['#ffffff', '#8899aa', 0.35]} />
      <CameraFit branches={models.length} />
      <OrbitControls enablePan makeDefault maxPolarAngle={Math.PI / 2.05} target={[0, 1.2, 0]} />
      <gridHelper args={[26, 26, '#9aa3ad', '#c9ced6']} position={[0, -0.01, 0]} />

      {CHAIN_STAGES.map((s, si) => (
        <Html zIndexRange={[20, 0]} key={s} position={[x0 + si * DX, -0.2, z0 + (models.length - 1) * DZ + 1.75]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
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
            <Html zIndexRange={[20, 0]} position={[x0 - 1.6, 0.3, z]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
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
                {!reducedMotion ? (
                  <Vehicle
                    x0={x0 + si * DX + 0.45}
                    x1={x0 + (si + 1) * DX - 0.45}
                    z={z + 0.32}
                    phase={(si * 0.37 + bi * 0.21) % 1}
                    speed={0.22}
                    flying={m.branch.freight === 'plane' && (CHAIN_STAGES[si] === 'Origin logistics' || CHAIN_STAGES[si] === 'Main freight')}
                  >
                    {stageVehicle(CHAIN_STAGES[si], m.branch.freight as FreightMode)}
                  </Vehicle>
                ) : null}
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
            {showPrices
              ? CHAIN_STAGES.map((stage, si) => {
                  const upto = stacked.filter((s) => CHAIN_STAGES.indexOf(s.layer.stage) <= si);
                  const top = upto.reduce((mx, s) => Math.max(mx, s.top), 0);
                  const price = m.cumulative[stage];
                  const contribution = stage === 'Channel' ? m.C : null;
                  if (!price) return null;
                  return (
                    <Html key={`price-${stage}`} zIndexRange={[20, 0]} position={[x0 + si * DX, h(top) + 0.3, z]} center distanceFactor={10}>
                      <div className="flex flex-col items-center gap-0.5" data-testid="chain-price">
                        <span className="rounded-md border border-border bg-card/95 px-1 text-[11px] leading-tight whitespace-nowrap shadow-sm">
                          <Num t={price} />
                        </span>
                        {contribution ? (
                          <span className={`rounded-md px-1 text-[10px] leading-tight whitespace-nowrap ${contribution.value < 0 ? 'bg-danger-bg text-danger' : 'bg-ok-bg text-ok'}`}>
                            {contribution.value < 0 ? 'loss ' : 'margin '}
                            <Num t={contribution} />
                          </span>
                        ) : null}
                      </div>
                    </Html>
                  );
                })
              : null}
            {CHAIN_STAGES.map((stage, si) => (
              <group
                key={`model-${stage}`}
                position={[x0 + si * DX, 0, z + MODEL_DZ]}
                scale={MODEL_SCALE}
                onClick={(e) => {
                  e.stopPropagation();
                  const t = m.stageTotals[stage];
                  if (t) onSelect(t);
                }}
                {...pointer}
              >
                {stageModel(stage, { freight: m.branch.freight as FreightMode, channelType: m.branch.channelType, outletKind: m.branch.outletKind })}
              </group>
            ))}
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
