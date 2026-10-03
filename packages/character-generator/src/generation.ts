import { angles, motions, playbackPrompt, type CharacterBrief } from './prompts';
import { availableActions, actionRecipe, validateActionOptions, PROFILES, type ActionOptions, type Direction, type Profile } from './types';

export interface ImageRequest {
  brief: CharacterBrief;
  profile: Profile;
  direction: Direction;
  action: string;
  kind: 'reference' | 'action';
  recipe?: ActionOptions;
  quality: 'low' | 'medium' | 'high';
  reference?: string;
  referenceDirection?: Direction;
  referenceKind?: 'inspiration';
}
export interface ImageResult {
  image: string;
  prompt: string;
  model: string;
  columns: number;
  rows: number;
  frames: number;
}
export interface ApprovedReference { image: string; prompt: string; model: string }
export interface ArtProject {
  references: Partial<Record<Direction, ApprovedReference>>;
  inspiration?: { image: string; name: string };
}
export const orientationLabels: Record<Direction, string> = {
  se: 'SE ↘ · de frente en tres cuartos: cara y pecho visibles',
  ne: 'NE ↗ · de espaldas en tres cuartos: nuca y espalda visibles',
  sw: 'SW ↙ · de frente en tres cuartos: cara y pecho visibles',
  nw: 'NW ↖ · de espaldas en tres cuartos: nuca y espalda visibles',
  e: 'E → · perfil derecho', w: 'W ← · perfil izquierdo',
  s: 'S ↓ · de frente', n: 'N ↑ · de espaldas'
};
/** Reuse a matching view or turn another approved reference into this facing. */
export function selectImageReference(art: ArtProject, direction: Direction) {
  const sourceDirection = art.references[direction] ? direction : DIRECTIONS.find(d => !!art.references[d]);
  return sourceDirection ? { direction: sourceDirection, asset: art.references[sourceDirection]! } : undefined;
}
/** Approved views preserve the established design; the original photo is an optional starting point. */
export function imageReferenceInput(art: ArtProject, direction: Direction, preferPhoto = false): Pick<ImageRequest, 'reference' | 'referenceDirection' | 'referenceKind'> {
  const approved = selectImageReference(art, direction);
  if (art.inspiration && (preferPhoto || !approved)) return { reference: art.inspiration.image, referenceKind: 'inspiration' };
  return approved ? { reference: approved.asset.image, referenceDirection: approved.direction } : {};
}
export interface ImageProvider {
  status(): Promise<{ available: boolean; model?: string; message?: string }>;
  generate(request: ImageRequest, signal?: AbortSignal): Promise<ImageResult>;
}
export const emptyArt = (): ArtProject => ({ references: {} });
/** Direct images are only for short actions; longer cycles stay on the video path. */
export function shortActionRecipe(profile: Profile, action: string, options?: ActionOptions) {
  const recipe = actionRecipe(profile, action, options);
  return recipe && recipe.frames >= 1 && recipe.frames <= 4 ? recipe : undefined;
}
export const DIRECTIONS: Direction[] = ['ne', 'se', 'sw', 'nw', 'e', 'w', 's', 'n'];
const MAX_REFERENCE_BYTES = 2_000_000;
/** Only embedded PNGs are accepted; no URLs or remote-file fetching. */
export function pngData(image: string, maxBytes = MAX_REFERENCE_BYTES): Uint8Array {
  if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,') || image.length > Math.ceil(maxBytes * 4 / 3) + 30) throw new Error('La referencia debe ser un PNG de hasta 2 MB.');
  const encoded = image.slice(22);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('PNG codificado no válido.');
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  if (bytes.length < 24 || bytes.length > maxBytes || [137, 80, 78, 71, 13, 10, 26, 10].some((n, i) => bytes[i] !== n)) throw new Error('Referencia PNG no válida.');
  const view = new DataView(bytes.buffer);
  if (view.getUint32(12) !== 0x49484452 || !view.getUint32(16) || !view.getUint32(20) || view.getUint32(16) * view.getUint32(20) > 8_000_000) throw new Error('Dimensiones PNG no válidas.');
  return bytes;
}
export function pngUrl(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}
export function validateImageRequest(value: unknown): ImageRequest {
  const r = value as ImageRequest;
  if (!r || !Object.hasOwn(PROFILES, r.profile) || !PROFILES[r.profile].directions.includes(r.direction) || !availableActions(r.profile).some(a => a.action === r.action) || !['reference', 'action'].includes(r.kind) || !['low', 'medium', 'high'].includes(r.quality)) throw new Error('Solicitud de imagen no válida.');
  if (r.recipe !== undefined) validateActionOptions(r.recipe);
  if (r.kind === 'action' && (!shortActionRecipe(r.profile, r.action, r.recipe) || !r.reference || !r.referenceDirection || r.referenceKind)) throw new Error('Las acciones por imagen necesitan una referencia aprobada y entre 1 y 4 fotogramas.');
  if (!r.brief || !['description', 'style', 'props'].every(k => typeof r.brief[k as keyof CharacterBrief] === 'string' && (r.brief[k as keyof CharacterBrief] as string).length <= 2000) || (!r.brief.description.trim() && !r.reference) || !r.brief.style.trim()) throw new Error('Añade una descripción o una imagen de referencia y elige un estilo visual (hasta 2000 caracteres por campo).');
  if (!r.brief.notes || typeof r.brief.notes !== 'object' || Object.entries(r.brief.notes).some(([d, note]) => !DIRECTIONS.includes(d as Direction) || typeof note !== 'string' || note.length > 1000)) throw new Error('Notas por orientación no válidas.');
  if (r.reference !== undefined) pngData(r.reference);
  if (r.referenceDirection !== undefined && (!DIRECTIONS.includes(r.referenceDirection) || !r.reference)) throw new Error('Orientación de referencia no válida.');
  if (r.referenceKind !== undefined && (r.referenceKind !== 'inspiration' || !r.reference || r.referenceDirection !== undefined)) throw new Error('Tipo de referencia no válido.');
  return r;
}
export function imagePlan(request: ImageRequest) {
  validateImageRequest(request);
  const recipe = actionRecipe(request.profile, request.action, request.recipe)!;
  const frames = request.kind === 'action' ? recipe.frames : 1;
  const columns = frames, rows = 1, size = frames === 1 ? '1024x1536' : '1536x1024';
  const { brief, direction } = request;
  const identity = `${brief.description.trim() || 'Use the supplied image as the visual description of the character.'} Style: ${brief.style.trim()}. Equipment: ${brief.props.trim() || (request.reference ? 'preserve visible character accessories from the reference' : 'none')}.`;
  const reference = request.reference
    ? request.referenceKind === 'inspiration'
      ? 'Use the supplied photo or illustration as the visual starting point. Preserve recognizable visible features, hair, clothing colors and accessories unless the written description asks to change them. Adapt the subject to the requested game-art style and proportions. Do not copy the photo background, lighting, camera angle, framing or pose. Infer any unseen body or costume details consistently. The source image has no approved game orientation.'
      : `Create the character using the supplied image to preserve identity, costume, proportions and equipment. SOURCE REFERENCE: ${request.referenceDirection?.toUpperCase() || 'orientation unspecified'}. The supplied image is an identity guide; its facing is not the target unless it matches the target below. Reconstruct hidden surfaces when turning the character. A front-to-back turn is not a horizontal mirror. Preserve anatomical equipment placement.`
    : 'Create the character from the character description, establishing a consistent identity, costume, proportions and equipment.';
  const orientation = `TARGET ORIENTATION: ${direction.toUpperCase()}. ${angles[direction]} ${PROFILES[request.profile].camera} Turn the character into this target orientation before depicting any pose; keep this facing throughout the output. This target overrides any conflicting facing in the source image or description.`;
  const output = request.kind === 'reference'
    ? 'Create a single full-body character pose in the target orientation. Show only this one view.'
    : `ACTION: ${request.action}. ${motions[request.action]} ${frames === 1
      ? 'Create exactly one full-body still pose of this action, not a standing reference or a sequence of transitions.'
      : `Create a sprite sheet with exactly ${frames} equal-width cells in one horizontal row, ordered in time from left to right. Show one distinct pose per cell for this action. ${playbackPrompt(recipe)} Keep identical character scale, camera and horizontal centering in each cell. ${recipe.preserveMotion ? "Preserve vertical displacement relative to a fixed ground baseline; do not align each pose by its feet." : "Keep consistent ground contact baseline."} No extra poses and no duplicated closing frame.`} Preserve the requested facing and costume. Do not draw furniture, labels, cell borders or text.`;
  const prompt = `${identity}\n${reference}\n${orientation}\n${brief.notes[direction] || ''} Solid uniform magenta (#ff00ff) background, no floor, shadow or scenery. Leave clear padding around every limb and accessory.\n${output}`;
  return { prompt, columns, rows, frames, size };
}

export function httpImageProvider(endpoint: string): ImageProvider {
  async function parse(response: Response) {
    const data = await response.json().catch(() => { throw new Error('El servidor no devolvió una respuesta de imágenes válida.'); });
    if (!response.ok) throw new Error(data.error || 'La ayuda de imágenes no está disponible.');
    return data;
  }
  return {
    async status() { return parse(await fetch(endpoint, { signal: AbortSignal.timeout(10000), cache: 'no-store' })); },
    async generate(request, signal) { return parse(await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal })); }
  };
}
