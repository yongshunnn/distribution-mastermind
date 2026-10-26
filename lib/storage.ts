import 'server-only';
import { randomUUID } from 'node:crypto';
import { isSupabaseConfigured } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { trialUser } from '@/lib/db/store';

async function inMemory(): Promise<boolean> {
  return !isSupabaseConfigured() || Boolean(await trialUser());
}

// Demo mode keeps uploads in memory; Supabase mode uses the private "files" bucket.
const g = globalThis as unknown as { __dmFiles?: Map<string, { type: string; data: Buffer }> };
const memFiles = () => (g.__dmFiles ??= new Map());

/** Uploads a file and returns its storage path (served via /api/files/<path>). */
export async function uploadFile(folder: string, file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${randomUUID()}.${ext}`;
  const data = Buffer.from(await file.arrayBuffer());
  if (await inMemory()) {
    memFiles().set(path, { type: file.type || 'application/octet-stream', data });
    return path;
  }
  const sb = await supabaseServer();
  const { error } = await sb.storage.from('files').upload(path, data, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function readFile(path: string): Promise<{ redirect?: string; type?: string; data?: Buffer } | null> {
  if (await inMemory()) {
    const f = memFiles().get(path);
    return f ? { type: f.type, data: f.data } : null;
  }
  const sb = await supabaseServer();
  const { data, error } = await sb.storage.from('files').createSignedUrl(path, 300);
  if (error || !data) return null;
  return { redirect: data.signedUrl };
}

export function fileUrl(path: string): string {
  return `/api/files/${path.split('/').map(encodeURIComponent).join('/')}`;
}
