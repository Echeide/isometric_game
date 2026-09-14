import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {validateSceneTiles,type PixelArtPack} from '@isometrico/world';
import {characterImage,characterVariants} from '../../../packages/world/src/character';
import {parseAdventure,type Adventure} from '$lib/demo/adventure';
import {graphics} from '$lib/demo/pixelart';
import {imageUrls,mapImages,resourceBlob,localAdventures,type AdventureRepository} from './local-adventures';
import {validateGraphics} from '@isometrico/world';
const MAX=100_000_000;
export function pngSize(bytes:Uint8Array){
 if(bytes.length<24||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||strFromU8(bytes.slice(12,16))!=='IHDR')throw new Error('El recurso debe ser una imagen PNG válida.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(16),height=view.getUint32(20);
 if(!width||!height||width>4096||height>4096||width*height>8_388_608)throw new Error('Imagen demasiado grande: máximo 4096 px por lado y 8 megapíxeles.');
 return {width,height};
}
export function validatePack(value:unknown,files:Record<string,Uint8Array>):PixelArtPack{
 const p=value as PixelArtPack,fail=()=>{throw new Error('Catálogo de recursos no válido.');};
 const positive=(v:number)=>Number.isFinite(v)&&v>0&&v<=4096;
 const pair=(v:number[])=>Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=4096);
 if(!p||p.version!==1||!p.character||!p.objects||!p.tiles)fail();
 const c=p.character;
 if(!Number.isInteger(c.frameWidth)||!Number.isInteger(c.frameHeight)||!positive(c.frameWidth)||!positive(c.frameHeight)||!pair(c.anchor)||JSON.stringify(c.directions)!==JSON.stringify(graphics.character.directions)||!c.animations)fail();
 for(const pose of Object.keys(graphics.character.animations) as (keyof typeof c.animations)[]){const a=c.animations[pose];if(!a||!Number.isInteger(a.row)||a.row<0||!Number.isInteger(a.frames)||a.frames<1||a.frames>64||!Number.isFinite(a.fps)||a.fps<=0||a.fps>120)fail();}
 for(const [id,o] of Object.entries(p.objects)){if(!o||!positive(o.width)||!positive(o.height)||!pair(o.origin))fail();if(o.frame&&(!Array.isArray(o.frame)||o.frame.length!==4||!o.frame.every(n=>Number.isInteger(n)&&n>=0)||!o.frame[2]||!o.frame[3]))fail();}
 for(const key of Object.keys(graphics.tiles))if(!(key in p.tiles))fail();
 const sizes=new Map<string,ReturnType<typeof pngSize>>();
 for(const url of imageUrls(p)){if(typeof url!=='string'||!/^assets\/[a-zA-Z0-9_-]+\.png$/.test(url)||!files[url])throw new Error(`Falta un recurso del paquete: ${url}.`);sizes.set(url,pngSize(files[url]));}
 for(const variant of characterVariants(c))for(const pose of Object.keys(c.animations) as (keyof typeof c.animations)[]){const a=c.animations[pose],s=sizes.get(characterImage(c,pose,variant));if(!s||a.frames*c.frameWidth>s.width||(a.row+c.directions.length)*c.frameHeight>s.height)throw new Error(`La animación ${pose} sale de su hoja.`);}
 for(const o of Object.values(p.objects))if(o.frame){const s=sizes.get(o.image)!;if(o.frame[0]+o.frame[2]>s.width||o.frame[1]+o.frame[3]>s.height)fail();}
 validateGraphics(p,sizes);
 return p;
}
export function validateCatalogGraphics(adventure:Adventure,pack:PixelArtPack){
 for(const map of adventure.maps)validateSceneTiles(map,pack.tiles);
 for(const entry of adventure.catalog??[])if(!Object.hasOwn(pack.objects,entry.id))throw new Error(`Falta el objeto ${entry.label}.`);
 for(const map of adventure.maps)for(const entity of map.entities)if((entity.kind!=='person'||entity.visualId?.startsWith('custom.'))&&entity.interaction?.action!=='adventure.exit'&&!Object.hasOwn(pack.objects,entity.visualId??`pixel.${entity.kind}`))throw new Error(`Falta el objeto ${entity.visualId}.`);
}
export async function exportAdventure(adventure:Adventure,repository:Pick<AdventureRepository,'pack'|'blob'>=localAdventures){
 const valid=parseAdventure(adventure),pack=await repository.pack(valid.id),files:Record<string,Uint8Array>={},paths=new Map<string,string>();let total=0;
 validateCatalogGraphics(valid,pack);
 for(const [index,url] of imageUrls(pack).entries()){
  const blob=await resourceBlob(url,repository);if(blob.size>10_000_000||(total+=blob.size)>MAX)throw new Error('Los recursos superan el límite del paquete (100 MB).');
  const path=`assets/${index}.png`,bytes=new Uint8Array(await blob.arrayBuffer());pngSize(bytes);files[path]=bytes;paths.set(url,path);
 }
 const portable=mapImages(pack,url=>paths.get(url)!);validatePack(portable,files);
 files['manifest.json']=strToU8(JSON.stringify({kind:'isometric-adventure-package',version:1,adventure:valid,graphics:portable}));
 if(files['manifest.json'].length>10_000_000)throw new Error('La definición de la aventura supera 10 MB.');
 const zipped=zipSync(files,{level:0});if(zipped.length>MAX)throw new Error('El paquete completo supera 100 MB.');
 return new Blob([zipped as Uint8Array<ArrayBuffer>],{type:'application/zip'});
}
export function unpackAdventure(bytes:Uint8Array){
 if(bytes.length>MAX)throw new Error('El paquete no puede superar 100 MB.');
 let size=0,count=0;
 const files=unzipSync(bytes,{filter:file=>{
  if(++count>512||(size+=file.originalSize)>MAX||file.originalSize>10_000_000)throw new Error('El contenido del paquete supera los límites.');
  if(file.name!=='manifest.json'&&!/^assets\/[a-zA-Z0-9_-]+\.png$/.test(file.name))throw new Error('El paquete contiene una ruta no admitida.');
  return true;
 }});
 if(!files['manifest.json'])throw new Error('Falta manifest.json.');
 const manifest=JSON.parse(strFromU8(files['manifest.json']));
 if(manifest.kind!=='isometric-adventure-package'||manifest.version!==1)throw new Error('Versión de paquete no compatible.');
 const adventure=parseAdventure(manifest.adventure),pack=validatePack(manifest.graphics,files);
 validateCatalogGraphics(adventure,pack);
 for(const map of adventure.maps)for(const entity of map.entities)if(entity.kind!=='person'&&entity.visualId?.startsWith('pixel.')&&!pack.objects[entity.visualId])throw new Error(`Falta el objeto ${entity.visualId}.`);
 const refs=new Map<string,string>(),blobs:Record<string,Blob>={};
 for(const url of imageUrls(pack)){const id=crypto.randomUUID();refs.set(url,`asset:${id}`);blobs[id]=new Blob([files[url] as Uint8Array<ArrayBuffer>],{type:'image/png'});}
 return {adventure,pack:mapImages(pack,url=>refs.get(url)!),blobs};
}
export async function importAdventure(file:File){
 if(file.size>MAX)throw new Error('El paquete no puede superar 100 MB.');
 const content=unpackAdventure(new Uint8Array(await file.arrayBuffer()));
 for(const blob of Object.values(content.blobs)){const bitmap=await createImageBitmap(blob);bitmap.close();}
 const library=await localAdventures.load();
 if(library.adventures.some(a=>a.id===content.adventure.id))content.adventure={...content.adventure,id:crypto.randomUUID(),name:content.adventure.name+' (importada)'};
 await localAdventures.save(content.adventure,content);return content.adventure;
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
