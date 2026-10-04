import { MIRRORS, PROFILES, selectedActions, type Direction, type GeneratorSettings, type Sources } from './types';
import type { ArtProject } from './generation';
import { workflowTasks } from './workflow';
export type WizardStep = 1 | 2 | 3 | 4 | 5;
export interface WizardCursor { step: WizardStep; action: string; direction: Direction }
export const WIZARD_STEPS = ['Personaje', 'Vistas', 'Animaciones', 'Revisar', 'Exportar'] as const;
export function animationProgress(settings: GeneratorSettings, sources: Sources) {
  return selectedActions(settings).flatMap(({action}) => PROFILES[settings.profile].directions.map(direction => {
    const own = sources[action]?.[direction];
    const reflected = !own && settings.mirror && MIRRORS[direction] ? sources[action]?.[MIRRORS[direction]!] : undefined;
    const input = own ?? reflected;
    return {action, direction, reflected: !!reflected, status: input?.reviewed ? 'approved' : input ? 'review' : 'missing'};
  }));
}
export function resumeCursor(settings: GeneratorSettings, sources: Sources, art: ArtProject, withAI: boolean, saved?: unknown): WizardCursor {
  const cursor = saved as Partial<WizardCursor> | undefined;
  const actions = selectedActions(settings), profile = PROFILES[settings.profile];
  if(cursor && Number.isInteger(cursor.step) && cursor.step! >= 1 && cursor.step! <= 5 && actions.some(a=>a.action===cursor.action) && profile.directions.includes(cursor.direction!)) return cursor as WizardCursor;
  const next = workflowTasks(settings,sources,art,withAI)[0];
  const hasAssets = Object.values(sources).some(d=>Object.values(d).some(Boolean)) || Object.keys(art.references).length > 0;
  return {step: !hasAssets ? 1 : !next ? 5 : next.step==='reference' ? 2 : next.step==='review' ? 4 : 3, action:next?.action ?? actions[0].action,direction:next?.direction ?? profile.initialDirection};
}
export function invalidateReference(sources: Sources, direction: Direction): Sources {
  return Object.fromEntries(Object.entries(sources).map(([action,views])=>[action,views[direction] ? {...views,[direction]:{...views[direction]!,reviewed:false}} : views]));
}
