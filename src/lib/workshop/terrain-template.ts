import type {Frame} from '../../../packages/character-generator/src/types';
import type {AdventurePalette} from '../demo/adventure-palette';
import {defaultAdventurePalette} from '../demo/adventure-palette';
export type TerrainBorderStyle='shade'|'curb';
/** Full 64×32 pieces share the same diamond, texture and palette. No AI or filtering. */
export function terrainTemplate(source:Frame,frame:[number,number,number,number],mask:number,palette:AdventurePalette=defaultAdventurePalette(),variant=0,style:TerrainBorderStyle='shade'):Frame{
 const data=new Uint8ClampedArray(64*32*4),[sx,sy,w,h]=frame;
 const colors=palette.colors.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);
 const nearest=(r:number,g:number,b:number,original:number[])=>colors.filter(c=>c.some((v,i)=>v!==original[i])).reduce((a,c)=>((c[0]-r)**2+(c[1]-g)**2+(c[2]-b)**2)<((a[0]-r)**2+(a[1]-g)**2+(a[2]-b)**2)?c:a);
 const sourcePixel=(x:number,y:number)=>((sy+Math.min(h-1,Math.floor(y*h/32)))*source.width+sx+Math.min(w-1,Math.floor(x*w/64)))*4;
 // Sample the source material once, so the curb's stone blocks stay uniform.
 const average=[0,0,0];let count=0;
 if(style==='curb')for(let y=0;y<32;y++)for(let x=0;x<64;x++){const i=sourcePixel(x,y);if(source.data[i+3]>=128){for(let c=0;c<3;c++)average[c]+=source.data[i+c];count++;}}
 const grey=count?average.reduce((a,c)=>a+c,0)/(count*3):160;
 const stone=(factor:number)=>{const target=[grey*factor,grey*factor,grey*factor*.97];return colors.reduce((a,c)=>c.reduce((d,v,i)=>d+(v-target[i])**2,0)<a.reduce((d,v,i)=>d+(v-target[i])**2,0)?c:a);};
 const curb={top:stone(1.10),light:stone(1.3),face:stone(.76),joint:stone(.57)};
 for(let y=0;y<32;y++)for(let x=0;x<64;x++){
  const nx=(x+.5-32)/32,ny=(y+.5-16)/16,u=(nx+ny+1)/2,v=(ny-nx+1)/2;if(u<0||u>1||v<0||v>1)continue;
  const i=(y*64+x)*4,origin=sourcePixel(x,y);
  data.set(source.data.subarray(origin,origin+4),i);if(data[i+3]<128)continue;
  if(style==='curb'&&mask){
   // Distances use ground coordinates, so opposite edges join across tiles.
   const sides=[{bit:1,d:v,along:u},{bit:2,d:1-u,along:v},{bit:4,d:1-v,along:u},{bit:8,d:u,along:v}].filter(s=>mask&s.bit).sort((a,b)=>a.d-b.d),side=sides[0];
   if(side.d<.17){
    const joint=Math.abs(side.along*4-Math.round(side.along*4))<.065;
    const c=side.d>=.135?curb.face:joint?curb.joint:side.d<.035?(side.bit&6?curb.face:curb.top):side.d<.065?curb.light:curb.top;
    data.set(c,i);continue;
   }
  }
  const edge=!!((mask&1&&v<.10)||(mask&2&&u>.90)||(mask&4&&v>.90)||(mask&8&&u<.10));
  const speck=variant>0&&u>.16&&u<.84&&v>.16&&v<.84&&((Math.imul(x+variant*13,73856093)^Math.imul(y+variant*7,19349663))>>>0)%59<3;
  if(edge||speck){const factor=edge?.65:variant===1?.87:1.12;const c=nearest(data[i]*factor,data[i+1]*factor,data[i+2]*factor,Array.from(data.slice(i,i+3)));data.set(c,i);}
 }
 return {width:64,height:32,data};
}
