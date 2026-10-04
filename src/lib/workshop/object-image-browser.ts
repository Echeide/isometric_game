import {encodePNG} from '../../../packages/character-generator/src/browser';
import {pngData,pngUrl} from '../../../packages/character-generator/src/generation';
import {processObjectFrame} from './object-generation';
export async function objectReference(blob:Blob,frame?:number[]):Promise<string> {
 const bitmap=await createImageBitmap(blob);
 try {
  if(bitmap.width*bitmap.height>32_000_000)throw new Error('La referencia no puede superar 32 megapíxeles.');
  const [x,y,w,h]=frame??[0,0,bitmap.width,bitmap.height];
  if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>bitmap.width||y+h>bitmap.height)throw new Error('Recorte de referencia no válido.');
  const scale=Math.min(1,768/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  canvas.getContext('2d')!.drawImage(bitmap,x,y,w,h,0,0,canvas.width,canvas.height);
  const image=canvas.toDataURL('image/png');pngData(image);return image;
 }finally{bitmap.close();}
}
export async function finishObjectImage(image:string,width:number,height:number,options:Parameters<typeof processObjectFrame>[3]) {
 const original=new Blob([new Uint8Array(pngData(image,20_000_000))],{type:'image/png'}),bitmap=await createImageBitmap(original);
 try {
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(bitmap,0,0);
  const frame=processObjectFrame({width:bitmap.width,height:bitmap.height,data:context.getImageData(0,0,bitmap.width,bitmap.height).data},width,height,options);
  const bytes=await encodePNG(frame);
  return {blob:new Blob([new Uint8Array(bytes)],{type:'image/png'}),original,width,height,image:pngUrl(bytes)};
 }finally{bitmap.close();}
}
export type PreparedObjectImage=Awaited<ReturnType<typeof finishObjectImage>>;
