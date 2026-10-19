import {tileSurfaceColor} from '@isometrico/world';
import {resourceBlob,storageScope} from '$lib/storage/local-adventures';
const colors=new Map<string,Promise<number|undefined>>();
export function mapTileColor(url:string,frame?:[number,number,number,number]){
 const key=JSON.stringify([storageScope(),url,frame]);const cached=colors.get(key);if(cached)return cached;
 const result=(async()=>{const image=new Image();let objectUrl:string|undefined;try{image.src=url.startsWith('asset:')?(objectUrl=URL.createObjectURL(await resourceBlob(url))):url;await image.decode();const [x,y,w,h]=frame??[0,0,image.naturalWidth,image.naturalHeight];
  if(x<0||y<0||w<1||h<1||x+w>image.naturalWidth||y+h>image.naturalHeight)throw Error('Recorte del suelo no válido.');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true})!;
  context.drawImage(image,x,y,w,h,0,0,w,h);return tileSurfaceColor(context.getImageData(0,0,w,h).data,w,h);
 }finally{if(objectUrl)URL.revokeObjectURL(objectUrl);}})();colors.set(key,result);result.catch(()=>colors.delete(key));return result;
}
