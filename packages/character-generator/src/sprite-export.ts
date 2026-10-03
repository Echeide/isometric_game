import { PROFILES, selectedActions, type BuildResult } from './types';

/** Engine-neutral atlas, with pixel rectangles and explicit playback for every view. */
export function spriteManifest(result: BuildResult) {
  const settings = result.metadata.settings, directions = PROFILES[settings.profile].directions;
  if (result.character.directions.join(',') !== directions.join(',') ||
      selectedActions(settings).some(a => !result.sheets.some(s => s.action === a.action))) {
    throw new Error('Construye todas las acciones y orientaciones antes de exportar.');
  }
  return {
    format: 'character-sprites' as const, version: 1, id: settings.id, profile: settings.profile,
    projection: settings.profile === 'platformer' ? 'side' : 'isometric',
    coordinates: 'pixels-from-top-left', frameWidth: settings.width, frameHeight: settings.height,
    anchor: [...settings.anchor], directions: [...directions],
    animations: Object.fromEntries(result.sheets.map(sheet => [sheet.action, {
      image: `${sheet.action}.png`, width: sheet.image.width, height: sheet.image.height,
      playback: sheet.playback ?? 'loop', loop: sheet.playback !== 'once',
      views: Object.fromEntries(sheet.directions.map((direction,row) => [direction, {
        row, fps: sheet.loops[direction]!.fps,
        frames: Array.from({length:sheet.frames},(_,i)=>({x:i*settings.width,y:row*settings.height,width:settings.width,height:settings.height}))
      }]))
    }]))
  };
}
