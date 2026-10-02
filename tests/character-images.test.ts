import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { allowLocalImages, createImageService, DEFAULT_IMAGE_MODEL, imageStatus, readImageBody } from '../src/lib/server/character-images';
import { imagePlan, pngData, pngUrl, validateImageRequest, selectImageReference, shortActionRecipe, type ImageRequest } from '../packages/character-generator/src/generation';
import { PROFILES } from '../packages/character-generator/src/types';
const image = pngUrl(new Uint8Array(readFileSync('static/pixelart/characters/grey-player-v1/sit.png')));
const request = (): ImageRequest => ({ brief: { description: 'Exploradora con chaqueta verde', style: 'Pixel art', props: 'Mochila azul', notes: { ne: 'La mochila debe verse en la espalda' } }, kind: 'reference', profile: 'game', direction: 'se', action: 'idle', quality: 'medium' });
const config = { apiKey: 'test-key-never-live' };
const reply = () => Response.json({ data: [{ b64_json: image.slice(22) }] });

describe('image generation recipes', () => {
  it('creates an original from a description, and reuses a reference when supplied', () => {
    const plan = imagePlan(request());
    expect(plan.prompt).toContain('from the character description');
    expect(plan.prompt).toContain('Exploradora');
    expect(plan.frames).toBe(1);
    const edit = imagePlan({ ...request(), reference: image, direction: 'ne' });
    expect(edit.prompt).toContain('using the supplied image');
    expect(edit.prompt).toContain('mochila debe verse');
  });
  it('creates only one reference pose regardless of the selected animation', () => {
    for (const action of ['idle', 'walk', 'celebrate', 'sit']) {
      const plan = imagePlan({ ...request(), action, reference: image });
      expect([plan.frames, plan.columns, plan.rows]).toEqual([1, 1, 1]);
      expect(plan.prompt).toContain('Create a single full-body character pose');
      expect(plan.prompt).not.toContain('sprite sheet');
    }
  });
  it('rejects unsupported inputs and remote references before contacting a provider', () => {
    for (const invalid of [{ profile: 'constructor' }, { action: 'unknown' }, { direction: 'n' }, { quality: 'max' }, { reference: 'https://example.com/image.png' }, { brief: { ...request().brief, description: '' } }]) {
      expect(() => validateImageRequest({ ...request(), ...invalid })).toThrow();
    }
    expect(() => pngData('data:image/png;base64,YWJj')).toThrow('PNG');
    expect(pngUrl(pngData(image))).toBe(image);
  });
  it('prefers a matching reference and can reuse another facing for a new view', () => {
    const se = { image, prompt: 'front', model: 'test' };
    const ne = { image, prompt: 'back', model: 'test' };
    expect(selectImageReference({ references: { se } }, 'ne')).toEqual({ direction: 'se', asset: se });
    expect(selectImageReference({ references: {} }, 'ne')).toBeUndefined();
    expect(selectImageReference({ references: { se, ne } }, 'ne')).toEqual({ direction: 'ne', asset: ne });
  });
  it('requests a rear view when turning an SE reference into NE, without calling the source NE', () => {
    const plan = imagePlan({ ...request(), direction: 'ne', reference: image, referenceDirection: 'se' });
    expect(plan.prompt).toContain('SOURCE REFERENCE: SE');
    expect(plan.prompt).toContain('TARGET ORIENTATION: NE');
    expect(plan.prompt).toContain('back of the head');
    expect(plan.prompt).toContain('not a horizontal mirror');

  });
  it('rejects the retired sheet mode before calling the paid API', async () => {
    const transport = vi.fn(async () => reply());
    await expect(createImageService(transport)({ ...request(), kind: 'sheet', direction: 'ne', reference: image, referenceDirection: 'se' }, config)).rejects.toMatchObject({ status: 400 });
    expect(transport).not.toHaveBeenCalled();
    expect(() => validateImageRequest({ ...request(), reference: image, referenceDirection: 'invalid' })).toThrow();
  });
  it('routes actions with fewer than four frames to images, leaving four-frame and longer cycles on video', () => {
    expect(shortActionRecipe('game', 'sit')?.frames).toBe(1);
    for (const action of ['idle', 'work', 'talk', 'walk', 'celebrate']) expect(shortActionRecipe('game', action)).toBeUndefined();
    for (const { action } of PROFILES['iso-eight'].actions) expect(shortActionRecipe('iso-eight', action)).toBeUndefined();
    const plan = imagePlan({ ...request(), kind: 'action', action: 'sit', reference: image, referenceDirection: 'se', direction: 'ne' });
    expect([plan.frames, plan.columns, plan.rows]).toEqual([1, 1, 1]);
    expect(plan.prompt).toContain('One still seated pose');
    expect(plan.prompt).toContain('No furniture');
    expect(plan.prompt).toContain('TARGET ORIENTATION: NE');
  });
  it('prepares two or three short frames as one evenly divided row when a recipe requests them', () => {
    const recipe = PROFILES.game.actions.find(a => a.action === 'sit')!, previous = recipe.frames;
    try {
      for (const frames of [2, 3]) {
        recipe.frames = frames;
        const plan = imagePlan({ ...request(), kind: 'action', action: 'sit', reference: image, referenceDirection: 'se' });
        expect([plan.frames, plan.columns, plan.rows, plan.size]).toEqual([frames, frames, 1, '1536x1024']);
        expect(plan.prompt).toContain(`exactly ${frames} equal-width cells`);
      }
    } finally { recipe.frames = previous; }
  });
  it('rejects long action sheets or unapproved references before a paid request', async () => {
    const transport = vi.fn(async () => reply()), generate = createImageService(transport);
    const base = { ...request(), kind: 'action', action: 'sit', reference: image, referenceDirection: 'se' };
    for (const override of [{ action: 'walk' }, { action: 'idle' }, { reference: undefined }, { referenceKind: 'inspiration' }]) {
      await expect(generate({ ...base, ...override }, config)).rejects.toMatchObject({ status: 400 });
    }
    expect(transport).not.toHaveBeenCalled();
  });

});

describe('private OpenAI image service', () => {
  it('generates the seated action from its reference in one image edit request', async () => {
    const transport = vi.fn(async () => reply());
    const result = await createImageService(transport)({ ...request(), kind: 'action', action: 'sit', reference: image, referenceDirection: 'se' }, config);
    const [url, options] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect((options.body as FormData).get('n')).toBe('1');
    expect((options.body as FormData).get('prompt')).toContain('One still seated pose');
    expect(result).toMatchObject({ frames: 1, columns: 1, rows: 1 });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('shows optional configuration without exposing credentials or making a request', async () => {
    const transport = vi.fn(), generate = createImageService(transport);
    expect(imageStatus({}).available).toBe(false);
    expect(imageStatus(config)).toMatchObject({ available: true, model: DEFAULT_IMAGE_MODEL });
    expect(JSON.stringify(imageStatus(config))).not.toContain(config.apiKey);
    await expect(generate(request(), {})).rejects.toMatchObject({ status: 503 });
    expect(transport).not.toHaveBeenCalled();
  });
  it('uses generations for the first image, bounded to one PNG and a server-selected model', async () => {
    const transport = vi.fn(async () => reply());
    const result = await createImageService(transport)(request(), config);
    const [url, options] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(JSON.parse(options.body as string)).toMatchObject({ model: DEFAULT_IMAGE_MODEL, n: 1, quality: 'medium', output_format: 'png', background: 'opaque' });
    expect(options.headers).toMatchObject({ Authorization: `Bearer ${config.apiKey}` });
    expect(result.image).toBe(image);
    expect(JSON.stringify(result)).not.toContain(config.apiKey);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('sends the approved image to edits as multipart without a remote URL', async () => {
    const transport = vi.fn(async () => reply());
    await createImageService(transport)({ ...request(), reference: image, direction: 'ne', referenceDirection: 'se', action: 'walk' }, config);
    const [url, options] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    const form = options.body as FormData;
    expect(form.get('n')).toBe('1');
    expect(form.get('image[]')).toBeInstanceOf(Blob);
    expect(form.getAll('image[]')).toHaveLength(1);
    expect(new Uint8Array(await (form.get('image[]') as Blob).arrayBuffer())).toEqual(pngData(image));
    expect(options.headers).not.toHaveProperty('Content-Type');
  });
  it('prevents overlapping generations, then releases the lock after completion', async () => {
    let finish!: (response: Response) => void;
    const transport = vi.fn(() => new Promise<Response>(resolve => finish = resolve));
    const generate = createImageService(transport), first = generate(request(), config);
    await expect(generate(request(), config)).rejects.toMatchObject({ status: 429 });
    finish(reply()); await first;
    const next = generate(request(), config); finish(reply()); await next;
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('sanitizes upstream failures and never automatically retries paid requests', async () => {
    const transport = vi.fn(async () => Response.json({ error: { message: 'Sensitive account details test-key-never-live' } }, { status: 401 }));
    await expect(createImageService(transport)(request(), config)).rejects.toThrow('clave configurada');
    expect(transport).toHaveBeenCalledTimes(1);
    const malformed = createImageService(vi.fn(async () => Response.json({ data: [] })));
    await expect(malformed(request(), config)).rejects.toMatchObject({ status: 502 });
  });
  it('restricts this unauthenticated demo to same-origin requests from local development', () => {
    const url = new URL('http://127.0.0.1:5173/api/characters/images');
    expect(allowLocalImages(true, '127.0.0.1', url, url.origin)).toBe(true);
    expect(allowLocalImages(true, '127.0.0.1', url)).toBe(true);
    expect(allowLocalImages(false, '127.0.0.1', url, url.origin)).toBe(false);
    expect(allowLocalImages(true, '127.0.0.1', url, null)).toBe(false);
    expect(allowLocalImages(true, '127.0.0.1', url, 'https://other.example')).toBe(false);
    expect(allowLocalImages(true, '192.168.1.9', url, url.origin)).toBe(false);
    expect(allowLocalImages(true, '127.0.0.1', new URL('http://rebound.example'), 'http://rebound.example')).toBe(false);
  });
  it('limits JSON request size and rejects unsupported content before generation', async () => {
    const url = 'http://localhost/api/characters/images';
    await expect(readImageBody(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request()) }))).resolves.toEqual(request());
    await expect(readImageBody(new Request(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' }))).rejects.toMatchObject({ status: 415 });
    await expect(readImageBody(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(2_800_001) }))).rejects.toMatchObject({ status: 413 });
  });
});
