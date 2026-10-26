import 'server-only';

export function s(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function n(form: FormData, key: string): number | null {
  const v = s(form, key);
  if (v === null) return null;
  const x = Number(v.replace(/,/g, ''));
  return Number.isFinite(x) ? x : null;
}

export function list(form: FormData, key: string): string[] {
  return (s(form, key) ?? '')
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function required(form: FormData, key: string, label = key): string {
  const v = s(form, key);
  if (!v) throw new Error(`${label} is required`);
  return v;
}
