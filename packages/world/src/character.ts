import type { ActorPose, Facing } from './types';
export interface CharacterClip {image?:string;variants?:Record<string,string>;row:number;frames:number;fps:number}
export interface CharacterPack {image:string;variants?:Record<string,string>;frameWidth:number;frameHeight:number;anchor:[number,number];scale?:number;directions:Facing[];animations:Record<ActorPose,CharacterClip>}
export const actorPoses:ActorPose[]=['idle','walk','sit','work','talk','celebrate'];
/** Individual action sheets take precedence over the legacy shared atlas. */
export function characterImage(character:CharacterPack,pose:ActorPose,variant='default') {
 const clip=character.animations[pose];
 return clip.variants?.[variant]??clip.image??character.variants?.[variant]??character.image;
}
export function characterVariants(character:CharacterPack) {
 return ['default',...new Set([...Object.keys(character.variants??{}),...Object.values(character.animations).flatMap(clip=>Object.keys(clip.variants??{}))])];
}
