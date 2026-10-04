import { availableActions, selectedActions, validateActionOptions, MIRRORS, PROFILES, type BuildResult, type ClipInput, type Direction, type Frame, type GeneratorSettings, type LoopInfo, type RGB, type Sheet, type Sources } from './types';

export function emptyFrame(width: number, height: number): Frame {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
function median(values: number[]) { const v = [...values].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; }
export function bounds(frame: Frame) {
  let left = frame.width, top = frame.height, right = -1, bottom = -1;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    if (frame.data[(y * frame.width + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { left, top, right, bottom, height: bottom - top + 1, center: (left + right + 1) / 2 };
}
/** Chroma removal preserves existing alpha. Foreground colors are not globally desaturated. */
export function removeBackground(frame: Frame, color: RGB | null, tolerance: number): Frame {
  const data = new Uint8ClampedArray(frame.data);
  if (color) for (let i = 0; i < data.length; i += 4) {
    const distance = Math.hypot(data[i] - color[0], data[i + 1] - color[1], data[i + 2] - color[2]);
    if (distance <= tolerance) data[i + 3] = 0;
  }
  return { ...frame, data };
}
function signature(frame: Frame): Float32Array {
  const box = bounds(frame), result = new Float32Array(24 * 24 * 4);
  if (!box) return result;
  // Common square around the silhouette: compare pose rather than video translation.
  const side = Math.max(box.height, box.right - box.left + 1);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const sx = Math.floor(box.center - side / 2 + (x + .5) * side / 24);
    const sy = Math.floor(box.bottom + 1 - side + (y + .5) * side / 24);
    if (sx < 0 || sy < 0 || sx >= frame.width || sy >= frame.height) continue;
    const src = (sy * frame.width + sx) * 4, dst = (y * 24 + x) * 4, a = frame.data[src + 3] / 255;
    for (let c = 0; c < 3; c++) result[dst + c] = frame.data[src + c] / 255 * a;
    result[dst + 3] = a;
  }
  return result;
}
function difference(a: Float32Array, b: Float32Array) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}
export function selectLoop(frames: Frame[], sourceFps: number, count: number, range?: [number, number]) {
  if (!frames.length || !Number.isFinite(sourceFps) || sourceFps <= 0 || !Number.isInteger(count) || count < 1) throw new Error('Ciclo sin fotogramas o velocidad no válida.');
  const signatures = frames.map(signature);
  let start = 0, end = frames.length, score = 0;
  if (range) {
    [start, end] = range;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > frames.length || end <= start) throw new Error('El intervalo manual debe estar dentro del clip y contener al menos un fotograma.');
    score = difference(signatures[start], signatures[end - 1]);
  } else if (frames.length > 2 && count > 1) {
    const min = Math.min(frames.length - 1, Math.max(2, Math.round(sourceFps * .35)));
    const max = Math.min(frames.length - 1, Math.max(min, Math.round(sourceFps * 1.8)));
    let best = Infinity;
    for (let length = min; length <= max; length++) for (let first = 0; first + length < frames.length; first++) {
      const seam = difference(signatures[first], signatures[first + length]);
      const motion = difference(signatures[first], signatures[first + Math.floor(length / 2)]);
      const candidate = (seam + .001) / (motion + .001);
      if (candidate < best) { best = candidate; start = first; end = first + length; score = candidate; }
    }
  }
  const indices = Array.from({ length: count }, (_, i) => start + Math.min(end - start - 1, Math.floor(i * (end - start) / count)));
  return { start, end, indices, score };
}
/** A one-shot keeps both endpoints; it must never search for a repeating seam. */
export function selectSequence(frames: Frame[], sourceFps: number, count: number, range?: [number, number]) {
  if (!frames.length || !Number.isFinite(sourceFps) || sourceFps <= 0 || !Number.isInteger(count) || count < 1) throw new Error('Secuencia no válida.');
  const [start,end] = range ?? [0,frames.length];
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > frames.length || end <= start) throw new Error('El intervalo manual debe estar dentro del clip y contener al menos un fotograma.');
  return {start,end,score:0,indices:Array.from({length:count},(_,i)=>start+(count===1 ? 0 : Math.round(i*(end-start-1)/(count-1))))};
}
export interface FrameTransform { scale: number; footX: number; footY: number; offset?: [number, number]; sampleWidth: number; sampleHeight: number }
/** Geometry is measured on analysis samples; destination units always come from project settings. */
export function normalizeOriginal(frame: Frame, settings: GeneratorSettings, transform: FrameTransform): { frame: Frame; clipped: boolean } {
  const {scale, footX, footY, offset = [0,0], sampleWidth, sampleHeight} = transform;
  const scaleX = scale * sampleWidth / frame.width, scaleY = scale * sampleHeight / frame.height;
  const output = emptyFrame(settings.width, settings.height), box = bounds(frame);
  if(!box) throw new Error('El fotograma original queda vacío al eliminar el fondo.');
  const ox = settings.anchor[0] - footX * scale + offset[0], oy = settings.anchor[1] - footY * scale + offset[1];
  const clipped = box.left * scaleX + ox < 0 || (box.right + 1) * scaleX + ox > settings.width || box.top * scaleY + oy < 0 || (box.bottom + 1) * scaleY + oy > settings.height;
  // Area averaging in premultiplied alpha avoids dark/magenta fringes during downsampling.
  for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) {
    if(settings.resampling === 'nearest') {
      const sx=Math.floor((x+.5-ox)/scaleX), sy=Math.floor((y+.5-oy)/scaleY);
      if(sx>=0 && sy>=0 && sx<frame.width && sy<frame.height){const p=(sy*frame.width+sx)*4;if(frame.data[p+3]>=128)output.data.set([frame.data[p],frame.data[p+1],frame.data[p+2],255],(y*output.width+x)*4);}
      continue;
    }
    const x0 = (x - ox) / scaleX, x1 = (x + 1 - ox) / scaleX, y0 = (y - oy) / scaleY, y1 = (y + 1 - oy) / scaleY;
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (let sy = Math.max(0, Math.floor(y0)); sy < Math.min(frame.height, Math.ceil(y1)); sy++) {
      for (let sx = Math.max(0, Math.floor(x0)); sx < Math.min(frame.width, Math.ceil(x1)); sx++) {
        const weight = Math.max(0, Math.min(sx + 1, x1) - Math.max(sx, x0)) * Math.max(0, Math.min(sy + 1, y1) - Math.max(sy, y0));
        const p = (sy * frame.width + sx) * 4, a = frame.data[p + 3] / 255 * weight;
        alpha += a; red += frame.data[p] * a; green += frame.data[p + 1] * a; blue += frame.data[p + 2] * a;
      }
    }
    if (alpha / ((x1 - x0) * (y1 - y0)) < .5) continue;
    const p = (y * output.width + x) * 4;
    output.data.set([Math.round(red / alpha), Math.round(green / alpha), Math.round(blue / alpha), 255], p);
  }
  return { frame: output, clipped };
}
export function mirrorFrame(frame: Frame, anchorX: number): Frame {
  const result = emptyFrame(frame.width, frame.height);
  // Reflect pixel centers around the foot pivot, not around an arbitrary canvas center.
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const targetX = 2 * anchorX - 1 - x;
    if (targetX < 0 || targetX >= frame.width) continue;
    result.data.set(frame.data.subarray((y * frame.width + x) * 4, (y * frame.width + x) * 4 + 4), (y * frame.width + targetX) * 4);
  }
  return result;
}
function makePalette(frames: Frame[], count: number): RGB[] {
  const histogram = new Map<number, number>();
  for (const frame of frames) for (let p = 0; p < frame.data.length; p += 4) if (frame.data[p + 3]) {
    const key = (frame.data[p] >> 3) << 10 | (frame.data[p + 1] >> 3) << 5 | frame.data[p + 2] >> 3;
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }
  type Color = { rgb: RGB; weight: number };
  const all: Color[] = [...histogram].map(([key, weight]) => ({ rgb: [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4], weight }));
  if (!all.length) throw new Error('El fondo eliminado no deja ningún píxel visible.');
  const boxes: Color[][] = [all];
  const spread = (box: Color[], c: number) => { let lo = 255, hi = 0; for (const v of box) { lo = Math.min(lo, v.rgb[c]); hi = Math.max(hi, v.rgb[c]); } return hi - lo; };
  while (boxes.length < count) {
    let selected = -1, channel = 0, best = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) { const range = spread(box, c); if (range > best) { best = range; selected = i; channel = c; } }
    });
    if (selected < 0) break;
    const box = boxes[selected].sort((a, b) => a.rgb[channel] - b.rgb[channel]);
    const half = box.reduce((sum, v) => sum + v.weight, 0) / 2;
    let sum = 0, cut = 0;
    while (cut < box.length - 1 && sum < half) sum += box[cut++].weight;
    boxes.splice(selected, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map(box => {
    const weight = box.reduce((s, v) => s + v.weight, 0);
    return [0, 1, 2].map(c => Math.round(box.reduce((s, v) => s + v.rgb[c] * v.weight, 0) / weight)) as RGB;
  });
}
function applyPalette(frame: Frame, palette: RGB[], outline: boolean) {
  const original = frame.data.slice(), cache = new Map<number, RGB>();
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const p = (y * frame.width + x) * 4;
    if (!original[p + 3]) continue;
    const edge = outline && (x === 0 || y === 0 || x === frame.width - 1 || y === frame.height - 1 || !original[p - 1] || !original[p + 7] || !original[p - frame.width * 4 + 3] || !original[p + frame.width * 4 + 3]);
    const key = original[p] << 16 | original[p + 1] << 8 | original[p + 2];
    let color = edge ? palette[0] : cache.get(key);
    if (!color) {
      let best = Infinity;
      for (const candidate of palette) { const d = (original[p] - candidate[0]) ** 2 + (original[p + 1] - candidate[1]) ** 2 + (original[p + 2] - candidate[2]) ** 2; if (d < best) { best = d; color = candidate; } }
      cache.set(key, color!);
    }
    frame.data.set(color!, p);
  }
}
function paste(sheet: Frame, frame: Frame, x: number, y: number) {
  for (let row = 0; row < frame.height; row++) sheet.data.set(frame.data.subarray(row * frame.width * 4, (row + 1) * frame.width * 4), ((row + y) * sheet.width + x) * 4);
}
export function validateSettings(s: GeneratorSettings) {
  if (!s || !Object.hasOwn(PROFILES, s.profile) || typeof s.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(s.id)) throw new Error('Usa un identificador corto con letras minúsculas, números y guiones.');
  if (s.actions !== undefined && (!Array.isArray(s.actions) || !s.actions.length || new Set(s.actions).size !== s.actions.length || s.actions.some(a => !availableActions(s.profile).some(r => r.action === a)))) throw new Error('Selecciona al menos una acción válida, sin duplicados.');
  if (s.exportFormat !== undefined && !['game','generic'].includes(s.exportFormat)) throw new Error('Formato de exportación no válido.');
  if (s.actionOptions !== undefined) {
    if (!s.actionOptions || typeof s.actionOptions !== 'object' || Array.isArray(s.actionOptions)) throw new Error('Ajustes de acciones no válidos.');
    for (const [action,options] of Object.entries(s.actionOptions)) {
      if (!availableActions(s.profile).some(a=>a.action===action)) throw new Error('Ajustes de acción desconocida.');
      validateActionOptions(options);
    }
  }
  for (const n of [s.width, s.height]) if (!Number.isInteger(n) || n < 16 || n > 256) throw new Error('Las celdas deben medir entre 16 y 256 píxeles.');
  if (!Array.isArray(s.anchor) || s.anchor.length !== 2 || !s.anchor.every(Number.isInteger) || s.anchor[0] <= 0 || s.anchor[0] >= s.width || s.anchor[1] <= 0 || s.anchor[1] > s.height) throw new Error('El apoyo debe estar dentro de la celda.');
  if (!Number.isFinite(s.targetHeight) || s.targetHeight < 4 || s.targetHeight > s.anchor[1]) throw new Error('La altura del personaje debe caber encima del apoyo.');
  if (!Number.isInteger(s.colors) || s.colors < 4 || s.colors > 64 || !Number.isFinite(s.tolerance) || s.tolerance < 0 || s.tolerance > 255) throw new Error('Paleta o tolerancia fuera de rango.');
  if(s.paletteMode !== undefined && !['auto','fixed'].includes(s.paletteMode)) throw new Error('Modo de paleta no válido.');
  if(s.resampling !== undefined && !['area','nearest'].includes(s.resampling)) throw new Error('Método de reducción no válido.');
  if(s.palette !== undefined && (!Array.isArray(s.palette) || s.palette.length<1 || s.palette.length>64 || s.palette.some(c=>!Array.isArray(c)||c.length!==3||c.some(n=>!Number.isInteger(n)||n<0||n>255)))) throw new Error('Paleta fija no válida.');
  if (s.background !== null && (!Array.isArray(s.background) || s.background.length !== 3 || !s.background.every(n => Number.isInteger(n) && n >= 0 && n <= 255))) throw new Error('Color de fondo no válido.');
  if (![s.outline, s.mirror, s.stabilize].every(v => typeof v === 'boolean')) throw new Error('Opciones de procesamiento no válidas.');
  if (typeof s.baseUrl !== 'string' || !/^\/(?!\/)[a-zA-Z0-9/_-]+$/.test(s.baseUrl)) throw new Error('Indica una ruta pública local, por ejemplo /pixelart/characters/mi-personaje.');
}
function validateClip(input: ClipInput) {
  if (input.edits !== undefined && (!Array.isArray(input.edits) || input.edits.length < 1 || input.edits.length > 180 || input.edits.some(f => !f || !Number.isInteger(f.width) || !Number.isInteger(f.height) || f.width < 1 || f.height < 1 || f.width > 256 || f.height > 256 || !(f.data instanceof Uint8ClampedArray) || f.data.length !== f.width * f.height * 4))) throw new Error('Retoques RGBA no válidos.');
  if (!Number.isFinite(input.sourceFps) || input.sourceFps < .1 || input.sourceFps > 120 || input.frames.length < 1 || input.frames.length > 180) throw new Error('Se admiten de 1 a 180 muestras, entre 0,1 y 120 fps.');
  if (input.playbackFps !== undefined && (!Number.isFinite(input.playbackFps) || input.playbackFps < 1 || input.playbackFps > 30)) throw new Error('La reproducción debe estar entre 1 y 30 fps.');
  if (input.scaleBias !== undefined && (!Number.isFinite(input.scaleBias) || input.scaleBias < .5 || input.scaleBias > 2)) throw new Error('El ajuste de escala debe estar entre 0,5 y 2.');
  if (input.offset !== undefined && (!Array.isArray(input.offset) || input.offset.length !== 2 || !input.offset.every(n => Number.isFinite(n) && Math.abs(n) <= 256))) throw new Error('El desplazamiento debe estar entre -256 y 256 píxeles.');
  for (const frame of input.frames) if (!Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width < 1 || frame.height < 1 || frame.width > 512 || frame.height > 512 || frame.data.length !== frame.width * frame.height * 4) throw new Error('Fotograma RGBA no válido (máximo 512 × 512).');
  if (input.frames.some(f => f.width !== input.frames[0].width || f.height !== input.frames[0].height)) throw new Error('Todas las muestras de un clip deben tener la misma resolución y encuadre.');
}
export function missingSources(settings: GeneratorSettings, sources: Sources, actions = selectedActions(settings).map(a => a.action)): string[] {
  return actions.flatMap(action => PROFILES[settings.profile].directions.filter(d => !sources[action]?.[d] && !(settings.mirror && MIRRORS[d] && sources[action]?.[MIRRORS[d]!])).map(d => `${action}/${d.toUpperCase()}`));
}
/** Passing actions creates a preview subset. Full exports contain the selected actions. */
export interface PreparedClip { action: string; direction: Direction; frames: Frame[]; loop: LoopInfo; transforms: FrameTransform[] }
export interface CharacterPlan { settings: GeneratorSettings; sources: Sources; recipes: ReturnType<typeof selectedActions>; outputDirections: Direction[]; prepared: PreparedClip[]; warnings: string[] }
export function planCharacter(settings: GeneratorSettings, sources: Sources, actions?: string[], previewDirections?: Direction[]): CharacterPlan {
  validateSettings(settings);
  const profile = PROFILES[settings.profile], recipes = selectedActions(settings).filter(a => !actions || actions.includes(a.action));
  if (!recipes.length || actions?.some(a => !selectedActions(settings).some(r => r.action === a))) throw new Error('Acciones desconocidas.');
  const outputDirections = previewDirections ?? profile.directions;
  if (!outputDirections.length || new Set(outputDirections).size !== outputDirections.length || outputDirections.some(d => !profile.directions.includes(d))) throw new Error('Orientaciones de vista previa no válidas.');
  const sourceDirections = new Set(outputDirections);
  // Each action may use a direct view or its mirror independently.
  if (settings.mirror) outputDirections.forEach(d => { if (MIRRORS[d]) sourceDirections.add(MIRRORS[d]!); });
  const missing = missingSources(settings, sources, recipes.map(r => r.action)).filter(key => outputDirections.includes(key.split('/')[1].toLowerCase() as Direction));
  if (missing.length) throw new Error(`Faltan fuentes: ${missing.join(', ')}.`);
  let pixels = 0;
  for (const recipe of recipes) for (const input of Object.values(sources[recipe.action] || {})) { validateClip(input); for (const f of [...input.frames, ...(input.edits || [])]) pixels += f.width * f.height; }
  if (pixels > 64_000_000) throw new Error('Las fuentes superan el límite de 64 millones de píxeles. Reduce duración o resolución.');
  const prepared: PreparedClip[] = [], warnings: string[] = [];
  for (const recipe of recipes) {
    // Use the standing idle reference for seated and gestural actions to preserve proportions.
    // Otherwise use a constant per-clip scale; never resize individual frames independently.
    for (const direction of profile.directions) {
      const input = sources[recipe.action]?.[direction];
      if (!input || !sourceDirections.has(direction)) continue;
      const frames = input.frames.map(f => removeBackground(f, settings.background, settings.tolerance));
      if (frames.some(f => !bounds(f))) throw new Error(`${recipe.action}/${direction}: algún fotograma queda vacío; ajusta el fondo o recorta el clip.`);
      const loop = (recipe.playback === 'once' ? selectSequence : selectLoop)(frames, input.sourceFps, recipe.frames, input.range);
      const chosen = loop.indices.map(i => frames[i]), boxes = chosen.map(f => bounds(f)!);
      const referenceInput = (settings.profile === 'platformer' && recipe.action !== 'idle') || ['work', 'sit', 'celebrate', 'attack', 'talk'].includes(recipe.action) ? sources.idle?.[direction] : undefined;
      const referenceHeights = referenceInput?.frames.map(f => bounds(removeBackground(f, settings.background, settings.tolerance))?.height).filter((h): h is number => h !== undefined);
      const sameResolution = referenceInput && referenceInput.frames[0].height === input.frames[0].height && referenceInput.frames[0].width === input.frames[0].width;
      const referenceHeight = sameResolution && referenceHeights?.length ? median(referenceHeights) : recipe.preserveMotion ? boxes[0].height : median(boxes.map(b => b.height));
      if (['work', 'sit'].includes(recipe.action) && !(sameResolution && referenceHeights?.length)) warnings.push(`${recipe.action}/${direction}: sin idle con la misma resolución; comprueba la escala de la pose sentada.`);
      if (recipe.preserveMotion && !sameResolution) warnings.push(`${recipe.action}/${direction}: sin idle del mismo encuadre, se usa la primera muestra como apoyo y escala. Revisa la posición de la última pose.`);
      const scale = settings.targetHeight / referenceHeight * (input.scaleBias ?? 1);
      const referenceBoxes = sameResolution ? referenceInput!.frames.map(f=>bounds(removeBackground(f,settings.background,settings.tolerance))).filter((b): b is NonNullable<ReturnType<typeof bounds>> => !!b) : [];
      const baseline = recipe.preserveMotion ? (referenceBoxes.length ? referenceBoxes : [boxes[0]]) : boxes;
      const footX = median(baseline.map(b => b.center)), footY = median(baseline.map(b => b.bottom + 1));
      const stabilize = settings.stabilize && !recipe.preserveMotion;
      if (settings.stabilize && recipe.preserveMotion) warnings.push(`${recipe.action}/${direction}: se conserva el desplazamiento de la acción; no se fija cada fotograma por los pies.`);
      let clipped = false;
      const transforms = chosen.map((f,i)=>({scale, footX:stabilize ? boxes[i].center : footX, footY:stabilize ? boxes[i].bottom+1 : footY, offset:input.offset, sampleWidth:f.width, sampleHeight:f.height}));
      const normalized = chosen.map((f, i) => {
        const out = normalizeOriginal(f, settings, transforms[i]);
        clipped ||= out.clipped; return out.frame;
      });
      if (clipped) warnings.push(`${recipe.action}/${direction}: la silueta toca o sale de la celda. Reduce la altura o amplía la celda antes de usarla.`);
      if (settings.stabilize && ['run', 'celebrate'].includes(recipe.action)) warnings.push(`${recipe.action}/${direction}: estabilizar cada fotograma elimina desplazamientos verticales y saltos.`);
      if (new Set(loop.indices).size < recipe.frames && recipe.frames > 1) warnings.push(`${recipe.action}/${direction}: hay muestras repetidas; importa un ciclo con más fotogramas.`);
      if (recipe.playback !== 'once' && !input.range && loop.score > .75 && input.frames.length > 2) warnings.push(`${recipe.action}/${direction}: cierre automático poco claro; revisa o selecciona un intervalo manual.`);
      const rawFps = input.playbackFps ?? settings.actionOptions?.[recipe.action]?.fps ?? (settings.profile === 'platformer' ? recipe.fps : undefined) ?? (input.frames.length === 1 ? recipe.fps : recipe.frames * input.sourceFps / (loop.end - loop.start));
      const fps = Math.round(Math.max(1, Math.min(30, rawFps)) * 100) / 100;
      if (Math.abs(rawFps - fps) > .1) warnings.push(`${recipe.action}/${direction}: velocidad limitada a ${fps} fps.`);
      prepared.push({ action: recipe.action, direction, frames: normalized, transforms, loop: { ...loop, fps, sourceFps: input.sourceFps, sourceName: input.name, scale, scaleBias: input.scaleBias ?? 1, offset: [...(input.offset ?? [0, 0])] } });
    }
  }
  return {settings, sources, recipes, outputDirections, prepared, warnings};
}
export function finishCharacter(plan: CharacterPlan): BuildResult {
  const {settings,sources,recipes,outputDirections,prepared,warnings}=plan;
  const fixed = settings.paletteMode === 'fixed' && settings.palette?.length;
  const palette = fixed ? settings.palette!.map(c=>[...c] as RGB) : makePalette(prepared.flatMap(p => p.frames), settings.colors - (settings.outline ? 1 : 0));
  if (settings.outline && !fixed) palette.unshift([35, 32, 43]);
  prepared.forEach(p => {
    const edits = sources[p.action]?.[p.direction]?.edits;
    if (edits) {
      if (edits.length !== p.frames.length || edits.some(f => f.width !== settings.width || f.height !== settings.height || f.data.length !== f.width * f.height * 4)) throw new Error(`${p.action}/${p.direction}: los retoques tienen otra cuadrícula. Restaura la fuente antes de cambiar el tamaño de celda.`);
      p.frames = edits.map(f => ({ ...f, data: new Uint8ClampedArray(f.data) }));
    } else p.frames.forEach(f => applyPalette(f, palette, settings.outline));
  });
  // Retouched colors are deliberately preserved, including new hand-picked colors.
  const actualColors = new Map<string, RGB>();
  for (const p of prepared) for (const f of p.frames) for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3]) {
    const color: RGB = [f.data[i], f.data[i + 1], f.data[i + 2]]; actualColors.set(color.join(','), color);
  }
  const sheets: Sheet[] = recipes.map(recipe => {
    const sheet: Sheet = { action: recipe.action, playback: recipe.playback ?? 'loop', image: emptyFrame(settings.width * recipe.frames, settings.height * outputDirections.length), frames: recipe.frames, directions: [...outputDirections], loops: {} };
    outputDirections.forEach((direction, row) => {
      const direct = prepared.find(p => p.action === recipe.action && p.direction === direction);
      const source = direct || prepared.find(p => p.action === recipe.action && p.direction === MIRRORS[direction]);
      if (!source) throw new Error(`Falta ${recipe.action}/${direction}.`);
      const frames = direct ? source.frames : source.frames.map(f => mirrorFrame(f, settings.anchor[0]));
      if (!direct && settings.anchor[0] !== settings.width / 2) warnings.push(`${recipe.action}/${direction}: reflejo sobre apoyo descentrado; revisa los bordes.`);
      frames.forEach((frame, col) => paste(sheet.image, frame, col * settings.width, row * settings.height));
      sheet.loops[direction] = { ...source.loop, ...(direct ? {} : { mirroredFrom: source.direction }) };
    });
    return sheet;
  });
  const url = (action: string) => `${settings.baseUrl.replace(/\/$/, '')}/${action}.png`;
  return {
    sheets,
    character: { image: url(sheets[0].action), frameWidth: settings.width, frameHeight: settings.height, anchor: [...settings.anchor], directions: [...outputDirections],
      animations: Object.fromEntries(sheets.map(sheet => [sheet.action, { image: url(sheet.action), row: 0, frames: sheet.frames, fps: sheet.loops[outputDirections[0]]!.fps, directionFps: Object.fromEntries(outputDirections.map(d => [d, sheet.loops[d]!.fps])) }])) },
    metadata: { version: 1, profile: settings.profile, settings: structuredClone(settings), palette: [...actualColors.values()], processingPalette: palette.map(c=>[...c] as RGB), loops: Object.fromEntries(sheets.map(s => [s.action, s.loops])), warnings: [...new Set(warnings)] }
  };
}

/** Synchronous processing for decoded sources and older projects. */
export function buildCharacter(settings: GeneratorSettings, sources: Sources, actions?: string[], previewDirections?: Direction[]): BuildResult {
  return finishCharacter(planCharacter(settings,sources,actions,previewDirections));
}

/** Apply a compact palette to a standalone sprite, preserving its geometry. */
export function quantizeSprite(frame: Frame, colors: number): Frame {
  if(!Number.isInteger(colors) || colors<4 || colors>64)throw new Error('Usa entre 4 y 64 colores.');
  const result={...frame,data:new Uint8ClampedArray(frame.data)};
  applyPalette(result,makePalette([frame],colors),false);
  return result;
}
