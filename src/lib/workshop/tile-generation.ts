import {validateAdventurePalette,type AdventurePalette} from '$lib/demo/adventure-palette';
import {pngData} from '../../../packages/character-generator/src/generation';
import {quantizeSprite} from '../../../packages/character-generator/src/pipeline';
import type {Frame} from '../../../packages/character-generator/src/types';
import {adaptFrame} from './palette';

export interface TileImageRequest {description:string;style:string;quality:'low'|'medium'|'high';reference?:string;palette?:AdventurePalette}
export function validateTileImageRequest(value:unknown):TileImageRequest {
 const r=value as TileImageRequest;
 if(!r||typeof r.description!=='string'||!r.description.trim()||r.description.length>2000||typeof r.style!=='string'||!r.style.trim()||r.style.length>1000)throw Error('Escribe una descripción y un estilo válidos.');
 if(!['low','medium','high'].includes(r.quality))throw Error('Calidad no válida.');
 if(r.reference!==undefined)pngData(r.reference);
 if(r.palette!==undefined)validateAdventurePalette(r.palette);
 return r;
}
export function tileImagePlan(r:TileImageRequest){
 return {size:'1024x1024' as const,columns:1,rows:1,frames:1,prompt:`Create ONE seamless square ground material texture for a pixel-art game. Material: ${r.description.trim()}. Style: ${r.style.trim()}.
Strict top-down orthographic view of a FLAT surface. Fill the entire square edge to edge with opaque material. Opposite edges must tile seamlessly in both axes. Uniform lighting, no directional cast shadows, no vignette. No objects, characters, buildings, labels, text, grid, border, margin, transparent background or chroma background. Do NOT draw an isometric diamond, platform, cube, thickness or perspective: the application will project this texture into a 64 by 32 pixel isometric diamond. Favor readable large color clusters and restrained detail that survives reduction to 32 by 32 texels.
${r.palette?'Use these adventure palette colors as the color direction: '+r.palette.colors.join(', ')+'.':''}
${r.reference?'The supplied image is a material and color reference only. Ignore its outline, transparency, camera angle and surrounding scenery; produce a full square surface texture.':''}`};
}

/** Reduce the material in ground coordinates, then project it into the exact map diamond. */
export function processTileFrame(frame:Frame,options:{colors:number;palette?:AdventurePalette}):Frame {
 if(![frame.width,frame.height].every(n=>Number.isInteger(n)&&n>=8&&n<=4096)||frame.width*frame.height>8_388_608||frame.data.length!==frame.width*frame.height*4)throw Error('Textura de suelo no válida.');
 if(!Number.isInteger(options.colors)||options.colors<4||options.colors>64)throw Error('Elige entre 4 y 64 colores.');
 const side=Math.min(frame.width,frame.height),left=Math.floor((frame.width-side)/2),top=Math.floor((frame.height-side)/2),texture=new Uint8ClampedArray(32*32*4);
 for(let v=0;v<32;v++)for(let u=0;u<32;u++){
  const x0=left+u*side/32,x1=left+(u+1)*side/32,y0=top+v*side/32,y1=top+(v+1)*side/32;
  const sum=[0,0,0];let weight=0,area=0;
  for(let y=Math.floor(y0);y<Math.ceil(y1);y++)for(let x=Math.floor(x0);x<Math.ceil(x1);x++){
   const coverage=(Math.min(x+1,x1)-Math.max(x,x0))*(Math.min(y+1,y1)-Math.max(y,y0)),i=(y*frame.width+x)*4,a=coverage*frame.data[i+3]/255;
   area+=coverage;weight+=a;for(let c=0;c<3;c++)sum[c]+=frame.data[i+c]*a;
  }
  if(weight<area*.95)throw Error('La textura debe cubrir todo el cuadrado sin transparencia.');
  texture.set([...sum.map(n=>Math.round(n/weight)),255],(v*32+u)*4);
 }
 const result:Frame={width:64,height:32,data:new Uint8ClampedArray(64*32*4)};
 for(let y=0;y<32;y++)for(let x=0;x<64;x++){
  if(Math.abs(2*x+1-64)+2*Math.abs(2*y+1-32)>64)continue;
  const nx=(x+.5-32)/32,ny=(y+.5-16)/16,u=Math.min(31,Math.max(0,Math.floor((nx+ny+1)*16))),v=Math.min(31,Math.max(0,Math.floor((ny-nx+1)*16)));
  result.data.set(texture.subarray((v*32+u)*4,(v*32+u)*4+4),(y*64+x)*4);
 }
 return options.palette?adaptFrame(result,options.palette):quantizeSprite(result,options.colors);
}
