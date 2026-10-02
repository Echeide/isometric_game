import { describe, expect, it } from 'vitest';
import { bounds, buildCharacter, emptyFrame, mirrorFrame, missingSources, removeBackground, selectLoop } from '../packages/character-generator/src/pipeline';
import { defaultSettings, PROFILES, type ClipInput, type Frame, type Sources } from '../packages/character-generator/src/types';
import { createPrompts } from '../packages/character-generator/src/prompts';
import { characterFps, characterImage, type CharacterPack } from '../packages/world/src/character';

function person(offset = 0, height = 40): Frame {
  const frame = emptyFrame(64, 96);
  for (let y = 80 - height; y < 80; y++) for (let x = 24; x < 40; x++) frame.data.set([220, 170 + offset, 90, 255], (y * 64 + x) * 4);
  // Asymmetric arm records orientation even after normalization.
  for (let y = 60; y < 65; y++) for (let x = 40; x < 45 + offset; x++) frame.data.set([80, 90, 140, 255], (y * 64 + x) * 4);
  return frame;
}
function clip(frames = [person(0), person(3), person(0), person(1)]): ClipInput {
  return { name: 'fixture', sourceFps: 8, frames, range: [0, frames.length] };
}
function gameSources(): Sources {
  return Object.fromEntries(PROFILES.game.actions.map(recipe => [recipe.action, { ne: clip(), se: clip() }]));
}
const config = () => ({ ...defaultSettings(), background: null, outline: false });

describe('character generator pipeline', () => {
  it('exports the complete current game contract with mirrors and distinct playback rates', () => {
    const sources = gameSources();
    sources.walk!.ne!.sourceFps = 4;
    const result = buildCharacter(config(), sources), character = result.character as CharacterPack;
    expect(result.sheets).toHaveLength(6);
    expect(character.directions).toEqual(['ne', 'se', 'sw', 'nw']);
    expect(character.anchor).toEqual([32, 80]);
    expect(characterFps(character, 'walk', 'ne')).toBe(8);
    expect(characterFps(character, 'walk', 'se')).toBe(16);
    expect(characterFps(character, 'walk', 'nw')).toBe(8);
    expect(characterImage(character, 'sit')).toBe('/pixelart/characters/mi-personaje/sit.png');
    const walk = result.sheets.find(s => s.action === 'walk')!;
    expect([walk.image.width, walk.image.height]).toEqual([512, 384]);
    expect(walk.loops.sw?.mirroredFrom).toBe('se');
    expect(walk.loops.nw?.indices).toEqual(walk.loops.ne?.indices);
    expect(result.sheets.find(s => s.action === 'sit')!.image.width).toBe(64);
    const colors = new Set<string>();
    for (const sheet of result.sheets) for (let i = 0; i < sheet.image.data.length; i += 4) if (sheet.image.data[i + 3]) colors.add([...sheet.image.data.slice(i, i + 3)].join(','));
    expect(colors.size).toBeLessThanOrEqual(config().colors);
    expect([...colors].every(c => result.metadata.palette.some(p => p.join(',') === c))).toBe(true);
  });
  it('gives an imported asymmetric direction priority over reflection', () => {
    const sources = gameSources(); sources.walk.sw = { ...clip([person(7)]), playbackFps: 12 };
    const sheet = buildCharacter(config(), sources, ['walk']).sheets[0];
    expect(sheet.loops.sw?.mirroredFrom).toBeUndefined();
    expect(sheet.loops.sw?.fps).toBe(12);
  });
  it('requires actual north and south sources for eight directions', () => {
    const settings = { ...config(), profile: 'iso-eight' as const };
    const sources: Sources = { idle: { se: clip(), ne: clip(), e: clip() } };
    expect(missingSources(settings, sources, ['idle'])).toEqual(['idle/S', 'idle/N']);
    expect(() => buildCharacter(settings, sources, ['idle'])).toThrow('idle/S');
    sources.idle.s = clip(); sources.idle.n = clip();
    const result = buildCharacter(settings, sources, ['idle']);
    expect(result.sheets[0].image.height).toBe(768);
    expect(result.character.directions).toEqual(['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n']);
    expect(result.sheets[0].loops.w?.mirroredFrom).toBe('e');
  });
  it('removes only the selected background and preserves source pixels and alpha', () => {
    const frame = emptyFrame(3, 1); frame.data.set([255, 0, 255, 255, 80, 90, 140, 120, 80, 90, 140, 0]);
    const keyed = removeBackground(frame, [255, 0, 255], 40);
    expect([...keyed.data]).toEqual([255, 0, 255, 0, 80, 90, 140, 120, 80, 90, 140, 0]);
    expect(frame.data[3]).toBe(255);
    expect(removeBackground(frame, null, 40).data).toEqual(frame.data);
  });
  it('finds a periodic window without including the repeated endpoint', () => {
    const frames = Array.from({ length: 17 }, (_, i) => person((i % 4) * 2));
    const loop = selectLoop(frames, 8, 8);
    expect(loop.end - loop.start).toBe(4);
    expect(loop.indices).toHaveLength(8);
    expect(loop.indices.every(i => i >= loop.start && i < loop.end)).toBe(true);
    expect(selectLoop(frames, 8, 4, [3, 11]).indices).toEqual([3, 5, 7, 9]);
    expect(() => selectLoop(frames, 8, 4, [11, 3])).toThrow('intervalo');
    expect(() => selectLoop(frames, 8, 4, [0, 18])).toThrow('intervalo');
  });
  it('reflects around the feet and leaves transparent padding intact', () => {
    const frame = emptyFrame(8, 2); frame.data.set([10, 20, 30, 255], (1 * 8 + 2) * 4);
    const mirrored = mirrorFrame(frame, 4);
    expect([...mirrored.data.slice((8 + 5) * 4, (8 + 6) * 4)]).toEqual([10, 20, 30, 255]);
    expect(mirrorFrame(mirrored, 4).data).toEqual(frame.data);
    expect(frame.data[(8 + 2) * 4 + 3]).toBe(255);
  });
  it('matches stature across facings, and warns about clipped art and poor seated references', () => {
    const sources = { idle: { se: clip([person(0, 40)]), ne: clip([person(0, 60)]) } };
    const result = buildCharacter(config(), sources, ['idle']), sheet = result.sheets[0].image;
    const row = (r: number) => ({ width: 64, height: 96, data: Uint8ClampedArray.from(Array.from({ length: 96 }, (_, y) => [...sheet.data.slice(((r * 96 + y) * sheet.width) * 4, ((r * 96 + y) * sheet.width + 64) * 4)]).flat()) });
    expect(bounds(row(0))?.height).toBe(60);
    expect(bounds(row(1))?.height).toBe(60);
    expect(bounds(row(0))?.bottom).toBe(79);
    const cropped = buildCharacter({ ...config(), width: 16, anchor: [8, 80] }, sources, ['idle']);
    expect(cropped.metadata.warnings.some(w => w.includes('sale de la celda'))).toBe(true);
    const seated = buildCharacter(config(), { sit: { se: clip(), ne: clip() } }, ['sit']);
    expect(seated.metadata.warnings.some(w => w.includes('sin idle'))).toBe(true);
  });
  it('fails clearly on empty frames, absent sources, malformed input and unsafe export paths', () => {
    expect(() => buildCharacter(config(), {})).toThrow('Faltan fuentes');
    expect(() => buildCharacter({ ...config(), mirror: false }, gameSources())).toThrow('SW');
    expect(() => buildCharacter({ ...config(), baseUrl: '//external/path' }, gameSources())).toThrow('ruta pública');
    expect(() => buildCharacter({ ...config(), colors: NaN }, gameSources())).toThrow('Paleta');
    const sources = gameSources(); sources.idle.se = clip([emptyFrame(64, 96)]);
    expect(() => buildCharacter(config(), sources)).toThrow('queda vacío');
    sources.idle.se = { ...clip(), sourceFps: Infinity };
    expect(() => buildCharacter(config(), sources)).toThrow('fps');
  });
  it('builds provider-independent prompts and requests originals when mirrors are disabled', () => {
    const brief = { description: 'Hero', style: 'Pixel art', props: 'Axe in right hand', notes: { n: 'One axe head beside the left hip.' } };
    const prompts = createPrompts(brief, 'iso-eight');
    expect(prompts.map(p => p.direction)).toEqual(['se', 'ne', 'e', 's', 'n']);
    expect(prompts.find(p => p.direction === 'n')!.still).toContain('One axe head');
    expect(createPrompts(brief, 'game', false)).toHaveLength(4);
    expect(prompts.every(p => p.clips.length === 4)).toBe(true);
  });
});

it('preserves manual scale and alignment corrections without mutating source frames', () => {
  const sources = gameSources(), original = sources.idle.se!.frames[0].data.slice();
  sources.idle.se = { ...sources.idle.se!, scaleBias: 1.1, offset: [2, -3] };
  const corrected = buildCharacter(config(), sources, ['idle']);
  expect(corrected.sheets[0].loops.se!.scale).toBeCloseTo(1.65);
  expect(sources.idle.se.frames[0].data).toEqual(original);
  sources.idle.se.scaleBias = 3;
  expect(() => buildCharacter(config(), sources, ['idle'])).toThrow('escala');
  sources.idle.se.scaleBias = 1;
  sources.idle.se.frames = [person(), emptyFrame(32, 48)];
  expect(() => buildCharacter(config(), sources, ['idle'])).toThrow('misma resolución');
});
