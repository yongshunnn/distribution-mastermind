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
}

export type UnitMode = 'unit' | 'litre' | 'carton' | 'm3';
