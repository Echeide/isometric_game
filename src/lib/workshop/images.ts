import {pngSize} from '$lib/storage/adventure-package';
export async function readPng(file:Blob){
 if(file.size>10_000_000)throw new Error('El PNG no puede superar 10 MB.');
 const size=pngSize(new Uint8Array(await file.arrayBuffer()));
 const bitmap=await createImageBitmap(file);bitmap.close();return size;
}
export async function visibleCrop(url:string,frame?:number[]):Promise<[number,number,number,number]>{
 const image=new Image();image.src=url;await image.decode();
 const [sx,sy,w,h]=frame??[0,0,image.naturalWidth,image.naturalHeight];
 if(![sx,sy,w,h].every(Number.isInteger)||sx<0||sy<0||w<1||h<1||sx+w>image.naturalWidth||sy+h>image.naturalHeight)throw new Error('El recorte sale de la imagen.');
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,sx,sy,w,h,0,0,w,h);
 const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
 for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>=64){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 if(right<left)throw new Error('La imagen no contiene píxeles visibles.');
 return [sx+left,sy+top,right-left+1,bottom-top+1];
}
