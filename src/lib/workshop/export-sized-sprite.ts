import type {Frame} from '../../../packages/character-generator/src/types';
/** Crop the source and sample at its configured world size, without camera zoom. */
export function sizedSprite(source:Frame,crop:readonly number[],width:number,height:number):Frame{
 const [x,y,w,h]=crop;
 if(crop.length!==4||![x,y,w,h].every(Number.isInteger)||x<0||y<0||w<1||h<1||x+w>source.width||y+h>source.height)throw Error('Recorte de imagen no válido.');
 if(![width,height].every(Number.isFinite)||width<1||height<1||width>4096||height>4096)throw Error('Tamaño de exportación no válido.');
 const outWidth=Math.round(width),outHeight=Math.round(height),data=new Uint8ClampedArray(outWidth*outHeight*4);
 for(let py=0;py<outHeight;py++)for(let px=0;px<outWidth;px++){
  const sx=x+Math.min(w-1,Math.floor((px+.5)*w/outWidth)),sy=y+Math.min(h-1,Math.floor((py+.5)*h/outHeight));
  const offset=(sy*source.width+sx)*4;data.set(source.data.subarray(offset,offset+4),(py*outWidth+px)*4);
 }
 return {width:outWidth,height:outHeight,data};
}
