import { describe, expect, it } from 'vitest';
import { emptyFrame } from '../packages/character-generator/src/pipeline';
import { cloneFrame, extractFrames, samplePixel } from '../packages/character-generator/src/pixel-edit';

describe('pixel retouching', () => {
  it('keeps edits and undo snapshots independent from the source and neighbouring frames', () => {
    const sheet = emptyFrame(4, 4);
    sheet.data.set([7, 8, 9, 255], (2 * 4 + 2) * 4);
    const frames = extractFrames(sheet, 2, 2, 2, 1), undo = cloneFrame(frames[1]);
    expect(samplePixel(frames[1], 0, 0)).toEqual([7, 8, 9, 255]);
    frames[1].data.set([255, 0, 0, 255], 0);
    expect(samplePixel(undo, 0, 0)).toEqual([7, 8, 9, 255]);
    expect(samplePixel(sheet, 2, 2)).toEqual([7, 8, 9, 255]);
    expect(samplePixel(frames[0], 0, 0)[3]).toBe(0);
    expect(() => extractFrames(sheet, 2, 2, 3)).toThrow();
  });
});
