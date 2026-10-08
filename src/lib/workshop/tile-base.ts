import {defaultAdventurePalette,validateAdventurePalette,type AdventurePalette} from '../demo/adventure-palette';
import type {Frame} from '../../../packages/character-generator/src/types';

/** Pixel-centre rasterization of the 2:1 diamond used by the map's 64 × 32 cells. */
export function createTileBase(palette:AdventurePalette=defaultAdventurePalette()):Frame {
 const colors=validateAdventurePalette(palette).colors;
 const rgb=(color:string)=>[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
 const neutral=[146,149,155];
 const distance=(color:string)=>rgb(color).reduce((sum,c,i)=>sum+(c-neutral[i])**2,0);
 const color=colors.reduce((best,c)=>distance(c)<distance(best)?c:best),[r,g,b]=rgb(color);
 const data=new Uint8ClampedArray(64*32*4);
 for(let y=0;y<32;y++)for(let x=0;x<64;x++){
  if(Math.abs(2*x+1-64)+2*Math.abs(2*y+1-32)>64)continue;
  data.set([r,g,b,255],(y*64+x)*4);
 }
 return {width:64,height:32,data};
}
