import { pngData } from './generation';
import { PROFILES, type Direction, type Profile } from './types';

export interface VideoRequest {
  requestId: string;
  projectId: string;
  profile: Profile;
  action: string;
  direction: Direction;
  reference: string;
  prompt: string;
  negative: string;
}
export interface VideoJob {
  id: string;
  projectId: string;
  profile: Profile;
  action: string;
  direction: Direction;
  createdAt: string;
  status: 'submitting' | 'pending' | 'completed' | 'failed' | 'uncertain';
  message?: string;
}
export interface VideoProvider {
  status(): Promise<{ available: boolean; message: string }>;
  list(): Promise<VideoJob[]>;
  create(request: VideoRequest): Promise<VideoJob>;
  poll(id: string): Promise<VideoJob>;
  video(id: string): Promise<Blob>;
}
export function validateVideoRequest(value: unknown): VideoRequest {
  const r = value as VideoRequest;
  if (!r || !/^[a-f0-9-]{36}$/i.test(r.requestId) || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(r.projectId) || !Object.hasOwn(PROFILES, r.profile) || !PROFILES[r.profile].directions.includes(r.direction) || !PROFILES[r.profile].actions.some(a => a.action === r.action)) throw new Error('Personaje, acción u orientación no válidos para el vídeo.');
  if (typeof r.prompt !== 'string' || !r.prompt.trim() || r.prompt.length > 2500 || typeof r.negative !== 'string' || r.negative.length > 2500) throw new Error('El prompt de vídeo debe tener entre 1 y 2500 caracteres.');
  const data = pngData(r.reference), view = new DataView(data.buffer);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (width < 300 || height < 300 || width / height < 0.4 || width / height > 2.5) throw new Error('Kling necesita una referencia de al menos 300 × 300 px, con proporción entre 1:2,5 y 2,5:1.');
  return r;
}

/** Optional host adapter; the package never receives API credentials. */
export function httpVideoProvider(endpoint: string): VideoProvider {
  async function response(path = '', init?: RequestInit) {
    const result = await fetch(endpoint + path, { cache: 'no-store', signal: AbortSignal.timeout(120_000), ...init });
    if (!result.ok) {
      const body = await result.json().catch(() => ({}));
      throw new Error(body.error || 'No se pudo conectar con el servicio de vídeo.');
    }
    return result;
  }
  return {
    async status() { return (await response()).json(); },
    async list() { return (await response('?jobs=1')).json(); },
    async create(request) { return (await response('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })).json(); },
    async poll(id) { return (await response(`/${encodeURIComponent(id)}`)).json(); },
    async video(id) { return (await response(`/${encodeURIComponent(id)}?video=1`)).blob(); }
  };
}
