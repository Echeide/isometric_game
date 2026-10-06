import type {CharacterPack,ObjectSprite,PixelArtPack} from '@isometrico/world';
import type {Frame} from '../../../packages/character-generator/src/types';
import {paletteRGB,validateAdventurePalette,type AdventurePalette} from '$lib/demo/adventure-palette';
import type {ResourceKind} from './resources';
export type PaletteResource={kind:ResourceKind;item:ObjectSprite;character:CharacterPack;tileImage:string};
export function mapResourceImages(resource:PaletteResource,replace:(url:string)=>string):PaletteResource {
 const r:PaletteResource=JSON.parse(JSON.stringify(resource));
 if(r.kind==='tile')r.tileImage=replace(r.tileImage);
 else if(r.kind==='player'){
  r.character.image=replace(r.character.image);
  for(const variants of [r.character.variants,...Object.values(r.character.animations).map(a=>a.variants)])if(variants)for(const key of Object.keys(variants))variants[key]=replace(variants[key]);
  for(const a of Object.values(r.character.animations))if(a.image)a.image=replace(a.image);
 }else{r.item.image=replace(r.item.image);for(const a of Object.values(r.item.animations??{}))a.image=replace(a.image);}
 return r;
}
export function resourceImages(resource:PaletteResource){const urls=new Set<string>();mapResourceImages(resource,u=>{if(u)urls.add(u);return u;});return [...urls];}
export function activePackImages(pack:PixelArtPack){
 const images=new Set<string>(Object.values(pack.tiles));
 const add=(r:PaletteResource)=>resourceImages(r).forEach(u=>images.add(u));
 for(const character of [pack.character,...Object.values(pack.players??{}).map(p=>p.character)])add({kind:'player',character,item:{} as ObjectSprite,tileImage:''});
 for(const item of Object.values(pack.objects))add({kind:'object',item,character:pack.character,tileImage:''});
 // Piskel backups may themselves be adapted sheets; retain their restoration link too.
 for(const item of Object.values(pack.objects))if(item.originalImage)images.add(item.originalImage);
 for(const url of Object.values(pack.tileOriginalImages??{}))if(url)images.add(url);
 return images;
}
/** Drop obsolete adaptation history, but retain originals of graphics still in use. */
export function prunePaletteOriginals(pack:PixelArtPack){
 const active=activePackImages(pack),links=Object.entries(pack.paletteOriginalImages??{}).filter(([url])=>active.has(url));
 if(links.length)pack.paletteOriginalImages=Object.fromEntries(links);else delete pack.paletteOriginalImages;
}
// OKLab distance respects perceived lightness and chroma rather than raw RGB channels.
function lab(rgb:number[]){
 const [r,g,b]=rgb.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
/** No resizing, dithering or frame-by-frame palette extraction: alpha and geometry stay intact. */
export function adaptFrame(frame:Frame,palette:AdventurePalette):Frame {
 if(!Number.isInteger(frame.width)||!Number.isInteger(frame.height)||frame.width<1||frame.height<1||frame.data.length!==frame.width*frame.height*4)throw Error('Imagen no válida para adaptar.');
 const colors=paletteRGB(palette),labs=colors.map(lab),cache=new Map<number,number[]>(),data=new Uint8ClampedArray(frame.data);
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const key=(data[i]<<16)|(data[i+1]<<8)|data[i+2];let color=cache.get(key);
  if(!color){const sample=lab([data[i],data[i+1],data[i+2]]);let best=Infinity,index=0;labs.forEach((p,j)=>{const distance=p.reduce((sum,v,k)=>sum+(v-sample[k])**2,0);if(distance<best){best=distance;index=j;}});color=colors[index];if(cache.size<65536)cache.set(key,color);}
  data.set(color,i);
 }
 return {...frame,data};
}
export function visibleColors(frame:Frame){const colors=new Set<number>();for(let i=0;i<frame.data.length;i+=4)if(frame.data[i+3])colors.add((frame.data[i]<<16)|(frame.data[i+1]<<8)|frame.data[i+2]);return colors;}
export function paletteFromColors(colors:string[],fallback:AdventurePalette):AdventurePalette {
 const unique=[...new Set([...colors,...fallback.colors].map(c=>c.toLowerCase()))].slice(0,64);
 return validateAdventurePalette({version:1,name:'Paleta del recurso',colors:unique});
}
