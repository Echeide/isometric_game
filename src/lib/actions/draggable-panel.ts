type Position = { x: number; y: number; height: number };

/** Drag a floating panel by its heading; retain its position while tools change. */
export function draggablePanel(node: HTMLElement, options: { key: string; positions: Map<string, Position> }) {
 const heading = node.querySelector<HTMLElement>('.panel-heading')!;
 const area = node.parentElement!;
 let position = options.positions.get(options.key);
 let drag: { id: number; x: number; y: number; left: number; top: number } | undefined;
 const margin = 12;
 function place() {
  if (!position) return;
  node.classList.add('drag-positioned');
  node.style.setProperty('--panel-height', `${position.height}px`);
  position.x = Math.max(margin, Math.min(position.x, area.clientWidth - node.offsetWidth - margin));
  position.y = Math.max(margin, Math.min(position.y, area.clientHeight - node.offsetHeight - margin));
  node.style.left = `${position.x}px`;
  node.style.top = `${position.y}px`;
  options.positions.set(options.key, position);
 }
 function down(event: PointerEvent) {
  if (event.button !== 0 || drag || (event.target as Element).closest('button')) return;
  const rect = node.getBoundingClientRect(), bounds = area.getBoundingClientRect();
  position ??= { x: rect.left - bounds.left, y: rect.top - bounds.top,
   height: node.classList.contains('collapsed') ? Math.max(150, area.clientHeight - 208) : rect.height };
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.x, top: position.y };
  heading.setPointerCapture(event.pointerId);
  node.classList.add('dragging');
  event.preventDefault();
  event.stopPropagation();
 }
 function move(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId || !position) return;
  position.x = drag.left + event.clientX - drag.x;
  position.y = drag.top + event.clientY - drag.y;
  place();
 }
 function end(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  drag = undefined;
  node.classList.remove('dragging');
  if (heading.hasPointerCapture(event.pointerId)) heading.releasePointerCapture(event.pointerId);
 }
 heading.addEventListener('pointerdown', down);
 heading.addEventListener('pointermove', move);
 heading.addEventListener('pointerup', end);
 heading.addEventListener('pointercancel', end);
 heading.addEventListener('lostpointercapture', end);
 const observer = new ResizeObserver(place);
 observer.observe(area);
 observer.observe(node);
 place();
 return { destroy() {
  observer.disconnect();
  heading.removeEventListener('pointerdown', down);
  heading.removeEventListener('pointermove', move);
  heading.removeEventListener('pointerup', end);
  heading.removeEventListener('pointercancel', end);
  heading.removeEventListener('lostpointercapture', end);
 } };
}
