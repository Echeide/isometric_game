import type {Frame} from '../../../packages/character-generator/src/types';
import type {SpriteColor} from './color-variant';

export type ToneGroup='dark'|'mid'|'light';
export type HarmonyOptions={colors:string[];strength:number;scope:'shadows'|'all'};
const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const light=(c:number[])=>.2126*c[0]+.7152*c[1]+.0722*c[2];
const hex=(c:number[])=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('');

/** Actual swatches from the visible crop, excluding neighbouring atlas sprites. */
export function referenceTones(frame:Frame,crop:[number,number,number,number]=[0,0,frame.width,frame.height]):Record<ToneGroup,SpriteColor[]> {
 const [x,y,w,h]=crop;
 if(![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>frame.width||y+h>frame.height||frame.data.length!==frame.width*frame.height*4)throw Error('Recorte de referencia no válido.');
 const counts=new Map<string,number>(),samples=Math.min(w*h,65536);
 for(let n=0;n<samples;n++){
  const p=Math.floor(n*w*h/samples),i=((y+Math.floor(p/w))*frame.width+x+p%w)*4;
  if(frame.data[i+3]<128)continue;
  const c=hex(Array.from(frame.data.subarray(i,i+3)));counts.set(c,(counts.get(c)??0)+1);
 }
 const colors=[...counts].map(([color,pixels])=>({color,pixels})),groups:Record<ToneGroup,SpriteColor[]>={dark:[],mid:[],light:[]};
 if(!colors.length)return groups;
 const levels=colors.map(c=>light(rgb(c.color))),min=Math.min(...levels),max=Math.max(...levels);
 for(const c of colors.sort((a,b)=>b.pixels-a.pixels||a.color.localeCompare(b.color))){
  const level=max===min?.5:(light(rgb(c.color))-min)/(max-min),group=groups[level<1/3?'dark':level>2/3?'light':'mid'];
  if(group.length<8&&!group.some(other=>rgb(other.color).reduce((sum,v,i)=>sum+(v-rgb(c.color)[i])**2,0)<18**2))group.push(c);
 }
 for(const group of Object.values(groups))group.sort((a,b)=>light(rgb(a.color))-light(rgb(b.color)));
 return groups;
}

/** Shared across sheets: preserve luminance, texture, alpha and geometry. */
export function createColorHarmonizer(source:SpriteColor[],options:HarmonyOptions):(r:number,g:number,b:number)=>number[] {
 if(!options.colors.length||options.colors.length>24||options.colors.some(c=>!/^#[\da-f]{6}$/i.test(c))||!Number.isFinite(options.strength)||options.strength<0||options.strength>100||!['shadows','all'].includes(options.scope))throw Error('Elige tonos de referencia y una intensidad entre 0 y 100.');
 const tones=options.colors.map(rgb).sort((a,b)=>light(a)-light(b));
 const levels=source.map(c=>light(rgb(c.color))),min=levels.length?Math.min(...levels):0,max=levels.length?Math.max(...levels):255,cache=new Map<number,number[]>();
 return (r,g,b)=>{
  const key=(r<<16)|(g<<8)|b,cached=cache.get(key);if(cached)return cached;
  const original=[r,g,b],l=light(original),rank=max===min?.5:(l-min)/(max-min);
  const shadow=1-Math.min(1,Math.max(0,(rank-.3)/.35)),amount=options.strength/100*(options.scope==='shadows'?shadow:1);
  const tone=tones[Math.min(tones.length-1,Math.max(0,Math.round(rank*(tones.length-1))))],chroma=tone.map(v=>v-light(tone));
  // Compress chroma uniformly at the gamut boundary instead of clipping contrast.
  let gamut=1;for(const c of chroma)if(c>0)gamut=Math.min(gamut,(255-l)/c);else if(c<0)gamut=Math.min(gamut,-l/c);
  const result=original.map((v,i)=>Math.round(v+(l+chroma[i]*gamut-v)*amount));
  if(cache.size<65536)cache.set(key,result);return result;
 };
}
