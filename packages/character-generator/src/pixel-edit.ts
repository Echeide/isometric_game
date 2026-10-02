import type { Frame } from './types';

export const cloneFrame = (frame: Frame): Frame => ({ ...frame, data: new Uint8ClampedArray(frame.data) });
export type PixelColor = [number, number, number, number];
export function samplePixel(frame: Frame, x: number, y: number): PixelColor {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return [0, 0, 0, 0];
  return Array.from(frame.data.subarray((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4)) as PixelColor;
}
/** Extract a processed row without retaining views into the shared sheet buffer. */
export function extractFrames(image: Frame, width: number, height: number, count: number, row = 0): Frame[] {
  if (![width, height, count, row].every(Number.isInteger) || width < 1 || height < 1 || count < 1 || row < 0 || width * count > image.width || (row + 1) * height > image.height) throw new Error('La hoja no contiene esa secuencia.');
  return Array.from({ length: count }, (_, col) => {
    const frame: Frame = { width, height, data: new Uint8ClampedArray(width * height * 4) };
    for (let y = 0; y < height; y++) {
      const start = ((row * height + y) * image.width + col * width) * 4;
      frame.data.set(image.data.subarray(start, start + width * 4), y * width * 4);
    }
    return frame;
  });
}
