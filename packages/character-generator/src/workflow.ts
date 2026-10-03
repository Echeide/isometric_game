import { selectedActions, MIRRORS, PROFILES, type Direction, type GeneratorSettings, type Sources } from './types';
import type { ArtProject } from './generation';
export type WorkflowTask = { action: string; direction: Direction; step: 'reference' | 'import' | 'review' };
export function workflowTasks(settings: GeneratorSettings, sources: Sources, art: ArtProject, withAI: boolean): WorkflowTask[] {
  const profile = PROFILES[settings.profile];
  const order: Direction[] = ['se', 'ne', 'sw', 'nw', 'e', 'w', 's', 'n'];
  return selectedActions(settings).flatMap(({ action }) => order.filter(d => profile.directions.includes(d)).flatMap<WorkflowTask>(direction => {
    const clip = sources[action]?.[direction];
    if (clip?.reviewed) return [];
    if (clip) return [{ action, direction, step: 'review' as const }];
    if (settings.mirror && MIRRORS[direction]) return [];
    return [{ action, direction, step: withAI && !art.references[direction] ? 'reference' as const : 'import' as const }];
  }));
}
