import {tileSurfaceColor} from '@isometrico/world';
const colors=new Map<string,Promise<number|undefined>>();
export function mapTileColor(url:string,frame?:[number,number,number,number]){
 const key=JSON.stringify([url,frame]);const cached=colors.get(key);if(cached)return cached;
 const result=(async()=>{const image=new Image();image.src=url;await image.decode();const [x,y,w,h]=frame??[0,0,image.naturalWidth,image.naturalHeight];
  if(x<0||y<0||w<1||h<1||x+w>image.naturalWidth||y+h>image.naturalHeight)throw Error('Recorte del suelo no válido.');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const context=canvas.getContext('2d',{willReadFrequently:true})!;
  context.drawImage(image,x,y,w,h,0,0,w,h);return tileSurfaceColor(context.getImageData(0,0,w,h).data,w,h);
 })();colors.set(key,result);result.catch(()=>colors.delete(key));return result;
}
