'use client';

// Low-poly mockups built from primitives (no downloaded assets), roughly 1 unit wide, sitting on y = 0.
import type { ReactNode } from 'react';

type P = { color?: string };

function Box({ args, position, color, rotation }: { args: [number, number, number]; position: [number, number, number]; color: string; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Cyl({ args, position, color, rotation }: { args: [number, number, number, number?]; position: [number, number, number]; color: string; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[args[0], args[1], args[2], args[3] ?? 12]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function Wheels({ xs, z = 0.2, y = 0.09, r = 0.09 }: { xs: number[]; z?: number; y?: number; r?: number }) {
  return (
    <>
      {xs.flatMap((x) =>
        [z, -z].map((zz) => <Cyl key={`${x}:${zz}`} args={[r, r, 0.06, 10]} position={[x, y, zz]} rotation={[Math.PI / 2, 0, 0]} color="#222" />),
      )}
    </>
  );
}

/** Factory: sawtooth roof and a chimney. */
export function Factory() {
  return (
    <group>
      <Box args={[1, 0.45, 0.7]} position={[0, 0.225, 0]} color="#8d99ae" />
      {[-0.33, 0, 0.33].map((x) => (
        <Box key={x} args={[0.32, 0.18, 0.7]} position={[x, 0.53, 0]} rotation={[0, 0, 0.5]} color="#6c7a91" />
      ))}
      <Cyl args={[0.07, 0.09, 0.75]} position={[0.38, 0.75, -0.2]} color="#b04a3b" />
      <Box args={[0.18, 0.22, 0.02]} position={[-0.25, 0.11, 0.36]} color="#3d4a5c" />
    </group>
  );
}

/** Lorry: cab plus a container trailer. */
export function Truck({ color = '#2a9d8f' }: P) {
  return (
    <group>
      <Box args={[0.62, 0.32, 0.38]} position={[-0.12, 0.31, 0]} color={color} />
      <Box args={[0.24, 0.26, 0.36]} position={[0.33, 0.28, 0]} color="#e9c46a" />
      <Box args={[0.02, 0.1, 0.26]} position={[0.46, 0.33, 0]} color="#9ad1ff" />
      <Wheels xs={[-0.3, 0.05, 0.33]} />
    </group>
  );
}

/** Small delivery van. */
export function Van({ color = '#f4a261' }: P) {
  return (
    <group>
      <Box args={[0.6, 0.3, 0.34]} position={[0, 0.27, 0]} color={color} />
      <Box args={[0.02, 0.12, 0.26]} position={[0.31, 0.32, 0]} color="#9ad1ff" />
      <Wheels xs={[-0.18, 0.18]} z={0.17} r={0.08} />
    </group>
  );
}

/** Container ship. */
export function Ship() {
  const boxes = ['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8ab17d'];
  return (
    <group>
      <Box args={[1.1, 0.18, 0.36]} position={[0, 0.09, 0]} color="#1d3557" />
      <Box args={[0.2, 0.14, 0.32]} position={[0.62, 0.11, 0]} rotation={[0, 0, 0.4]} color="#1d3557" />
      <Box args={[0.16, 0.28, 0.3]} position={[-0.42, 0.32, 0]} color="#f1faee" />
      {boxes.map((c, i) => (
        <Box key={i} args={[0.17, 0.11, 0.14]} position={[-0.18 + (i % 3) * 0.19, 0.24 + Math.floor(i / 3) * 0.11, i % 2 ? 0.08 : -0.08]} color={c} />
      ))}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 0.7]} />
        <meshStandardMaterial color="#5fa8d3" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

/** Cargo plane. */
export function Plane() {
  return (
    <group position={[0, 0.35, 0]}>
      <Cyl args={[0.09, 0.07, 0.95]} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} color="#e5e5e5" />
      <Box args={[0.22, 0.02, 0.95]} position={[0, 0, 0]} color="#c9ced6" />
      <Box args={[0.12, 0.02, 0.36]} position={[-0.42, 0.04, 0]} color="#c9ced6" />
      <Box args={[0.12, 0.18, 0.02]} position={[-0.43, 0.11, 0]} color="#e63946" />
      <Cyl args={[0.045, 0.045, 0.14]} position={[0.02, -0.05, 0.25]} rotation={[0, 0, Math.PI / 2]} color="#888" />
      <Cyl args={[0.045, 0.045, 0.14]} position={[0.02, -0.05, -0.25]} rotation={[0, 0, Math.PI / 2]} color="#888" />
    </group>
  );
}

/** Port and customs: container crane over a quay with a customs hut. */
export function Customs() {
  return (
    <group>
      <Box args={[1, 0.06, 0.7]} position={[0, 0.03, 0]} color="#adb5bd" />
      <Box args={[0.05, 0.75, 0.05]} position={[-0.3, 0.42, -0.2]} color="#f4a261" />
      <Box args={[0.05, 0.75, 0.05]} position={[-0.3, 0.42, 0.2]} color="#f4a261" />
      <Box args={[0.75, 0.05, 0.05]} position={[0.05, 0.8, 0]} color="#f4a261" />
      <Box args={[0.05, 0.05, 0.45]} position={[-0.3, 0.8, 0]} color="#f4a261" />
      <Box args={[0.2, 0.12, 0.14]} position={[0.3, 0.5, 0]} color="#e76f51" />
      <Box args={[0.3, 0.22, 0.25]} position={[0.3, 0.17, 0.2]} color="#457b9d" />
      <Box args={[0.34, 0.04, 0.29]} position={[0.3, 0.3, 0.2]} color="#1d3557" />
    </group>
  );
}

/** Warehouse with gable roof, roller door and pallets. */
export function Warehouse() {
  return (
    <group>
      <Box args={[1, 0.4, 0.7]} position={[0, 0.2, 0]} color="#d4a373" />
      <Box args={[1.04, 0.05, 0.42]} position={[0, 0.47, 0.17]} rotation={[0.55, 0, 0]} color="#7f5539" />
      <Box args={[1.04, 0.05, 0.42]} position={[0, 0.47, -0.17]} rotation={[-0.55, 0, 0]} color="#7f5539" />
      <Box args={[0.3, 0.28, 0.02]} position={[-0.2, 0.14, 0.36]} color="#6c757d" />
      <Box args={[0.3, 0.28, 0.02]} position={[0.2, 0.14, 0.36]} color="#6c757d" />
      <Box args={[0.16, 0.1, 0.16]} position={[0.42, 0.05, 0.5]} color="#bc6c25" />
    </group>
  );
}

function Awning({ width, z, y, colors }: { width: number; z: number; y: number; colors: [string, string] }) {
  const n = 6;
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Box key={i} args={[width / n, 0.03, 0.2]} position={[-width / 2 + (i + 0.5) * (width / n), y, z]} rotation={[0.35, 0, 0]} color={colors[i % 2]} />
      ))}
    </>
  );
}

/** Supermarket: wide store, glass front, striped awning and sign. */
export function Supermarket({ sign = '#e63946' }: { sign?: string }) {
  return (
    <group>
      <Box args={[1, 0.42, 0.7]} position={[0, 0.21, 0]} color="#f1faee" />
      <Box args={[0.7, 0.22, 0.02]} position={[0, 0.14, 0.36]} color="#a8dadc" />
      <Awning width={1} z={0.42} y={0.32} colors={[sign, '#ffffff']} />
      <Box args={[0.6, 0.12, 0.04]} position={[0, 0.52, 0.3]} color={sign} />
      <Box args={[0.14, 0.08, 0.1]} position={[0.42, 0.05, 0.5]} color="#adb5bd" />
    </group>
  );
}

/** Cash & carry / wholesale: big shed with loading bay and a sign. */
export function Wholesale() {
  return (
    <group>
      <Box args={[1, 0.5, 0.7]} position={[0, 0.25, 0]} color="#e9ecef" />
      <Box args={[1.02, 0.06, 0.72]} position={[0, 0.52, 0]} color="#1d3557" />
      <Box args={[0.5, 0.12, 0.04]} position={[-0.15, 0.4, 0.36]} color="#ffb703" />
      <Box args={[0.25, 0.25, 0.02]} position={[0.3, 0.13, 0.36]} color="#6c757d" />
    </group>
  );
}

/** B2B platform hub: depot with a screen and a parcel stack. */
export function Hub() {
  return (
    <group>
      <Box args={[0.9, 0.35, 0.6]} position={[0, 0.175, 0]} color="#cdb4db" />
      <Box args={[0.45, 0.28, 0.03]} position={[0, 0.55, 0.05]} color="#1d3557" />
      <Box args={[0.39, 0.22, 0.01]} position={[0, 0.55, 0.07]} color="#8ecae6" />
      <Box args={[0.05, 0.2, 0.05]} position={[0, 0.4, 0.05]} color="#495057" />
      {[0, 1, 2].map((i) => <Box key={i} args={[0.14, 0.1, 0.14]} position={[0.36, 0.05 + i * 0.1, 0.42]} color="#d4a373" />)}
    </group>
  );
}

/** Corner shop / mini-mart. */
export function Shop() {
  return (
    <group>
      <Box args={[0.6, 0.4, 0.5]} position={[0, 0.2, 0]} color="#ffe8d6" />
      <Box args={[0.4, 0.2, 0.02]} position={[0, 0.13, 0.26]} color="#a8dadc" />
      <Awning width={0.6} z={0.32} y={0.32} colors={['#2a9d8f', '#ffffff']} />
      <Box args={[0.64, 0.05, 0.54]} position={[0, 0.43, 0]} color="#6d6875" />
    </group>
  );
}

/** Hawker / food stall: counter, umbrella and stools. */
export function FoodStall() {
  return (
    <group>
      <Box args={[0.6, 0.25, 0.3]} position={[0, 0.125, 0]} color="#bc6c25" />
      <Cyl args={[0.02, 0.02, 0.45]} position={[0, 0.45, 0]} color="#555" />
      <mesh position={[0, 0.68, 0]}>
        <coneGeometry args={[0.45, 0.18, 10]} />
        <meshStandardMaterial color="#e63946" />
      </mesh>
      {[-0.2, 0.2].map((x) => <Cyl key={x} args={[0.06, 0.06, 0.15]} position={[x, 0.075, 0.32]} color="#457b9d" />)}
      <Cyl args={[0.08, 0.08, 0.06]} position={[-0.12, 0.28, 0]} color="#adb5bd" />
    </group>
  );
}

/** Consumer: a person with a shopping basket. */
export function Consumer() {
  return (
    <group>
      <Cyl args={[0.1, 0.13, 0.4]} position={[0, 0.2, 0]} color="#3a86ff" />
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.1, 14, 14]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
      <Box args={[0.18, 0.1, 0.12]} position={[0.2, 0.18, 0.05]} color="#2a9d8f" />
    </group>
  );
}

export type FreightMode = 'truck' | 'ship' | 'plane';

/** The mockup shown for a stage of one branch. */
export function stageModel(stage: string, opts: { freight: FreightMode; channelType: string; outletKind: 'food' | 'shop' }): ReactNode {
  switch (stage) {
    case 'Production':
      return <Factory />;
    case 'Origin logistics':
      return <Truck />;
    case 'Main freight':
      return opts.freight === 'ship' ? <Ship /> : opts.freight === 'plane' ? <Plane /> : <Truck color="#457b9d" />;
    case 'Import':
      return <Customs />;
    case 'Warehouse':
      return <Warehouse />;
    case 'Delivery to channel':
      return <Van />;
    case 'Channel':
      return opts.channelType === 'b2b_platform' ? <Hub /> : opts.channelType === 'wholesale' ? <Wholesale /> : opts.channelType === 'distributor' ? <Warehouse /> : <Supermarket />;
    case 'Outlet / end user':
      return opts.outletKind === 'food' ? <FoodStall /> : <Shop />;
    default:
      return <Consumer />;
  }
}

/** Small vehicle used for goods moving along a lane. */
export function stageVehicle(fromStage: string, freight: FreightMode): ReactNode {
  if (fromStage === 'Origin logistics' || fromStage === 'Main freight') return freight === 'ship' ? <Ship /> : freight === 'plane' ? <Plane /> : <Truck color="#457b9d" />;
  if (fromStage === 'Warehouse' || fromStage === 'Delivery to channel') return <Van />;
  return <Truck />;
}
