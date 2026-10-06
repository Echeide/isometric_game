import {zlibSync,strToU8} from 'fflate';
import {pngSize} from '$lib/storage/adventure-package';
import type {Frame} from '../../../packages/character-generator/src/types';
import {adaptFrame} from './palette';
import type {AdventurePalette} from '$lib/demo/adventure-palette';
export async function decodePaletteImage(blob:Blob):Promise<Frame>{
 if(blob.size>10_000_000)throw Error('El PNG no puede superar 10 MB.');
 pngSize(new Uint8Array(await blob.arrayBuffer()));
 const bitmap=await createImageBitmap(blob);
 try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('No se pudo leer la imagen.');ctx.drawImage(bitmap,0,0);return {width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};}finally{bitmap.close();}
}
/** Encode straight RGBA to avoid canvas rounding palette colors on translucent edges. */
export function encodePalettePNG(frame:Frame):Uint8Array {
 const chunk=(type:string,data:Uint8Array)=>{
  const result=new Uint8Array(data.length+12),view=new DataView(result.buffer);view.setUint32(0,data.length);result.set(strToU8(type),4);result.set(data,8);
  let crc=0xffffffff;for(const byte of result.subarray(4,data.length+8)){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}view.setUint32(data.length+8,(crc^0xffffffff)>>>0);return result;
 };
 const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,frame.width);view.setUint32(4,frame.height);header[8]=8;header[9]=6;
 const stride=frame.width*4,scanlines=new Uint8Array((stride+1)*frame.height);for(let y=0;y<frame.height;y++)scanlines.set(frame.data.subarray(y*stride,(y+1)*stride),y*(stride+1)+1);
 const chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(scanlines)),chunk('IEND',new Uint8Array())],bytes=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
export async function adaptedPNG(frame:Frame,palette:AdventurePalette,signal?:AbortSignal){
 const adapted={...frame,data:new Uint8ClampedArray(frame.data)};
 // Bound color-cache memory and yield between blocks on large source sheets.
 for(let offset=0;offset<frame.data.length;offset+=65536*4){
  signal?.throwIfAborted();const data=frame.data.subarray(offset,Math.min(offset+65536*4,frame.data.length));
  adapted.data.set(adaptFrame({width:data.length/4,height:1,data},palette).data,offset);
  await new Promise<void>(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
 }
 signal?.throwIfAborted();return {frame:adapted,blob:new Blob([new Uint8Array(encodePalettePNG(adapted))],{type:'image/png'})};
}
