import {pngData} from '../../../packages/character-generator/src/generation';
import {bounds,normalizeOriginal,removeBackground,quantizeSprite} from '../../../packages/character-generator/src/pipeline';
import {defaultSettings,type Frame} from '../../../packages/character-generator/src/types';
export const objectDirections={se:'SE: front and right side visible',sw:'SW: front and left side visible',ne:'NE: back and right side visible',nw:'NW: back and left side visible'};
export interface ObjectImageRequest {description:string;style:string;direction:keyof typeof objectDirections;width:number;height:number;footprint:{x:number;y:number};quality:'low'|'medium'|'high';reference?:string}
export function validateObjectImageRequest(value:unknown):ObjectImageRequest {
 const r=value as ObjectImageRequest;
 if(!r || typeof r.description!=='string'||!r.description.trim()||r.description.length>2000 || typeof r.style!=='string'||!r.style.trim()||r.style.length>1000)throw new Error('Escribe una descripción y un estilo válidos.');
 if(!Object.hasOwn(objectDirections,r.direction)||!['low','medium','high'].includes(r.quality))throw new Error('Orientación o calidad no válida.');
 if(![r.width,r.height].every(n=>Number.isInteger(n)&&n>=8&&n<=512))throw new Error('El dibujo debe medir entre 8 y 512 píxeles por lado.');
 if(!r.footprint || ![r.footprint.x,r.footprint.y].every(n=>Number.isInteger(n)&&n>=1&&n<=16))throw new Error('La huella debe ocupar entre 1 y 16 casillas por lado.');
 if(r.reference!==undefined)pngData(r.reference);
 return r;
}
export function objectImagePlan(r:ObjectImageRequest) {
 return {size: r.width>r.height*1.25 ? '1536x1024' as const : r.height>r.width*1.25 ? '1024x1536' as const : '1024x1024' as const,columns:1,rows:1,frames:1,
 prompt:`Create ONE isolated game prop, fully visible with margin on every side. Object: ${r.description.trim()}. Style: ${r.style.trim()}.
Orthographic isometric game camera, 2:1 ground axes, no perspective convergence. Orientation: ${objectDirections[r.direction]}. Ground footprint: ${r.footprint.x} by ${r.footprint.y} game tiles. The final sprite canvas will be ${r.width} by ${r.height} pixels; prioritize a readable silhouette and large color clusters that survive that reduction. Do not draw the grid or a base platform unless part of the described object.
One object, no characters, no text, no labels, no scene, no sprite sheet. Consistent light from upper left. Solid flat pure magenta #FF00FF background; no magenta on the object, no cast shadow on the background, no gradients on the background.
${r.reference?'The supplied image is a reference for material, palette and visual style. Follow the requested object and orientation; do not copy unrelated scenery or extra objects.':''}`};
}
export function processObjectFrame(frame:Frame,width:number,height:number,options:{background:'magenta'|'green'|'alpha';tolerance:number;colors:number}) {
 if(![width,height].every(n=>Number.isInteger(n)&&n>=8&&n<=512)||!Number.isFinite(options.tolerance)||options.tolerance<0||options.tolerance>255)throw new Error('Dimensiones o tolerancia no válidas.');
 const keyed=removeBackground(frame,options.background==='alpha'?null:options.background==='green'?[0,255,0]:[255,0,255],options.tolerance);
 const box=bounds(keyed);if(!box)throw new Error('El fondo eliminado no deja un objeto visible.');
 const scale=Math.min((width-4)/(box.right-box.left+1),(height-4)/box.height);
 const normalized=normalizeOriginal(keyed,{...defaultSettings(),width,height,anchor:[width/2,height-2],resampling:'area'}, {scale,footX:box.center,footY:box.bottom+1,sampleWidth:frame.width,sampleHeight:frame.height}).frame;
 return quantizeSprite(normalized,options.colors);
}
