import { selectedActions, MIRRORS, PROFILES, type Direction, type Profile, type GeneratorSettings, type Recipe } from './types';

export interface CharacterBrief { description: string; style: string; props: string; notes: Partial<Record<Direction, string>> }
export const angles: Record<Direction, string> = {
  se: 'Face diagonally toward the lower-right of the screen, toward the viewer. FRONT three-quarter view: show the face, chest and front of the costume. Do not show a rear view.',
  ne: 'Face diagonally toward the upper-right of the screen, away from the viewer. REAR three-quarter view: show the back of the head, back of the torso and rear of the costume. The chest and front of the face must not be visible. Do not turn the head back toward the viewer.',
  sw: 'Face diagonally toward the lower-left of the screen, toward the viewer. FRONT three-quarter view: show the face, chest and front of the costume.',
  nw: 'Face diagonally toward the upper-left of the screen, away from the viewer. REAR three-quarter view: show the back of the head and torso. Hide the chest and front of the face; do not look over the shoulder.',
  e: 'Maintain a strict right-facing profile throughout. Keep the torso edge-on to the camera.',
  w: 'Maintain a strict left-facing profile throughout. Keep the torso edge-on to the camera.',
  s: 'Look directly toward the viewer. Center the face and torso, with equal visibility of both shoulders.',
  n: 'Look directly away from the viewer. Center the spine; show equal amounts of both shoulders and arms.'
};
export const motions: Record<string, string> = {
  idle: 'Subtle breathing in a relaxed standing pose. Keep the feet planted.',
  walk: 'Walk steadily in place on a treadmill, with natural alternating full strides and opposing arm swings.',
  run: 'Run on the spot with distinct push-off, airborne and landing phases.',
  work: 'Seated typing gestures with small alternating hand movements. Do not draw furniture; preserve the seated hip height.',
  talk: 'A standing conversational gesture, moving hands naturally and returning to the initial pose.',
  celebrate: 'A brief joyful celebration, raising both arms and returning to the initial standing pose.',
  sit: 'One still seated pose, hands at rest. No furniture. Preserve the seated hip height.',
  hurt: 'React to one hit: initial standing pose, brief recoil with a readable impact pose, then recovery. Keep the same facing. No attacker, gore or scene changes.',
  jump: 'One jump: take-off, ascent and airborne apex. Preserve vertical displacement relative to a fixed ground baseline. Do not add a landing or return to standing.',
  fall: 'One descending airborne phase. Preserve vertical displacement with a fixed camera. Do not return upward or to a standing pose.',
  die: 'One non-graphic defeat: lose balance, collapse, and remain in the final fallen pose. Do not stand up again.',
  attack: 'One complete attack in the facing direction, followed by recovery to the starting pose.'
};
export function playbackPrompt(recipe: Recipe) {
  return recipe.playback === 'once'
    ? 'Play this action once in chronological order, include its final pose and hold it. Do not loop or restart the action after its final pose.'
    : 'Return smoothly to the exact starting pose. If supported, use the same reference as the first and final image.';
}
export function createPrompts(brief: CharacterBrief, profile: Profile, mirror = true, actions?: string[], output: 'auto' | 'video' = 'auto', actionOptions?: GeneratorSettings['actionOptions']) {
  const directions = PROFILES[profile].directions.filter(d => !mirror || !MIRRORS[d]);
  const identity = `${brief.description.trim()} Style: ${brief.style.trim()}. Equipment: ${brief.props.trim() || 'none'}.`;
  return directions.map(direction => ({
    direction,
    still: `${identity} Create a single full-body character pose using the approved character reference to preserve identity, costume, proportions and equipment. ${PROFILES[profile].camera} ${angles[direction]} ${brief.notes[direction] || ''} Solid uniform magenta (#ff00ff) background, no floor, shadow or scenery. Leave clear padding around every limb and accessory.`,
    clips: selectedActions({ profile, actions, actionOptions }).map(recipe => { const {action,frames}=recipe; return ({
      action,
      prompt: frames <= 4 && output !== 'video'
        ? `${identity} Use the approved character reference to create ${frames === 1 ? 'exactly one full-body still pose' : `exactly ${frames} full-body poses in equal-width cells in one horizontal row, ordered in time from left to right`}. ACTION: ${action}. ${motions[action]} ${angles[direction]} ${brief.notes[direction] || ''} ${PROFILES[profile].camera} Consistent scale and alignment. ${playbackPrompt(recipe)} Uniform magenta (#ff00ff) background. No furniture, floor, shadows, labels or borders. Leave padding around every limb.`
        : `${identity} Animate the approved ${direction.toUpperCase()} reference pose. ${motions[action]} ${angles[direction]} ${brief.notes[direction] || ''} ${PROFILES[profile].camera} Keep the character at constant scale and horizontally centered, with a fixed camera and uniform magenta background. ${recipe.preserveMotion ? "Preserve vertical movement and a fixed ground baseline; leave space for the entire motion." : "Keep the same framing throughout."} ${['walk', 'run'].includes(action) && ['s', 'n'].includes(direction) ? `Travel is along the camera axis ${direction === 'n' ? 'away from' : 'toward'} the viewer, while staying in place. Show the foot lifting and landing in that depth direction, never side-stepping.` : ''} ${action === 'attack' ? 'The weapon and target must align with this facing, including front and rear attacks.' : ''} ${playbackPrompt(recipe)}`,
      negative: 'camera movement, rotation, changing costume, duplicate limbs, changing weapon hand, cropped feet, environment, text, cast shadow, tinted background, bloom around the silhouette',
      suggestedSeconds: frames <= 4 && output !== 'video' ? 0 : 5
    }); })
  }));
}
