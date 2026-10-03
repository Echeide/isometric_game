export type Direction = 'ne' | 'se' | 'sw' | 'nw' | 'e' | 'w' | 's' | 'n';
export type Profile = 'game' | 'iso-eight';
export type RGB = [number, number, number];
export interface Frame { width: number; height: number; data: Uint8ClampedArray }
export interface Recipe { action: string; frames: number; fps: number }
export const PROFILES: Record<Profile, { label: string; directions: Direction[]; actions: Recipe[] }> = {
  game: {
    label: 'Nuestro juego · 4 direcciones', directions: ['ne', 'se', 'sw', 'nw'],
    actions: [{ action: 'idle', frames: 4, fps: 3 }, { action: 'walk', frames: 8, fps: 10 },
      { action: 'work', frames: 4, fps: 8 }, { action: 'talk', frames: 4, fps: 5 },
      { action: 'celebrate', frames: 6, fps: 8 }, { action: 'sit', frames: 1, fps: 1 }]
  },
  'iso-eight': {
    label: 'Iso Cycles · 8 direcciones', directions: ['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n'],
    actions: ['idle', 'walk', 'run', 'attack'].map(action => ({ action, frames: 8, fps: 8 }))
  }
};
export const ACTION_LABELS: Record<string, string> = { idle: 'Reposo', walk: 'Caminar', work: 'Trabajar', talk: 'Conversar', celebrate: 'Celebrar', sit: 'Sentarse', attack: 'Ataque', hurt: 'Daño', run: 'Correr' };
/** Available actions are separate from each profile's legacy default selection. */
export function availableActions(profile: Profile): Recipe[] {
  const defaults = PROFILES[profile].actions;
  const all = [...PROFILES.game.actions, { action: 'attack', frames: 8, fps: 10 }, { action: 'hurt', frames: 3, fps: 6 }, { action: 'run', frames: 8, fps: 12 }];
  return all.map(recipe => defaults.find(r => r.action === recipe.action) ?? recipe);
}
export function selectedActions(settings: Pick<GeneratorSettings, 'profile' | 'actions'>): Recipe[] {
  const names = settings.actions ?? PROFILES[settings.profile].actions.map(r => r.action);
  const available = availableActions(settings.profile);
  return names.flatMap(name => available.find(recipe => recipe.action === name) ?? []);
}
export const MIRRORS: Partial<Record<Direction, Direction>> = { sw: 'se', nw: 'ne', w: 'e' };
export interface ClipInput {
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
  width: number;
  height: number;
  anchor: [number, number];
  targetHeight: number;
  colors: number;
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
  targetHeight: 60, colors: 28, background: [255, 0, 255], tolerance: 90,
  outline: true, mirror: true, stabilize: false, baseUrl: '/pixelart/characters/mi-personaje'
});
export interface LoopInfo {
  start: number; end: number; indices: number[]; score: number; fps: number;
  sourceFps: number; sourceName: string; scale: number; mirroredFrom?: Direction;
  scaleBias: number; offset: [number, number];
}
export interface Sheet { action: string; image: Frame; frames: number; directions: Direction[]; loops: Partial<Record<Direction, LoopInfo>> }
export interface BuildResult {
  sheets: Sheet[];
  character: {
    image: string; frameWidth: number; frameHeight: number; anchor: [number, number]; directions: Direction[];
    animations: Record<string, { image: string; row: number; frames: number; fps: number; directionFps: Partial<Record<Direction, number>> }>;
  };
  metadata: { version: 1; profile: Profile; settings: GeneratorSettings; palette: RGB[]; loops: Record<string, Sheet['loops']>; warnings: string[] };
}

export interface PixelEditRequest { blob: Blob; name: string; width: number; height: number; frames: number; fps: number }
export interface PixelEditorProvider { edit(request: PixelEditRequest): Promise<Blob | null> }
