// Shared colours and stacking for cost layers (2D waterfall and 3D chain).
import type { ChainLayer } from '@/lib/calc/play';

export const LAYER_COLOR: Record<ChainLayer['kind'], string> = {
  product: 'var(--layer-product)',
  logistics: 'var(--layer-logistics)',
  duty_tax: 'var(--layer-duty)',
  warehouse: 'var(--layer-warehouse)',
  delivery: 'var(--layer-delivery)',
  marketing: 'var(--layer-marketing)',
  contribution: 'var(--layer-contribution)',
  loss: 'var(--layer-loss)',
  trade: 'var(--layer-trade)',
  channel_margin: 'var(--layer-channel)',
  retail_margin: 'var(--layer-channel)',
  sales_tax: 'var(--layer-tax)',
};

/** Hex versions for WebGL materials (CSS variables are not available in three.js). */
export const LAYER_HEX: Record<ChainLayer['kind'], string> = {
  product: '#5b7bd5', logistics: '#2aa1b3', duty_tax: '#8e6bd1', warehouse: '#d98a00', delivery: '#c9732c', marketing: '#c44f8a',
  contribution: '#1f9d55', loss: '#d32f2f', trade: '#7a8594', channel_margin: '#a3acb9', retail_margin: '#8c96a3', sales_tax: '#c8ced6',
};

export const KIND_LABEL: Record<ChainLayer['kind'], string> = {
  product: 'Product', logistics: 'Logistics', duty_tax: 'Duty & tax', warehouse: 'Warehouse & cash', delivery: 'Delivery', marketing: 'Marketing',
  contribution: 'Our contribution', loss: 'Loss', trade: 'Rebates & listing', channel_margin: 'Channel margin', retail_margin: 'Retailer margin', sales_tax: 'Sales tax',
};

export interface StackedLayer {
  layer: ChainLayer;
  bottom: number;
  top: number;
}

/** Cumulative stacking. A loss layer sits on top of the costs it fails to cover (a red cap), and the stack continues from P_net. */
export function stack(layers: ChainLayer[]): StackedLayer[] {
  let cum = 0;
  return layers
    .filter((l) => Math.abs(l.t.value) > 1e-9)
    .map((l) => {
      if (l.kind === 'loss') {
        const out = { layer: l, bottom: cum + l.t.value, top: cum };
        cum += l.t.value;
        return out;
      }
      const out = { layer: l, bottom: cum, top: cum + l.t.value };
      cum += l.t.value;
      return out;
    });
}
