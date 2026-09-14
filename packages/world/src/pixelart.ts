import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ActorPose, Facing, TileKind } from './types';
import {characterImage,characterVariants,type CharacterPack} from './character';
export interface NpcClip {image:string;frameWidth:number;frameHeight:number;row:number;frames:number;fps:number}
export interface ObjectSprite {image:string;width:number;height:number;origin:[number,number];frame?:[number,number,number,number];animations?:Partial<Record<'idle'|'talk',NpcClip>>}
export interface PixelArtPack {
 version:1;
 character:CharacterPack;
 objects:Record<string,ObjectSprite>;
 tiles:Record<TileKind,string>;
 tileFrames?:Partial<Record<TileKind,[number,number,number,number]>>;
 tileNames?:Partial<Record<TileKind,string>>;
 players?:Record<string,{name:string;character:CharacterPack}>;
 activePlayer?:string;
}
export interface LoadedPixelArt {pack:PixelArtPack;textures:Map<string,Texture>;frames:Map<string,Texture[]>;masks:Map<string,{width:number;height:number;alpha:Uint8Array}>}
const loadedPacks=new WeakMap<PixelArtPack,Promise<LoadedPixelArt>>();
export function loadPixelArt(pack:PixelArtPack):Promise<LoadedPixelArt>{
 const cached=loadedPacks.get(pack);if(cached)return cached;
 const loading=preparePixelArt(pack).catch(error=>{loadedPacks.delete(pack);throw error;});
 loadedPacks.set(pack,loading);return loading;
}
async function preparePixelArt(pack:PixelArtPack):Promise<LoadedPixelArt>{
 if(pack.version!==1)throw new Error('Versión de catálogo gráfico no compatible.');
 const variants=characterVariants(pack.character);
 const urls=[...variants.flatMap(variant=>(Object.keys(pack.character.animations) as ActorPose[]).map(pose=>characterImage(pack.character,pose,variant))),...Object.values(pack.objects).flatMap(a=>[a.image,...Object.values(a.animations??{}).map(c=>c.image)]),...Object.values(pack.tiles),...Object.values(pack.players??{}).flatMap(p=>characterVariants(p.character).flatMap(v=>Object.keys(p.character.animations).map(pose=>characterImage(p.character,pose as ActorPose,v))))];
 const textures=new Map<string,Texture>();
 await Promise.all([...new Set(urls)].map(async url=>{const texture=await Assets.load<Texture>(url.startsWith('blob:')?{src:url,parser:'loadTextures'}:url);texture.source.scaleMode='nearest';textures.set(url,texture);}));
 const masks=new Map<string,{width:number;height:number;alpha:Uint8Array}>();
 for(const url of new Set(Object.values(pack.objects).map(item=>item.image))){
  const texture=textures.get(url)!,width=texture.source.width,height=texture.source.height;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true})!;
  context.drawImage(texture.source.resource as CanvasImageSource,0,0);
  const pixels=context.getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);
  for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
  masks.set(url,{width,height,alpha});
 }
 const frames=new Map<string,Texture[]>();
 for(const [prefix,character] of [['',pack.character],...Object.entries(pack.players??{}).map(([id,p])=>[`player:${id}:`,p.character])] as [string,CharacterPack][]){
 const {frameWidth:w,frameHeight:h}=character;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)throw new Error('Tamaño de fotograma no válido.');
 for(const variant of characterVariants(character)){
  for(const pose of Object.keys(character.animations) as ActorPose[]){
   const clip=character.animations[pose],url=characterImage(character,pose,variant),texture=textures.get(url)!;
   for(const [di,facing]of character.directions.entries()){
    if(!Number.isInteger(clip.row)||clip.row<0||!Number.isInteger(clip.frames)||clip.frames<1||clip.fps<=0||w*clip.frames>texture.width||(clip.row+di+1)*h>texture.height)throw new Error(`Fotogramas fuera de la hoja: ${pose}/${facing}`);
    frames.set(`${prefix}${variant}:${pose}:${facing}`,Array.from({length:clip.frames},(_,i)=>new Texture({source:texture.source,frame:new Rectangle(i*w,(clip.row+di)*h,w,h)})));
   }
  }
 }
 }
 return {pack,textures,frames,masks};
}
export function pixelObject(art:LoadedPixelArt,id:string){
 const item=art.pack.objects[id];if(!item)return null;
 let texture=art.textures.get(item.image)!;
 if(item.frame)texture=new Texture({source:texture.source,frame:new Rectangle(...item.frame)});
 const sprite=new Sprite(texture);sprite.width=item.width;sprite.height=item.height;sprite.position.set(-item.origin[0],-item.origin[1]);sprite.roundPixels=true;
 return sprite;
}
export function pixelActor(art:LoadedPixelArt,color:number,me:boolean){
 const id=me?art.pack.activePlayer:undefined,character=id?art.pack.players![id].character:art.pack.character,prefix=id?`player:${id}:`:'';
 const variant=id?'default':characterVariants(character).includes(color.toString(16))?color.toString(16):'default',scale=character.scale??1;
 const view=new Container(),sprite=new Sprite(art.frames.get(`${prefix}${variant}:idle:se`)![0]);
 sprite.position.set(-character.anchor[0]*scale,-character.anchor[1]*scale);sprite.scale.set(scale);sprite.roundPixels=true;
 const shadow=new Graphics().ellipse(0,1,12,4).fill({color:0x233f39,alpha:.2});view.addChild(shadow,sprite);
 if(me){const top=-character.anchor[1]*scale-6;const mark=new Graphics().poly([-4,top-4,4,top-4,0,top]).fill(0xbbdd6b);view.addChild(mark);}
 let lastPose:ActorPose='idle',elapsed=0;
 function update(_time:number,dt:number,pose:ActorPose,facing:Facing,reduced=false){
  if(pose!==lastPose){elapsed=0;lastPose=pose;}elapsed+=dt;
  const clip=character.animations[pose],frames=art.frames.get(`${prefix}${variant}:${pose}:${facing}`)!;
  const texture=frames[reduced?0:Math.floor(elapsed*clip.fps)%frames.length];
  if(sprite.texture!==texture)sprite.texture=texture;
 }
 return {view,update};
}

export function npcClip(item:ObjectSprite,pose:ActorPose){return pose==='talk'?(item.animations?.talk??item.animations?.idle):item.animations?.idle;}
export function pixelNpc(art:LoadedPixelArt,id:string){
 const item=art.pack.objects[id],view=new Container(),sprite=pixelObject(art,id)!;view.addChild(sprite);
 const still=sprite.texture,clips=new Map<NpcClip,Texture[]>();
 for(const clip of Object.values(item.animations??{}))clips.set(clip,Array.from({length:clip.frames},(_,i)=>new Texture({source:art.textures.get(clip.image)!.source,frame:new Rectangle(i*clip.frameWidth,clip.row*clip.frameHeight,clip.frameWidth,clip.frameHeight)})));
 let last:ActorPose='idle',elapsed=0;
 function update(_time:number,dt:number,pose:ActorPose,_facing:Facing,reduced=false){
  if(pose!==last){elapsed=0;last=pose;}elapsed+=dt;
  const clip=npcClip(item,pose),frames=clip?clips.get(clip)!:undefined;
  sprite.texture=clip&&frames?frames[reduced?0:Math.floor(elapsed*clip.fps)%frames.length]:still;
  sprite.width=item.width;sprite.height=item.height;
 }
 return {view,update};
}
