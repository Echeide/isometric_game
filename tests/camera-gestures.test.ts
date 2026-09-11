import { afterEach, expect, it, vi } from 'vitest';
import { cameraGestures } from '../packages/world/src/camera-gestures';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); vi.unstubAllGlobals(); });
function setup() {
  const win = new EventTarget(); vi.stubGlobal('window', win);
  const captured = new Set<number>();
  const canvas = Object.assign(new EventTarget(), {
    style: { touchAction: 'auto' }, clientHeight: 600,
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id)
  });
  const cancelInteraction = vi.fn(), transform = vi.fn();
  const gestures = cameraGestures(canvas as unknown as HTMLCanvasElement, { cancelInteraction, transform });
  cleanups.push(gestures.destroy);
  function pointer(type: string, id: number, x: number, y: number, pointerType = 'touch') {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({ target: canvas, pointerId: id, clientX: x, clientY: y, pointerType }).map(([key, value]) => [key, { value }])));
    win.dispatchEvent(event); return event;
  }
  return { win, canvas, gestures, pointer, transform, cancelInteraction, captured };
}
it('preserves single touch and mouse interactions, but cancels editing when a second finger arrives', () => {
  const s = setup();
  expect(s.pointer('pointerdown', 9, 0, 0, 'mouse').defaultPrevented).toBe(false);
  expect(s.pointer('pointerdown', 1, 0, 0).defaultPrevented).toBe(false);
  expect(s.pointer('pointermove', 1, 10, 0).defaultPrevented).toBe(false);
  expect(s.pointer('pointerdown', 2, 110, 0).defaultPrevented).toBe(true);
  expect(s.cancelInteraction).toHaveBeenCalledTimes(1);
  expect(s.captured.size).toBe(2);
  s.pointer('pointermove', 2, 210, 0);
  expect(s.transform).toHaveBeenLastCalledWith({ x: 60, y: 0 }, { x: 110, y: 0 }, 2);
});
it('blocks accidental taps until all fingers lift and starts the next gesture with fresh coordinates', () => {
  const s = setup();
  s.pointer('pointerdown', 1, 0, 0); s.pointer('pointerdown', 2, 100, 0);
  s.pointer('pointerup', 2, 100, 0);
  expect(s.pointer('pointermove', 1, 50, 0).defaultPrevented).toBe(true);
  expect(s.transform).not.toHaveBeenCalled();
  s.pointer('pointerdown', 3, 150, 0); s.pointer('pointermove', 3, 170, 0);
  expect(s.transform).toHaveBeenLastCalledWith({ x: 100, y: 0 }, { x: 110, y: 0 }, 1.2);
  s.pointer('pointercancel', 1, 50, 0); s.pointer('pointerup', 3, 170, 0);
  expect(s.gestures.blocked()).toBe(true); expect(s.captured.size).toBe(0);
});
it('anchors wheel zoom and removes handlers and captures on teardown', () => {
  const s = setup();
  const wheel = () => Object.assign(new Event('wheel', { cancelable: true }), { clientX: 80, clientY: 90, deltaY: -3, deltaMode: 1 });
  const event = wheel(); s.canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(s.transform).toHaveBeenLastCalledWith({ x: 80, y: 90 }, { x: 80, y: 90 }, Math.exp(48 * .002));
  s.pointer('pointerdown', 1, 0, 0); s.pointer('pointerdown', 2, 100, 0);
  s.gestures.destroy();
  expect(s.captured.size).toBe(0); expect(s.canvas.style.touchAction).toBe('auto');
  s.transform.mockClear(); s.canvas.dispatchEvent(wheel()); expect(s.transform).not.toHaveBeenCalled();
});
it('pans with shift and scroll without changing scale', () => {
  const s = setup();
  const event = Object.assign(new Event('wheel', { cancelable: true }), { clientX: 80, clientY: 90, deltaX: 12, deltaY: 30, deltaMode: 0, shiftKey: true });
  s.canvas.dispatchEvent(event);
  expect(s.transform).toHaveBeenCalledWith({ x: 80, y: 90 }, { x: 68, y: 60 }, 1);
});
