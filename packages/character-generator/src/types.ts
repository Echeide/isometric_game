export type Direction = 'ne' | 'se' | 'sw' | 'nw' | 'e' | 'w' | 's' | 'n';
export type Profile = 'game' | 'iso-eight' | 'platformer';
export type Playback = 'loop' | 'once';
export type ExportFormat = 'game' | 'generic';
export interface ActionOptions { frames?: number; fps?: number; playback?: Playback }
export type RGB = [number, number, number];
export interface Frame { width: number; height: number; data: Uint8ClampedArray }
export interface Recipe { action: string; frames: number; fps: number; playback?: Playback; preserveMotion?: boolean }
export const PROFILES: Record<Profile, { label: string; camera: string; directions: Direction[]; initialDirection: Direction; actions: Recipe[] }> = {
  game: {
    label: 'Isométrico · nuestro juego', camera: 'Fixed orthographic isometric camera, no perspective change.', initialDirection: 'se', directions: ['ne', 'se', 'sw', 'nw'],
    actions: [{ action: 'idle', frames: 4, fps: 3 }, { action: 'walk', frames: 8, fps: 10 },
      { action: 'work', frames: 4, fps: 8 }, { action: 'talk', frames: 4, fps: 5 },
      { action: 'celebrate', frames: 6, fps: 8 }, { action: 'sit', frames: 1, fps: 1 }]
  },
  'iso-eight': {
    label: 'Isométrico · 8 direcciones', camera: 'Fixed orthographic isometric camera, no perspective change.', initialDirection: 'se', directions: ['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n'],
    actions: ['idle', 'walk', 'run', 'attack'].map(action => ({ action, frames: 8, fps: 8 }))
  },
  platformer: {
    label: 'Plataformas 2D · vista lateral', camera: 'Fixed orthographic side-view camera at character height, flat 2D side-scrolling game view. No perspective or overhead angle.', initialDirection: 'e', directions: ['e', 'w'],
    actions: [{ action: 'idle', frames: 4, fps: 4 }, { action: 'walk', frames: 8, fps: 10 },
      { action: 'run', frames: 8, fps: 12 }, { action: 'jump', frames: 4, fps: 8, playback: 'once', preserveMotion: true },
      { action: 'fall', frames: 2, fps: 6, playback: 'once', preserveMotion: true },
      { action: 'attack', frames: 6, fps: 10, playback: 'once' }, { action: 'hurt', frames: 3, fps: 8, playback: 'once' },
      { action: 'die', frames: 6, fps: 8, playback: 'once', preserveMotion: true }]
  }
};
export const ACTION_LABELS: Record<string, string> = { idle: 'Reposo', walk: 'Caminar', work: 'Trabajar', talk: 'Conversar', celebrate: 'Celebrar', sit: 'Sentarse', attack: 'Ataque', hurt: 'Daño', run: 'Correr', jump: 'Saltar', fall: 'Caer', die: 'Morir' };
/** Available actions are separate from each profile's legacy default selection. */
export function availableActions(profile: Profile): Recipe[] {
  const defaults = PROFILES[profile].actions;
  if (profile === 'platformer') return defaults;
  const all = [...PROFILES.game.actions, { action: 'attack', frames: 8, fps: 10 }, { action: 'hurt', frames: 3, fps: 6 }, { action: 'run', frames: 8, fps: 12 }];
  return all.map(recipe => defaults.find(r => r.action === recipe.action) ?? recipe);
}
export function actionRecipe(profile: Profile, action: string, options?: ActionOptions): Recipe | undefined {
  const recipe = availableActions(profile).find(r => r.action === action);
  return recipe ? { ...recipe, ...options, action, playback: options?.playback ?? recipe.playback ?? 'loop' } : undefined;
}
export function validateActionOptions(options: ActionOptions) {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Object.keys(options).some(k => !['frames','fps','playback'].includes(k)) ||
      (options.frames !== undefined && (!Number.isInteger(options.frames) || options.frames < 1 || options.frames > 16)) ||
      (options.fps !== undefined && (!Number.isFinite(options.fps) || options.fps < 1 || options.fps > 30)) ||
      (options.playback !== undefined && !['loop','once'].includes(options.playback))) throw new Error('Ajustes de acción no válidos: 1–16 fotogramas, 1–30 fps y reproducción en bucle o una vez.');
}
export function selectedActions(settings: Pick<GeneratorSettings, 'profile' | 'actions' | 'actionOptions'>): Recipe[] {
  const names = settings.actions ?? PROFILES[settings.profile].actions.map(r => r.action);
  return names.flatMap(name => actionRecipe(settings.profile, name, settings.actionOptions?.[name]) ?? []);
}
export const MIRRORS: Partial<Record<Direction, Direction>> = { sw: 'se', nw: 'ne', w: 'e' };
export type OriginalSource =
  | { kind: 'images'; files: Blob[] }
  | { kind: 'sheet'; files: Blob[]; columns: number; rows: number; row: number }
  | { kind: 'video'; files: Blob[]; start: number };
export interface ClipInput {
  /** Compressed originals; frames remain lightweight samples for cycle analysis. */
  original?: OriginalSource;
  /** Final-resolution retouches; keep source frames intact for restoration. */
  edits?: Frame[];
  reviewed?: boolean;
  frames: Frame[];
  /** Rate of the imported samples, not necessarily the original video's rate. */
  sourceFps: number;
  name: string;
  /** Manual interval: start included, end excluded. Omit to search for a loop. */
  range?: [number, number];
  playbackFps?: number;
  /** Manual correction after automatic scale matching. */
  scaleBias?: number;
  /** Fine alignment in output pixels. */
  offset?: [number, number];
}
export type Sources = Record<string, Partial<Record<Direction, ClipInput>>>;
export interface GeneratorSettings {
  id: string;
  profile: Profile;
  /** Omitted in old projects: use the profile defaults. */
  actions?: string[];
  actionOptions?: Record<string, ActionOptions>;
  exportFormat?: ExportFormat;
  width: number;
  height: number;
  anchor: [number, number];
  targetHeight: number;
  colors: number;
  /** Missing in legacy projects: preserve automatic palette behavior. */
  paletteMode?: 'auto' | 'fixed';
  palette?: RGB[];
  resampling?: 'area' | 'nearest';
  background: RGB | null;
  tolerance: number;
  outline: boolean;
  mirror: boolean;
  stabilize: boolean;
  /** URL of the folder where the exported PNG files will be served. */
  baseUrl: string;
}
export const defaultSettings = (): GeneratorSettings => ({
  id: 'mi-personaje', profile: 'game', width: 64, height: 96, anchor: [32, 80],
  targetHeight: 60, colors: 28, paletteMode: 'fixed', resampling: 'area', background: [255, 0, 255], tolerance: 90,
  outline: true, mirror: true, stabilize: false, baseUrl: '/pixelart/characters/mi-personaje'
});
export interface LoopInfo {
  start: number; end: number; indices: number[]; score: number; fps: number;
  sourceFps: number; sourceName: string; scale: number; mirroredFrom?: Direction;
  scaleBias: number; offset: [number, number];
}
export interface Sheet { action: string; playback?: Playback; image: Frame; frames: number; directions: Direction[]; loops: Partial<Record<Direction, LoopInfo>> }
export interface BuildResult {
  sheets: Sheet[];
  character: {
    image: string; frameWidth: number; frameHeight: number; anchor: [number, number]; directions: Direction[];
    animations: Record<string, { image: string; row: number; frames: number; fps: number; directionFps: Partial<Record<Direction, number>> }>;
  };
  metadata: { version: 1; profile: Profile; settings: GeneratorSettings; palette: RGB[]; processingPalette?: RGB[]; loops: Record<string, Sheet['loops']>; warnings: string[] };
}

export interface PixelEditRequest { blob: Blob; name: string; width: number; height: number; frames: number; fps: number }
export interface PixelEditorProvider { edit(request: PixelEditRequest): Promise<Blob | null> }
