import type {Frame} from '../../../packages/character-generator/src/types';
import {validateAdventurePalette,type AdventurePalette} from '$lib/demo/adventure-palette';
import {mapResourceImages,resourceImages,type PaletteResource} from './palette';

export type ColorReplacement={from:string;to:string};
export type SpriteColor={color:string;pixels:number};
const hex=/^#[\da-f]{6}$/i;
const rgb=(color:string)=>parseInt(color.slice(1),16);
const color=(value:number)=>'#'+value.toString(16).padStart(6,'0');
function validateFrame(frame:Frame){
 if(!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||frame.data.length!==frame.width*frame.height*4)throw Error('Imagen no válida para cambiar colores.');
}
export function validateColorReplacements(value:ColorReplacement[],palette?:AdventurePalette):ColorReplacement[]{
 if(!Array.isArray(value)||value.length>256)throw Error('Puedes sustituir hasta 256 colores a la vez.');
 const allowed=palette?new Set(validateAdventurePalette(palette).colors):undefined,seen=new Set<string>();
 return value.map(entry=>{
  if(!entry||!hex.test(entry.from)||!hex.test(entry.to))throw Error('Los colores deben ser códigos HEX de seis cifras.');
  const from=entry.from.toLowerCase(),to=entry.to.toLowerCase();
  if(seen.has(from))throw Error('Cada color de origen debe aparecer una sola vez.');seen.add(from);
  if(allowed&&!allowed.has(to))throw Error('El color de destino debe pertenecer a la paleta de aventura.');
  return {from,to};
 });
}
/** Match the original RGB once: A→B and B→C must never cascade. Alpha stays intact. */
export function replaceFrameColors(frame:Frame,replacements:ColorReplacement[]):Frame {
 validateFrame(frame);const map=new Map(validateColorReplacements(replacements).map(r=>[rgb(r.from),rgb(r.to)])),data=new Uint8ClampedArray(frame.data);
 for(let i=0;i<data.length;i+=4){
  if(!data[i+3])continue;const to=map.get((data[i]<<16)|(data[i+1]<<8)|data[i+2]);if(to===undefined)continue;
  data[i]=to>>>16;data[i+1]=(to>>>8)&255;data[i+2]=to&255;
 }
 return {width:frame.width,height:frame.height,data};
}
/** Count colors across unique sheets, ignoring fully transparent pixels. */
export function collectSpriteColors(frames:Iterable<Frame>):SpriteColor[]{
 const counts=new Map<number,number>();
 for(const frame of frames){validateFrame(frame);for(let i=0;i<frame.data.length;i+=4){
  if(!frame.data[i+3])continue;const value=(frame.data[i]<<16)|(frame.data[i+1]<<8)|frame.data[i+2];counts.set(value,(counts.get(value)??0)+1);
  if(counts.size>65536)throw Error('El recurso tiene demasiados colores. Adáptalo primero a la paleta desde Piskel.');
 }}
 return [...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).map(([value,pixels])=>({color:color(value),pixels}));
}
/** Reuse one result for shared atlases; preserve all geometry and animation metadata. */
export function colorVariantResource(resource:PaletteResource,replacements:Record<string,string>):PaletteResource {
 for(const source of resourceImages(resource))if(!replacements[source])throw Error('Falta una hoja de la variante de color.');
 return mapResourceImages(resource,source=>source?replacements[source]:source);
}
