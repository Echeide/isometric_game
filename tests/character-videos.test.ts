import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVideoService, videoMediaUrl, videoStatus } from '../src/lib/server/character-videos';
import { validateVideoRequest, type VideoRequest } from '../packages/character-generator/src/video';
import { pngUrl } from '../packages/character-generator/src/generation';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true }))); });
const id = '11111111-1111-4111-8111-111111111111', taskId = '22222222-2222-4222-8222-222222222222';
const config = { apiKey: 'test-never-live' };
function reference(width = 512, height = 768) {
  const bytes = new Uint8Array(32); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer); view.setUint32(12, 0x49484452); view.setUint32(16, width); view.setUint32(20, height);
  return pngUrl(bytes);
}
const request = (): VideoRequest => ({ requestId: id, projectId: 'explorador', profile: 'game', action: 'walk', direction: 'ne', reference: reference(), prompt: 'Walk in place', negative: 'camera movement' });
const task = (status = 'CREATED', generated: string[] = []) => Response.json({ data: { task_id: taskId, status, generated } });
async function setup(fetcher: typeof fetch) { const dir = await mkdtemp(join(tmpdir(), 'character-videos-')); dirs.push(dir); return { dir, service: createVideoService(dir, fetcher) }; }
describe('Magnific video integration', () => {
  it('validates references, prompts and targets before any paid call', async () => {
    const transport = vi.fn(); const { service } = await setup(transport);
    for (const override of [{ reference: 'https://other.example/image.png' }, { reference: reference(64, 96) }, { reference: reference(1000, 300) }, { prompt: 'x'.repeat(2501) }, { direction: 'n' }, { projectId: '../test' }, { requestId: '../test' }]) {
      await expect(service.create({ ...request(), ...override }, config)).rejects.toMatchObject({ status: 400 });
    }
    expect(transport).not.toHaveBeenCalled();
    expect(validateVideoRequest(request()).direction).toBe('ne');
  });
  it('reports configuration without exposing or contacting the account', async () => {
    const transport = vi.fn(); const { service } = await setup(transport);
    expect(videoStatus({}).available).toBe(false);
    expect(videoStatus(config).available).toBe(true);
    expect(JSON.stringify(videoStatus(config))).not.toContain(config.apiKey);
    await expect(service.create(request(), {})).rejects.toMatchObject({ status: 503 });
    expect(transport).not.toHaveBeenCalled();
  });
  it('sends one reference to the documented 2.6 Pro endpoint, silent and five seconds', async () => {
    const transport = vi.fn(async () => task()); const { service, dir } = await setup(transport);
    const result = await service.create(request(), config);
    expect(result).toMatchObject({ id, projectId: 'explorador', action: 'walk', direction: 'ne', status: 'pending' });
    const [url, options] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.magnific.com/v1/ai/image-to-video/kling-v2-6-pro');
    expect(options.headers).toMatchObject({ 'x-magnific-api-key': config.apiKey });
    expect(options.redirect).toBe('error');
    expect(JSON.parse(options.body as string)).toEqual({ image: reference().slice(22), prompt: 'Walk in place', negative_prompt: 'camera movement', duration: '5', generate_audio: false, cfg_scale: 0.5 });
    const journal = await readFile(join(dir, `${id}.json`), 'utf8');
    expect(journal).not.toContain(config.apiKey); expect(journal).not.toContain(reference());
    expect(JSON.stringify(result)).not.toContain(taskId);
  });
  it('deduplicates concurrent submissions and replays after a server restart', async () => {
    const transport = vi.fn(async () => task()); const { service, dir } = await setup(transport);
    const [a, b] = await Promise.all([service.create(request(), config), service.create(request(), config)]);
    expect(a).toEqual(b);
    expect(await createVideoService(dir, transport).create(request(), config)).toEqual(a);
    expect(transport).toHaveBeenCalledTimes(1);
    await expect(service.create({ ...request(), prompt: 'Different' }, config)).rejects.toMatchObject({ status: 409 });
  });
  it('never resubmits a paid call when its response is lost', async () => {
    const transport = vi.fn(async () => { throw new Error('private upstream details'); });
    const { service, dir } = await setup(transport);
    const result = await service.create(request(), config);
    expect(result.status).toBe('uncertain'); expect(result.message).not.toContain('private upstream');
    await createVideoService(dir, transport).create(request(), config);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(await service.list()).toEqual([result]);
  });
  it('recovers an interrupted submission without pretending the job can be resubmitted', async () => {
    const { service, dir } = await setup(vi.fn());
    await writeFile(join(dir, `${id}.json`), JSON.stringify({ id, ...request(), status: 'submitting' }));
    expect((await service.poll(id, config)).status).toBe('uncertain');
  });
  it('polls the documented shared 2.6 status endpoint and handles failure', async () => {
    const transport = vi.fn().mockResolvedValueOnce(task()).mockResolvedValueOnce(task('IN_PROGRESS')).mockResolvedValueOnce(task('COMPLETED')).mockResolvedValueOnce(task('FAILED'));
    const { service } = await setup(transport); await service.create(request(), config);
    expect((await service.poll(id, config)).status).toBe('pending');
    expect(transport.mock.calls[1][0]).toBe(`https://api.magnific.com/v1/ai/image-to-video/kling-v2-6/${taskId}`);
    expect(transport.mock.calls[1][1].method).toBe('GET');
    expect((await service.poll(id, config)).status).toBe('completed');
    expect((await service.poll(id, config)).status).toBe('failed');
  });
  it('redacts authentication errors and rejects mismatched or malformed responses', async () => {
    const transport = vi.fn(async () => Response.json({ message: config.apiKey }, { status: 401 }));
    const { service } = await setup(transport);
    const result = await service.create(request(), config);
    expect(result.message).toContain('no acepta la clave'); expect(result.message).not.toContain(config.apiKey);
    const other = await setup(vi.fn().mockResolvedValueOnce(task()).mockResolvedValueOnce(Response.json({ data: { task_id: id, status: 'COMPLETED' } })));
    await other.service.create(request(), config);
    await expect(other.service.poll(id, config)).rejects.toThrow('otro identificador');
  });
  it('downloads provider media without credentials and caches a complete MP4 locally', async () => {
    const url = 'https://ai-statics.freepik.com/result.mp4';
    const mp4 = new Uint8Array(16); mp4.set(new TextEncoder().encode('ftyp'), 4);
    const transport = vi.fn().mockResolvedValueOnce(task()).mockResolvedValueOnce(task('COMPLETED', [url])).mockResolvedValueOnce(new Response(mp4));
    const { service } = await setup(transport); await service.create(request(), config);
    expect(await service.video(id, config)).toEqual(mp4);
    expect(transport.mock.calls[2][0].href).toBe(url);
    expect(transport.mock.calls[2][1]).not.toHaveProperty('headers');
    expect(await service.video(id, config)).toEqual(mp4);
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('rejects untrusted media destinations and redirects before fetching them', async () => {
    for (const url of ['http://ai-statics.freepik.com/a', 'https://127.0.0.1/a', 'https://freepik.com.evil.example/a', 'https://user:pass@ai-statics.freepik.com/a']) expect(() => videoMediaUrl(url)).toThrow();
    const transport = vi.fn().mockResolvedValueOnce(task()).mockResolvedValueOnce(task('COMPLETED', ['https://ai-statics.freepik.com/a'])).mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }));
    const { service } = await setup(transport); await service.create(request(), config);
    await expect(service.video(id, config)).rejects.toMatchObject({ status: 502 });
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('rejects oversized media before reading and non-video bodies before caching', async () => {
    for (const response of [new Response('large', { headers: { 'Content-Length': '100000001' } }), new Response('<html>not video</html>')]) {
      const transport = vi.fn().mockResolvedValueOnce(task()).mockResolvedValueOnce(task('COMPLETED', ['https://ai-statics.freepik.com/a'])).mockResolvedValueOnce(response);
      const { service } = await setup(transport); await service.create(request(), config);
      await expect(service.video(id, config)).rejects.toThrow();
    }
  });
});
