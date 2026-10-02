import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateVideoRequest, type VideoJob } from '../../../packages/character-generator/src/video';

export class VideoServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface VideoConfig { apiKey?: string }
interface StoredJob extends VideoJob { fingerprint: string; taskId?: string }
const API = 'https://api.magnific.com/v1/ai/image-to-video/kling-v2-6';
const idPattern = /^[a-f0-9-]{36}$/i;
const MAX_VIDEO = 100_000_000;
export function videoStatus(config: VideoConfig) {
  return { available: !!config.apiKey?.trim(), message: config.apiKey?.trim()
    ? 'Magnific configurado · Kling 2.6 Pro · 5 segundos sin audio. Cada generación consume créditos de tu cuenta.'
    : 'Configura MAGNIFIC_API_KEY en el .env del servidor para activar Kling 2.6.' };
}
function publicJob(job: StoredJob): VideoJob {
  const { id, projectId, profile, action, direction, createdAt, status, message } = job;
  return { id, projectId, profile, action, direction, createdAt, status, message };
}
/** Only provider media hosts, including each redirect; no API key goes to a CDN. */
export function videoMediaUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new VideoServiceError(502, 'Magnific no devolvió una URL de vídeo válida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['freepik.com', 'magnific.com', 'klingai.com'].some(d => url.hostname === d || url.hostname.endsWith(`.${d}`))) throw new VideoServiceError(502, 'El vídeo apunta a un servidor no reconocido de Magnific.');
  return url;
}
export function createVideoService(directory: string, fetcher: typeof fetch = fetch) {
  const pending = new Map<string, Promise<VideoJob>>();
  function path(id: string) {
    if (!idPattern.test(id)) throw new VideoServiceError(400, 'Identificador de vídeo no válido.');
    return join(directory, `${id}.json`);
  }
  async function read(id: string): Promise<StoredJob> {
    try { return JSON.parse(await readFile(path(id), 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') throw new VideoServiceError(404, 'No se encuentra este vídeo en el taller local.'); throw e; }
  }
  async function save(job: StoredJob) {
    const file = path(job.id), temp = `${file}.tmp`;
    await writeFile(temp, JSON.stringify(job), { mode: 0o600 });
    await rename(temp, file);
  }
  async function api(url: string, config: VideoConfig, body?: unknown) {
    if (!videoStatus(config).available) throw new VideoServiceError(503, videoStatus(config).message);
    let response: Response;
    try { response = await fetcher(url, { method: body ? 'POST' : 'GET', headers: { 'x-magnific-api-key': config.apiKey!.trim(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'error', signal: AbortSignal.timeout(60_000) }); }
    catch { throw new VideoServiceError(502, 'No se pudo contactar con Magnific. No se ha repetido la solicitud.'); }
    if (!response.ok) {
      await response.body?.cancel();
      throw new VideoServiceError(response.status === 429 ? 429 : 502, response.status === 401 ? 'Magnific no acepta la clave configurada.' : response.status === 403 ? 'La clave no tiene permisos para Kling. Revisa el acceso en Magnific.' : response.status === 429 ? 'Magnific ha alcanzado el límite de uso o saldo.' : response.status === 400 || response.status === 422 ? 'Magnific no acepta los parámetros del vídeo. Revisa la referencia y el prompt.' : 'Magnific no pudo completar la consulta. Comprueba el vídeo en tu cuenta.');
    }
    try { return await response.json(); } catch { throw new VideoServiceError(502, 'Magnific devolvió una respuesta no válida.'); }
  }
  function parsedTask(data: unknown) {
    const task = data as { task_id: string; status: string; generated?: string[] };
    if (!task || !idPattern.test(task.task_id) || !['CREATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'].includes(task.status)) throw new VideoServiceError(502, 'No se pudo interpretar el estado del vídeo de Magnific.');
    return task;
  }
  async function create(value: unknown, config: VideoConfig): Promise<VideoJob> {
    let r;
    try { r = validateVideoRequest(value); } catch (e) { throw new VideoServiceError(400, (e as Error).message); }
    if (!videoStatus(config).available) throw new VideoServiceError(503, videoStatus(config).message);
    const fingerprint = createHash('sha256').update(JSON.stringify([r.projectId, r.profile, r.action, r.direction, r.reference, r.prompt, r.negative])).digest('hex');
    if (pending.has(r.requestId)) { await pending.get(r.requestId); return create(value, config); }
    const work = (async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const job: StoredJob = { id: r.requestId, fingerprint, projectId: r.projectId, profile: r.profile, action: r.action, direction: r.direction, createdAt: new Date().toISOString(), status: 'submitting' };
      try { await writeFile(path(job.id), JSON.stringify(job), { flag: 'wx', mode: 0o600 }); }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        const previous = await read(job.id);
        if (previous.fingerprint !== fingerprint) throw new VideoServiceError(409, 'Esta solicitud ya corresponde a otro vídeo.');
        return publicJob(previous);
      }
      // Journal first: a lost response or restart must never resubmit a paid job.
      try {
        const task = parsedTask((await api(`${API}-pro`, config, { image: r.reference.slice(22), prompt: r.prompt, negative_prompt: r.negative, duration: '5', generate_audio: false, cfg_scale: 0.5 })).data);
        job.taskId = task.task_id;
        job.status = task.status === 'COMPLETED' ? 'completed' : task.status === 'FAILED' ? 'failed' : 'pending';
      } catch (e) {
        job.status = 'uncertain';
        job.message = `${e instanceof VideoServiceError ? e.message : 'La respuesta se interrumpió.'} Revisa tu cuenta antes de generar otro vídeo; la solicitud podría haberse procesado.`;
      }
      await save(job);
      return publicJob(job);
    })();
    pending.set(r.requestId, work);
    try { return await work; } finally { pending.delete(r.requestId); }
  }
  async function poll(id: string, config: VideoConfig): Promise<VideoJob> {
    const job = await read(id);
    if (!job.taskId) return { ...publicJob(job), status: job.status === 'submitting' && !pending.has(id) ? 'uncertain' : job.status, message: job.message || 'La solicitud aún no tiene respuesta confirmada. No vuelvas a generarla sin revisar Magnific.' };
    if (job.status === 'completed' || job.status === 'failed') return publicJob(job);
    const task = parsedTask((await api(`${API}/${job.taskId}`, config)).data);
    if (task.task_id !== job.taskId) throw new VideoServiceError(502, 'Magnific devolvió otro identificador de vídeo.');
    job.status = task.status === 'COMPLETED' ? 'completed' : task.status === 'FAILED' ? 'failed' : 'pending';
    if (job.status === 'failed') job.message = 'Magnific no pudo generar el vídeo. Revisa el resultado en tu cuenta.';
    // Avoid concurrent writes from multiple tabs: only persist submissions. Task state is read remotely.
    return publicJob(job);
  }
  async function video(id: string, config: VideoConfig): Promise<Uint8Array> {
    const job = await read(id);
    const cachedPath = join(directory, `${job.id}.mp4`);
    try { return new Uint8Array(await readFile(cachedPath)); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    if (!job.taskId) throw new VideoServiceError(409, 'La generación todavía no tiene un vídeo confirmado.');
    const task = parsedTask((await api(`${API}/${job.taskId}`, config)).data);
    if (task.task_id !== job.taskId || task.status !== 'COMPLETED' || typeof task.generated?.[0] !== 'string') throw new VideoServiceError(409, 'El vídeo todavía no está disponible.');
    let url = videoMediaUrl(task.generated[0]);
    const signal = AbortSignal.timeout(90_000);
    for (let i = 0; i < 4; i++) {
      const response = await fetcher(url, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location) break;
        url = videoMediaUrl(new URL(location, url).href); continue;
      }
      if (!response.ok || !response.body) throw new VideoServiceError(502, 'No se pudo descargar el vídeo. El enlace de Magnific puede haber caducado.');
      if (Number(response.headers.get('content-length')) > MAX_VIDEO) { await response.body.cancel(); throw new VideoServiceError(413, 'El vídeo supera los 100 MB.'); }
      const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_VIDEO) { await reader.cancel(); throw new VideoServiceError(413, 'El vídeo supera los 100 MB.'); } chunks.push(part.value); }
      } finally { reader.releaseLock(); }
      const data = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
      if (size < 12 || new TextDecoder().decode(data.slice(4, 8)) !== 'ftyp') throw new VideoServiceError(502, 'Magnific no devolvió un vídeo MP4 válido.');
      // A complete local copy survives expiring provider URLs; exclusive write avoids competing tabs.
      const temporary = `${cachedPath}.${crypto.randomUUID()}.tmp`;
      await writeFile(temporary, data, { mode: 0o600 });
      await rename(temporary, cachedPath);
      return data;
    }
    throw new VideoServiceError(502, 'No se pudo seguir el enlace del vídeo.');
  }
  async function list(projectId: string) {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(projectId)) return [];
    let files: string[];
    try { files = await readdir(directory); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
    const jobs = await Promise.all(files.filter(f => idPattern.test(f.replace(/\.json$/, '')) && f.endsWith('.json')).map(async f => publicJob(await read(f.slice(0, -5)))));
    return jobs.filter(job => job.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  }
  return { create, poll, video, list };
}
