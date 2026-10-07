import {actorPoses,characterImage,characterFps,type CharacterPack,type ActorPose,type Facing,type ObjectSprite} from '@isometrico/world';
import type {Frame} from '../../../packages/character-generator/src/types';
import {pngSize} from '$lib/storage/adventure-package';

export const editorChannel = 'isometrico-piskel-v1';
export const editorRevision = 'palette-4';
export type ImageEditSession = {blob:Blob;name:string;width:number;height:number;frames?:number;fps?:number};
export type CycleSelection={action:string;direction?:string};
export type CycleNavigation=CycleSelection&{name:string;actions:Array<{value:string;label:string}>;directions:Array<{value:string;label:string}>};
export function cycleActions(kind:'player'|'npc',character:CharacterPack,item:ObjectSprite):ActorPose[]{
 return kind==='player'?actorPoses.filter(p=>!!characterImage(character,p)):(['idle','talk'] as const).filter(p=>!!item.animations?.[p]?.image);
}
export function cycleDirections(kind:'player'|'npc',character:CharacterPack,item:ObjectSprite,action:ActorPose):Facing[]{
 return [...(kind==='player'?character.directions:item.animations?.[action as 'idle'|'talk']?.directions??[])];
}
export function validateCycleSelection(kind:'player'|'npc',character:CharacterPack,item:ObjectSprite,selection:CycleSelection):{action:ActorPose;direction?:Facing}{
 const action=cycleActions(kind,character,item).find(a=>a===selection.action);if(!action)throw Error('Esta acción no tiene una animación disponible.');
 const directions=cycleDirections(kind,character,item,action);
 if(selection.direction!==undefined&&directions.length&&!directions.includes(selection.direction as Facing))throw Error('Dirección de animación no válida.');
 return {action,direction:directions.length?(selection.direction as Facing|undefined)??(directions.includes('se')?'se':directions[0]):undefined};
}
export type EditorPalette={name:string;colors:string[]};
export type ImageEditOptions={palette?:EditorPalette;pixels?:Frame};
export function validateEditorPixels(value:unknown,size:{width:number;height:number}):Frame {
 if(!(value instanceof Uint8ClampedArray)||value.length!==size.width*size.height*4)throw Error('Los píxeles del editor no tienen el tamaño esperado.');
 return {width:size.width,height:size.height,data:new Uint8ClampedArray(value)};
}
export function validateEditorPalette(value:unknown):EditorPalette {
 const p=value as EditorPalette;
 if(!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Array.isArray(p.colors)||p.colors.length<1||p.colors.length>256||p.colors.some(c=>typeof c!=='string'||!/^#[\da-f]{6}$/i.test(c))||new Set(p.colors.map(c=>c.toLowerCase())).size!==p.colors.length)throw Error('Elige una paleta con nombre y entre 1 y 256 colores HEX distintos.');
 return {name:p.name.trim(),colors:p.colors.map(c=>c.toLowerCase())};
}
export type AnimationSheetClip={image:string;frameWidth:number;frameHeight:number;row:number;frames:number;fps:number};
/** Edit the actual direction row, including legacy atlases shared by several actions. */
export function playerEditClip(character:CharacterPack,pose:ActorPose,direction:number):AnimationSheetClip {
 if(!Number.isInteger(direction)||direction<0||direction>=character.directions.length)throw Error('Dirección de animación no válida.');
 const clip=character.animations[pose];
 return {image:characterImage(character,pose),frameWidth:character.frameWidth,frameHeight:character.frameHeight,row:clip.row+direction,frames:clip.frames,fps:characterFps(character,pose,character.directions[direction])};
}
function animationRegion(image:Frame,clip:AnimationSheetClip){
 const {frameWidth,frameHeight,frames,row}=clip,width=frameWidth*frames,y=row*frameHeight;
 if(![image.width,image.height,frameWidth,frameHeight,frames,row].every(Number.isInteger)||frameWidth<1||frameHeight<1||frames<1||frames>64||row<0||width>image.width||y+frameHeight>image.height||image.data.length!==image.width*image.height*4)throw Error('La hoja no contiene esa animación. Revisa las celdas, la fila y los fotogramas.');
 return {width,height:frameHeight,y};
}
export function extractAnimationStrip(image:Frame,clip:AnimationSheetClip):Frame {
 const {width,height,y}=animationRegion(image,clip),data=new Uint8ClampedArray(width*height*4);
 for(let row=0;row<height;row++){const start=((y+row)*image.width)*4;data.set(image.data.subarray(start,start+width*4),row*width*4);}
 return {width,height,data};
}
/** Replace only the selected cycle, retaining every other direction/action and spare column. */
export function replaceAnimationStrip(image:Frame,clip:AnimationSheetClip,edited:Frame):Frame {
 const {width,height,y}=animationRegion(image,clip);
 if(edited.width!==width||edited.height!==height||edited.data.length!==width*height*4)throw Error('El retoque debe conservar los fotogramas y el tamaño del ciclo.');
 const data=new Uint8ClampedArray(image.data);
 for(let row=0;row<height;row++)data.set(edited.data.subarray(row*width*4,(row+1)*width*4),((y+row)*image.width)*4);
 return {...image,data};
}

export function validateEditorLoaded(data:{frames?:unknown;width?:unknown;height?:unknown}, expected:ImageEditSession) {
 const frames=expected.frames ?? 1;
 if(data.frames!==frames || data.width!==expected.width/frames || data.height!==expected.height) {
  throw new Error('Piskel no ha separado correctamente los fotogramas. Cierra el editor y vuelve a abrirlo con la versión actual del taller.');
 }
}

export async function validateEditedImage(blob:Blob, expected:{width:number;height:number}) {
 if (!(blob instanceof Blob) || blob.size > 10_000_000) throw new Error('El PNG editado no puede superar 10 MB.');
 const size = pngSize(new Uint8Array(await blob.arrayBuffer()));
 if (size.width !== expected.width || size.height !== expected.height) throw new Error('El retoque debe conservar el tamaño de la imagen original.');
 return size;
}

/** Only the source changes: crop, world dimensions, pivot and NPC clips stay intact. */
export function withEditedImage(item:ObjectSprite, image:string):ObjectSprite {
 return {...item, originalImage:item.originalImage ?? item.image, image};
}
