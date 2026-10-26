import type { PlayContext, PlayInputs } from '@/lib/calc/play';

export interface Branch {
  id: string;
  title: string;
  market: string;
  channel: string;
  inputs: PlayInputs;
  ctx: PlayContext;
  unitsPerCarton: number;
  sizeLitres: number;
  /** How the main freight leg moves (drives the 3D mockup). */
  freight: 'truck' | 'ship' | 'plane';
  channelType: string;
  /** Food-service outlets show a stall; retail outlets a shop. */
  outletKind: 'food' | 'shop';
}

export type UnitMode = 'unit' | 'litre' | 'carton' | 'm3';
