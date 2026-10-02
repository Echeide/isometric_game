import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { imagePlan, imageReferenceInput, pngUrl, type ImageRequest } from '../packages/character-generator/src/generation';
import { importCharacterReference, loadProject, saveProject } from '../packages/character-generator/src/browser';
import { defaultSettings } from '../packages/character-generator/src/types';
import { createImageService } from '../src/lib/server/character-images';

const image = pngUrl(new Uint8Array(readFileSync('static/pixelart/characters/grey-player-v1/sit.png')));
const inspiration = { image, name: 'referente.png' };
const brief = { description: '', style: 'Pixel art', props: '', notes: {} };
const request = (): ImageRequest => ({ brief, profile: 'game', direction: 'se', action: 'idle', kind: 'reference', quality: 'low', reference: image, referenceKind: 'inspiration' });
describe('character photo reference', () => {
  it('uses the photo without inventing an approved facing and prefers established views afterwards', () => {
    expect(imageReferenceInput({ references: {}, inspiration }, 'ne')).toEqual({ reference: image, referenceKind: 'inspiration' });
    const art = { inspiration, references: { se: { image: 'approved', prompt: '', model: 'test' } } };
    expect(imageReferenceInput(art, 'ne')).toEqual({ reference: 'approved', referenceDirection: 'se' });
    expect(imageReferenceInput(art, 'ne', true)).toEqual({ reference: image, referenceKind: 'inspiration' });
  });
  it('accepts a photo in place of a description and adapts style, framing and orientation', () => {
    const plan = imagePlan(request());
    expect(plan.prompt).toContain('visual description');
    expect(plan.prompt).toContain('Do not copy the photo background');
    expect(plan.prompt).toContain('TARGET ORIENTATION: SE');
    expect(plan.prompt).toContain('Style: Pixel art');
    expect(() => imagePlan({ ...request(), reference: undefined })).toThrow();
    expect(() => imagePlan({ ...request(), referenceDirection: 'se' })).toThrow('Tipo de referencia');
  });
  it('sends the imported photo through the existing image-edit API with no extra paid request', async () => {
    const transport = vi.fn(async () => Response.json({ data: [{ b64_json: image.slice(22) }] }));
    await createImageService(transport)(request(), { apiKey: 'test-only' });
    expect(transport).toHaveBeenCalledTimes(1);
    const [url, init] = transport.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith('/images/edits')).toBe(true);
    expect((init.body as FormData).getAll('image[]')).toHaveLength(1);
  });
  it('round-trips the photo with empty description and keeps older ZIPs compatible', async () => {
    for (const art of [{ references: {}, inspiration }, { references: {} }]) {
      const bytes = await saveProject(defaultSettings(), brief, {}, art);
      const project = await loadProject(new File([new Uint8Array(bytes)], 'character.project.zip'));
      expect(project.art).toEqual(art);
      expect(project.brief.description).toBe('');
    }
  });
  it('rejects malformed photo paths in imported projects', async () => {
    const files = unzipSync(await saveProject(defaultSettings(), brief, {}, { references: {}, inspiration }));
    const metadata = JSON.parse(strFromU8(files['project.json']));
    metadata.art.inspiration.path = '../secret.png';
    files['project.json'] = strToU8(JSON.stringify(metadata));
    await expect(loadProject(new File([new Uint8Array(zipSync(files))], 'bad.zip'))).rejects.toThrow('Foto de referencia');
  });
  it('rejects unsupported and oversized uploads before decoding', async () => {
    await expect(importCharacterReference(new File(['a'], 'document.svg', { type: 'image/svg+xml' }))).rejects.toThrow('PNG, JPG o WebP');
    await expect(importCharacterReference(new File([], 'empty.png', { type: 'image/png' }))).rejects.toThrow('20 MB');
  });
});
