import { leaf, type Tag } from './traced';
import { PLAY_INPUT_KEYS, type PlayInputs } from './play';

/** Builds a full PlayInputs with every input zero except the overrides. */
export function makeInputs(values: Partial<Record<keyof PlayInputs, number>> = {}, tags: Partial<Record<keyof PlayInputs, Tag>> = {}): PlayInputs {
  const unitFor = (k: string) => (/(rate|margin|rebate)$/.test(k) ? '%' : k === 'import_tax_recoverable' ? 'flag' : 'SGD/unit');
  return Object.fromEntries(
    PLAY_INPUT_KEYS.map((k) => [k, leaf(k, values[k] ?? 0, unitFor(k), { tag: tags[k] ?? 'measured' })]),
  ) as PlayInputs;
}
