export type GesturePoint = { x: number; y: number };

/** Coordinates remain in CSS pixels; the renderer handles canvas resolution. */
export function cameraGestures(canvas: HTMLCanvasElement, callbacks: {
  cancelInteraction: () => void;
  transform: (from: GesturePoint, to: GesturePoint, factor: number) => void;
}) {
  const touches = new Map<number, GesturePoint>();
  let active = false;
  let suppressUntil = 0;
  const blocked = () => active || performance.now() < suppressUntil;
  function pair() {
    const [a, b] = [...touches.values()];
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function stop(event: Event) { event.preventDefault(); event.stopImmediatePropagation(); }
  function down(event: PointerEvent) {
    if (event.pointerType !== 'touch' || event.target !== canvas) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size < 2 && !active) return;
    if (!active) { active = true; callbacks.cancelInteraction(); }
    for (const id of touches.keys()) canvas.setPointerCapture(id);
    stop(event);
  }
  function move(event: PointerEvent) {
    if (!touches.has(event.pointerId)) return;
    const previous = touches.size >= 2 ? pair() : null;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!active) return;
    stop(event);
    if (previous) {
      const next = pair();
      callbacks.transform(previous.center, next.center, previous.distance > 0 && next.distance > 0 ? next.distance / previous.distance : 1);
    }
  }
  function end(event: PointerEvent) {
    if (!touches.delete(event.pointerId)) return;
    if (active) { stop(event); suppressUntil = performance.now() + 300; }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!touches.size) active = false;
  }
  function reset() {
    if (active) suppressUntil = performance.now() + 300;
    const ids = [...touches.keys()];
    touches.clear(); active = false;
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function wheel(event: WheelEvent) {
    stop(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const at = { x: event.clientX, y: event.clientY };
    if (event.shiftKey && !event.ctrlKey) {
      callbacks.transform(at, { x: at.x - event.deltaX * unit, y: at.y - event.deltaY * unit }, 1);
      return;
    }
    callbacks.transform(at, at, Math.exp(-Math.max(-200, Math.min(200, event.deltaY * unit)) * .002));
  }
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';
  window.addEventListener('pointerdown', down, { capture: true, passive: false });
  window.addEventListener('pointermove', move, { capture: true, passive: false });
  window.addEventListener('pointerup', end, true);
  window.addEventListener('pointercancel', end, true);
  canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('blur', reset);
  return { blocked, destroy() {
    reset(); canvas.style.touchAction = previousTouchAction;
    window.removeEventListener('pointerdown', down, true);
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', end, true);
    window.removeEventListener('pointercancel', end, true);
    canvas.removeEventListener('lostpointercapture', end);
    canvas.removeEventListener('wheel', wheel);
    window.removeEventListener('blur', reset);
  } };
}
