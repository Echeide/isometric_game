import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import type {ObjectSprite,CharacterPack,VisualAsset,PixelArtPack,TileKind} from '@isometrico/world';
import {validateCharacterGraphics,validateObjectGraphics} from '../../../packages/world/src/graphics-validation';
import {pngSize} from '../storage/adventure-package';
import {characterImage} from '../../../packages/world/src/character';
import type {ResourceKind} from './resources';
export const RESOURCE_MAX=60_000_000;
export interface SharedResource {format:'isometric-resource';version:1;kind:ResourceKind;name:string;category:VisualAsset['category'];size:{x:number;y:number};object?:ObjectSprite;character?:CharacterPack;tile?:{image:string;originalImage?:string;frame:[number,number,number,number]}}
export interface SharedSummary {id:string;version:1;name:string;kind:ResourceKind;category:string;createdAt:string;image:string;frame?:[number,number,number,number]}
export function mapResourceImages(value:SharedResource,replace:(url:string)=>string):SharedResource{
 const r:SharedResource=JSON.parse(JSON.stringify(value));
 if(r.object){const o=r.object;o.image=replace(o.image);if(o.originalImage)o.originalImage=replace(o.originalImage);if(o.generationImage)o.generationImage=replace(o.generationImage);for(const c of Object.values(o.animations??{}))c.image=replace(c.image);}
 if(r.character){const c=r.character;c.image=replace(c.image);for(const v of [c.variants,...Object.values(c.animations).map(a=>a.variants)])if(v)for(const k of Object.keys(v))v[k]=replace(v[k]);for(const a of Object.values(c.animations))if(a.image)a.image=replace(a.image);}
 if(r.tile){r.tile.image=replace(r.tile.image);if(r.tile.originalImage)r.tile.originalImage=replace(r.tile.originalImage);}
 return r;
}
export function resourceImages(r:SharedResource){const urls=new Set<string>();mapResourceImages(r,url=>{urls.add(url);return url;});return [...urls];}
export function resourcePreview(r:SharedResource){if(r.character){const c=r.character;return {image:characterImage(c,'idle'),frame:[0,(c.animations.idle.row+1)*c.frameHeight,c.frameWidth,c.frameHeight] as [number,number,number,number]};}return r.tile??{image:r.object!.image,frame:r.object!.frame};}
export function validateResource(value:unknown,files:Record<string,Uint8Array>):SharedResource{
 const r=value as SharedResource,fail=()=>{throw Error('Recurso de biblioteca no válido.');};
 if(!r||r.format!=='isometric-resource'||r.version!==1||!['object','npc','player','tile'].includes(r.kind)||typeof r.name!=='string'||!r.name.trim()||r.name.length>120||!['office','nature','urban','people'].includes(r.category)||!r.size||![r.size.x,r.size.y].every(n=>Number.isInteger(n)&&n>=1&&n<=16))fail();
 if([r.object,r.character,r.tile].filter(Boolean).length!==1||(r.kind==='player'?!r.character:r.kind==='tile'?!r.tile:!r.object))fail();
 const sizes=new Map<string,ReturnType<typeof pngSize>>();
 for(const url of resourceImages(r)){if(typeof url!=='string'||!/^assets\/[0-9]+\.png$/.test(url)||!Object.hasOwn(files,url))fail();sizes.set(url,pngSize(files[url]));}
 if(r.character)validateCharacterGraphics(r.character,sizes);
 if(r.object)validateObjectGraphics(r.object,sizes);
 if(r.tile)validateObjectGraphics({...r.tile,width:64,height:32,origin:[32,16]},sizes);
 return r;
}
export function unpackResource(bytes:Uint8Array){
 if(bytes.length>RESOURCE_MAX)throw Error('El recurso supera 60 MB.');let total=0,count=0;
 const files=unzipSync(bytes,{filter:f=>{if(++count>128||(total+=f.originalSize)>RESOURCE_MAX||f.originalSize>20_000_000||!(f.name==='resource.json'||/^assets\/[0-9]+\.png$/.test(f.name)))throw Error('Contenido del recurso no admitido.');return true;}});
 if(!files['resource.json']||files['resource.json'].length>100_000)throw Error('Falta una definición válida del recurso.');
 const resource=validateResource(JSON.parse(strFromU8(files['resource.json'])),files);
 return {resource,files};
}
export async function packResource(resource:SharedResource,read:(url:string)=>Promise<Blob>){
 const files:Record<string,Uint8Array>={},paths=new Map<string,string>();let total=0;
 for(const [i,url]of resourceImages(resource).entries()){const blob=await read(url);if(blob.size>20_000_000||(total+=blob.size)>RESOURCE_MAX)throw Error('El recurso supera 60 MB.');const path=`assets/${i}.png`;files[path]=new Uint8Array(await blob.arrayBuffer());paths.set(url,path);}
 const portable=mapResourceImages(resource,url=>paths.get(url)!);validateResource(portable,files);files['resource.json']=strToU8(JSON.stringify(portable));const bytes=zipSync(files,{level:0,mtime:new Date('2000-01-01T00:00:00Z')});if(bytes.length>RESOURCE_MAX)throw Error('El recurso supera 60 MB.');return bytes;
}
export function instantiateResource(bytes:Uint8Array){
 const {resource,files}=unpackResource(bytes),blobs:Record<string,Blob>={},paths=new Map<string,string>();
 for(const path of resourceImages(resource)){const id=crypto.randomUUID();paths.set(path,`asset:${id}`);blobs[id]=new Blob([new Uint8Array(files[path])],{type:'image/png'});}
 return {resource:mapResourceImages(resource,url=>paths.get(url)!),blobs};
}
/** A fresh visual ID and fresh image IDs prevent edits from touching another adventure. */
export function addSharedResource(pack:PixelArtPack,catalog:VisualAsset[],resource:SharedResource,origin:{id:string;version:number}){
 resource=JSON.parse(JSON.stringify(resource));
 const next:PixelArtPack=JSON.parse(JSON.stringify(pack)),id=`custom.${crypto.randomUUID()}`;
 if(resource.kind==='player')next.players={...next.players,[id]:{name:resource.name,character:resource.character!}};
 else if(resource.kind==='tile'){const key=id as TileKind;next.tiles[key]=resource.tile!.image;next.tileFrames={...next.tileFrames,[key]:resource.tile!.frame};next.tileNames={...next.tileNames,[key]:resource.name};if(resource.tile!.originalImage)next.tileOriginalImages={...next.tileOriginalImages,[key]:resource.tile!.originalImage};}
 else {next.objects[id]=resource.object!;catalog=[...catalog,{id,label:resource.name,kind:resource.kind==='npc'?'person':'object',category:resource.kind==='npc'?'people':resource.category,size:resource.size}];}
 next.resourceOrigins={...next.resourceOrigins,[id]:origin};return {id,pack:next,catalog};
}
