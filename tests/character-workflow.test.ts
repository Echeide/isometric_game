import { describe, expect, it } from 'vitest';
import { buildCharacter, emptyFrame } from '../packages/character-generator/src/pipeline';
import { defaultSettings, type ClipInput } from '../packages/character-generator/src/types';
import { extractFrames, samplePixel } from '../packages/character-generator/src/pixel-edit';
import { workflowTasks } from '../packages/character-generator/src/workflow';
const settings = () => ({ ...defaultSettings(), background: null, outline: false });
function clip(): ClipInput {
  const frame = emptyFrame(16, 16);
  for (let y = 2; y < 14; y++) for (let x = 5; x < 11; x++) frame.data.set([70, 120, 90, 255], (y * 16 + x) * 4);
  return { frames: Array.from({ length: 4 }, () => frame), sourceFps: 3, range: [0, 4], name: 'test' };
}
describe('guided character workflow', () => {
  it('lets one view preview immediately while keeping full export incomplete', () => {
    const sources = { idle: { se: clip() } };
    const result = buildCharacter(settings(), sources, ['idle'], ['se']);
    expect(result.sheets[0].directions).toEqual(['se']);
    expect(result.sheets[0].image.height).toBe(96);
    expect(() => buildCharacter(settings(), sources, ['idle'])).toThrow('NE');
  });
  it('preserves exact retouches in the full sheet and its mirror, without overwriting originals', () => {
    const input = clip(), sources = { idle: { se: input, ne: clip() } };
    const first = buildCharacter(settings(), sources, ['idle'], ['se']);
    input.edits = extractFrames(first.sheets[0].image, 64, 96, 4);
    input.edits[0].data.set([213, 17, 109, 255], (10 * 64 + 12) * 4);
    const result = buildCharacter(settings(), sources, ['idle']);
    expect(samplePixel(result.sheets[0].image, 12, 96 + 10)).toEqual([213, 17, 109, 255]);
    expect(samplePixel(result.sheets[0].image, 51, 192 + 10)).toEqual([213, 17, 109, 255]);
    expect(input.frames[0].width).toBe(16);
    expect(result.metadata.palette).toContainEqual([213, 17, 109]);
    expect(() => buildCharacter({ ...settings(), width: 80 }, sources, ['idle'])).toThrow('retoques');
  });
  it('orders reference, import, review, next orientation and honours manual imports and mirrors', () => {
    const s = settings(), art = { references: {} };
    expect(workflowTasks(s, {}, art, true)[0]).toEqual({ action: 'idle', direction: 'se', step: 'reference' });
    expect(workflowTasks(s, {}, { references: { se: { image: 'saved-reference', prompt: '', model: 'test' } } }, true)[0].step).toBe('import');
    const input = clip();
    expect(workflowTasks(s, { idle: { se: input } }, art, true)[0].step).toBe('review');
    input.reviewed = true;
    expect(workflowTasks(s, { idle: { se: input } }, art, true)[0].direction).toBe('ne');
    expect(workflowTasks(s, {}, art, false)[0].step).toBe('import');
    expect(workflowTasks(s, {}, art, false).some(t => t.direction === 'sw')).toBe(false);
    expect(workflowTasks({ ...s, mirror: false }, {}, art, false).some(t => t.direction === 'sw')).toBe(true);
  });
});
