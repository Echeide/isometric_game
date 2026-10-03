import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { validateSettings } from './pipeline';
import { availableActions, selectedActions, PROFILES, type BuildResult, type ClipInput, type Frame, type GeneratorSettings, type Sources } from './types';
import { createPrompts, type CharacterBrief } from './prompts';
import { DIRECTIONS, emptyArt, pngData, pngUrl, type ArtProject } from './generation';

const MAX_SIDE = 192, MAX_PIXELS = 64_000_000;
function canvas(width: number, height: number) {
  const element = document.createElement('canvas'); element.width = width; element.height = height;
  const context = element.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Este navegador no permite procesar imágenes en canvas.');
  return { element, context };
}
function capture(source: CanvasImageSource, width: number, height: number, crop?: [number, number, number, number]): Frame {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
  const { context } = canvas(w, h);
  if (crop) context.drawImage(source, ...crop, 0, 0, w, h); else context.drawImage(source, 0, 0, w, h);
  return { width: w, height: h, data: context.getImageData(0, 0, w, h).data };
}
export async function readImages(files: File[], sourceFps: number): Promise<ClipInput> {
  if (!files.length || files.length > 180) throw new Error('Selecciona entre 1 y 180 imágenes.');
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const frames: Frame[] = [];
  for (const file of sorted) {
    if (file.size > 20 * 1024 * 1024) throw new Error('Cada imagen debe ocupar menos de 20 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      if (bitmap.width * bitmap.height > 32_000_000) throw new Error('Imagen mayor de 32 megapíxeles.');
      frames.push(capture(bitmap, bitmap.width, bitmap.height));
    } finally { bitmap.close(); }
  }
  return { frames, sourceFps, name: sorted.map(f => f.name).join(', '), range: [0, frames.length] };
}
export async function readSheet(file: File, columns: number, rows: number, row: number, sourceFps: number): Promise<ClipInput> {
  if (![columns, rows].every(n => Number.isInteger(n) && n > 0 && n <= 180) || !Number.isInteger(row) || row < 0 || row >= rows) throw new Error('Cuadrícula de origen no válida.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La hoja debe ocupar menos de 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 32_000_000 || bitmap.width % columns || bitmap.height % rows) throw new Error('Las dimensiones del PNG deben ser múltiplos exactos de filas y columnas (máximo 32 MP).');
    const w = bitmap.width / columns, h = bitmap.height / rows;
    const frames = Array.from({ length: columns }, (_, i) => capture(bitmap, w, h, [i * w, row * h, w, h]));
    return { frames, sourceFps, name: `${file.name} · fila ${row + 1}`, range: [0, columns] };
  } finally { bitmap.close(); }
}
function waitFor(video: HTMLVideoElement, event: string, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const clean = () => { clearTimeout(timer); video.removeEventListener(event, ready); video.removeEventListener('error', error); signal?.removeEventListener('abort', abort); };
    const ready = () => { clean(); resolve(); };
    const error = () => { clean(); reject(new Error('No se pudo decodificar el vídeo. Prueba MP4 H.264 o WebM compatible con tu navegador.')); };
    const abort = () => { clean(); reject(new Error('Importación cancelada.')); };
    const timer = setTimeout(error, 15000);
    video.addEventListener(event, ready, { once: true }); video.addEventListener('error', error, { once: true }); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}
export async function readVideo(file: File, options: { start: number; seconds: number; fps: number; signal?: AbortSignal; onprogress?: (progress: number) => void }): Promise<ClipInput> {
  const { start, seconds, fps, signal, onprogress } = options;
  if (![start, seconds, fps].every(Number.isFinite) || start < 0 || seconds <= 0 || seconds > 10 || fps < 1 || fps > 30 || Math.ceil(seconds * fps) > 180) throw new Error('Importa hasta 10 segundos y 180 muestras, a 1–30 fps.');
  if (file.size > 100 * 1024 * 1024) throw new Error('El vídeo debe ocupar menos de 100 MB.');
  const video = document.createElement('video'), url = URL.createObjectURL(file);
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  try {
    const ready = waitFor(video, 'loadeddata', signal); video.src = url; video.load(); await ready;
    if (!Number.isFinite(video.duration) || start >= video.duration) throw new Error('El inicio está fuera del vídeo, o su duración no se puede leer.');
    const count = Math.max(1, Math.ceil(Math.min(seconds, video.duration - start) * fps)), frames: Frame[] = [];
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new Error('Importación cancelada.');
      const time = Math.min(start + i / fps, video.duration - .001);
      if (Math.abs(video.currentTime - time) > .0001) { const seeked = waitFor(video, 'seeked', signal); video.currentTime = time; await seeked; }
      frames.push(capture(video, video.videoWidth, video.videoHeight)); onprogress?.((i + 1) / count);
    }
    return { name: `${file.name} · desde ${start}s`, frames, sourceFps: fps };
  } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
}
export async function encodePNG(frame: Frame): Promise<Uint8Array> {
  const { element, context } = canvas(frame.width, frame.height);
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.data), frame.width, frame.height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => element.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo crear el PNG.')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
export function download(data: Uint8Array, name: string, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export async function exportCharacter(result: BuildResult, brief: CharacterBrief) {
  const settings = result.metadata.settings;
  if (result.character.directions.length !== PROFILES[settings.profile].directions.length || selectedActions(settings).some(a => !result.character.animations[a.action])) throw new Error('Construye todas las acciones antes de exportar el personaje.');
  const files: Record<string, Uint8Array> = {};
  for (const sheet of result.sheets) files[`${sheet.action}.png`] = await encodePNG(sheet.image);
  files['character.json'] = strToU8(JSON.stringify(result.character, null, 2));
  files['processing.json'] = strToU8(JSON.stringify(result.metadata, null, 2));
  files['prompts.json'] = strToU8(JSON.stringify({ brief, recipes: createPrompts(brief, settings.profile, settings.mirror, settings.actions) }, null, 2));
  files['LEEME.txt'] = strToU8(`Personaje: ${settings.id}\nPerfil: ${settings.profile}\nCopia los PNG a static${settings.baseUrl}.\n${settings.profile === 'game' ? 'Para importar como jugador en el juego actual se requieren idle, walk, work, talk, celebrate y sit. Las acciones attack, hurt y run se exportan, pero su reproducción requiere soporte en el juego.\n' : 'Este perfil tiene ocho direcciones y acciones run/attack. El motor actual del juego usa cuatro direcciones y no puede consumirlo directamente.\n'}Revisa visualmente orientación, accesorios, apoyo, cortes y cierre de cada ciclo.\nprocessing.json conserva la paleta, las muestras y velocidades por orientación.\n`);
  return zipSync(files, { level: 6 });
}
export async function saveProject(settings: GeneratorSettings, brief: CharacterBrief, sources: Sources, art: ArtProject = emptyArt()) {
  validateSettings(settings);
  const files: Record<string, Uint8Array> = {}, inputs: Record<string, Record<string, object>> = {};
  for (const [action, directions] of Object.entries(sources)) {
    inputs[action] = {};
    for (const [direction, input] of Object.entries(directions)) {
      if (!input) continue;
      const paths: string[] = [];
      for (let i = 0; i < input.frames.length; i++) { const path = `sources/${action}/${direction}/${i}.png`; files[path] = await encodePNG(input.frames[i]); paths.push(path); }
      const edits: string[] = [];
      for (let i = 0; i < (input.edits?.length || 0); i++) { const path = `edits/${action}/${direction}/${i}.png`; files[path] = await encodePNG(input.edits![i]); edits.push(path); }
      inputs[action][direction] = { ...input, frames: paths, edits: input.edits ? edits : undefined };
    }
  }
  const references: Record<string, object> = {};
  for (const direction of DIRECTIONS) {
    const reference = art.references[direction];
    if (!reference) continue;
    const path = `references/${direction}.png`;
    files[path] = pngData(reference.image);
    references[direction] = { path, prompt: reference.prompt, model: reference.model };
  }
  let inspiration;
  if (art.inspiration) {
    files['references/inspiration.png'] = pngData(art.inspiration.image);
    inspiration = { path: 'references/inspiration.png', name: art.inspiration.name };
  }
  files['project.json'] = strToU8(JSON.stringify({ kind: 'isometric-character-project', version: 1, settings, brief, sources: inputs, art: { references, inspiration } }));
  return zipSync(files, { level: 1 });
}
export async function loadProject(file: File): Promise<{ settings: GeneratorSettings; brief: CharacterBrief; sources: Sources; art: ArtProject }> {
  if (file.size > 100 * 1024 * 1024) throw new Error('El proyecto supera 100 MB.');
  let bytes = 0, entries = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
    bytes += entry.originalSize; entries++;
    if (bytes > 300 * 1024 * 1024 || entries > 6000) throw new Error('El proyecto descomprimido supera los límites.');
    return entry.name === 'project.json' || /^(sources|edits)\/[a-z]+\/[a-z]+\/\d+\.png$/.test(entry.name) || /^references\/[a-z]+\.png$/.test(entry.name);
  } });
  if (!files['project.json'] || files['project.json'].length > 1_000_000) throw new Error('Falta un project.json válido.');
  const raw = JSON.parse(strFromU8(files['project.json']));
  if (raw.kind !== 'isometric-character-project' || raw.version !== 1) throw new Error('Versión de proyecto no compatible.');
  validateSettings(raw.settings);
  if (!raw.brief || !['description', 'style', 'props'].every(k => typeof raw.brief[k] === 'string') || !raw.brief.notes || Object.values(raw.brief.notes).some(n => typeof n !== 'string')) throw new Error('Descripción del personaje no válida.');
  const profile = PROFILES[raw.settings.profile as GeneratorSettings['profile']], sources: Sources = {};
  let pixels = 0;
  for (const recipe of availableActions(raw.settings.profile)) {
    sources[recipe.action] = {};
    for (const direction of profile.directions) {
      const input = raw.sources?.[recipe.action]?.[direction];
      if (!input) continue;
      if (!Array.isArray(input.frames) || !input.frames.length || input.frames.length > 180 || typeof input.name !== 'string' || !Number.isFinite(input.sourceFps) || input.sourceFps <= 0 || input.sourceFps > 120) throw new Error('Clip no válido en el proyecto.');
      if (input.range !== undefined && (!Array.isArray(input.range) || input.range.length !== 2 || !input.range.every(Number.isInteger) || input.range[0] < 0 || input.range[1] > input.frames.length || input.range[0] >= input.range[1])) throw new Error('Recorte no válido en el proyecto.');
      if (input.playbackFps !== undefined && (!Number.isFinite(input.playbackFps) || input.playbackFps < 1 || input.playbackFps > 30)) throw new Error('Velocidad no válida en el proyecto.');
      if (input.scaleBias !== undefined && (!Number.isFinite(input.scaleBias) || input.scaleBias < .5 || input.scaleBias > 2)) throw new Error('Escala no válida en el proyecto.');
      if (input.offset !== undefined && (!Array.isArray(input.offset) || input.offset.length !== 2 || !input.offset.every((n: number) => Number.isFinite(n) && Math.abs(n) <= 256))) throw new Error('Desplazamiento no válido en el proyecto.');
      if (input.reviewed !== undefined && typeof input.reviewed !== 'boolean') throw new Error('Revisión no válida.');
      if (input.edits !== undefined && (!Array.isArray(input.edits) || input.edits.length !== recipe.frames)) throw new Error('Retoques no válidos.');
      const frames: Frame[] = [], edits: Frame[] = [];
      for (const [index, path] of [...input.frames, ...(input.edits || [])].entries()) {
        if (typeof path !== 'string' || !files[path]) throw new Error('Falta una imagen fuente del proyecto.');
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(files[path])], { type: 'image/png' }));
        try {
          pixels += bitmap.width * bitmap.height;
          if (bitmap.width > 512 || bitmap.height > 512 || pixels > MAX_PIXELS) throw new Error('El proyecto supera el límite de píxeles.');
          // Preserve source pixels exactly on round trips (no second resampling).
          const { context } = canvas(bitmap.width, bitmap.height); context.drawImage(bitmap, 0, 0);
          const isEdit = index >= input.frames.length;
          if (isEdit && (bitmap.width !== raw.settings.width || bitmap.height !== raw.settings.height)) throw new Error('La cuadrícula de los retoques no coincide.');
          (isEdit ? edits : frames).push({ width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data });
        } finally { bitmap.close(); }
      }
      sources[recipe.action][direction] = { name: input.name, frames, edits: input.edits ? edits : undefined, reviewed: input.reviewed, sourceFps: input.sourceFps, range: input.range, playbackFps: input.playbackFps, scaleBias: input.scaleBias, offset: input.offset };
    }
  }
  const art = emptyArt();
  if (raw.art?.inspiration !== undefined) {
    const photo = raw.art.inspiration;
    if (!photo || photo.path !== 'references/inspiration.png' || !files[photo.path] || typeof photo.name !== 'string' || photo.name.length > 255) throw new Error('Foto de referencia no válida.');
    const image = pngUrl(files[photo.path]); pngData(image);
    art.inspiration = { image, name: photo.name };
  }
  for (const direction of DIRECTIONS) {
    const reference = raw.art?.references?.[direction];
    if (!reference) continue;
    if (reference.path !== `references/${direction}.png` || !files[reference.path] || typeof reference.prompt !== 'string' || reference.prompt.length > 20000 || typeof reference.model !== 'string' || reference.model.length > 100) throw new Error('Referencia del personaje no válida.');
    const image = pngUrl(files[reference.path]); pngData(image);
    art.references[direction] = { image, prompt: reference.prompt, model: reference.model };
  }
  return { settings: raw.settings, brief: raw.brief, sources, art };
}

export async function prepareReference(image: string): Promise<string> {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(pngData(image, 20_000_000))], { type: 'image/png' }));
  try {
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const { element, context } = canvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    context.drawImage(bitmap, 0, 0, element.width, element.height);
    const result = element.toDataURL('image/png'); pngData(result); return result;
  } finally { bitmap.close(); }
}

/** Normalize local photos without uploading them; canvas also drops file metadata. */
export async function importCharacterReference(file: File): Promise<NonNullable<ArtProject['inspiration']>> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Selecciona una imagen PNG, JPG o WebP.');
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('La foto debe ocupar entre 1 byte y 20 MB.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('No se pudo leer la imagen. Prueba con otro PNG, JPG o WebP.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 32_000_000) throw new Error('La imagen supera los 32 megapíxeles.');
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const { element, context } = canvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    context.drawImage(bitmap, 0, 0, element.width, element.height);
    const image = element.toDataURL('image/png'); pngData(image);
    return { image, name: file.name.slice(0, 255) };
  } finally { bitmap.close(); }
}
