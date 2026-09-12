import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import type { ActorPose, Facing, TileKind } from './types';
import {characterImage,characterVariants,type CharacterPack} from './character';
export interface PixelArtPack {
 version:1;
 character:CharacterPack;
 objects:Record<string,{image:string;width:number;height:number;origin:[number,number];frame?:[number,number,number,number]}>;
 tiles:Record<TileKind,string>;
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
 const urls=[...variants.flatMap(variant=>(Object.keys(pack.character.animations) as ActorPose[]).map(pose=>characterImage(pack.character,pose,variant))),...Object.values(pack.objects).map(a=>a.image),...Object.values(pack.tiles)];
 const textures=new Map<string,Texture>();
 await Promise.all([...new Set(urls)].map(async url=>{const texture=await Assets.load<Texture>(url);texture.source.scaleMode='nearest';textures.set(url,texture);}));
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
 const {frameWidth:w,frameHeight:h}=pack.character;
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)throw new Error('Tamaño de fotograma no válido.');
 for(const variant of variants){
  for(const pose of Object.keys(pack.character.animations) as ActorPose[]){
   const clip=pack.character.animations[pose],url=characterImage(pack.character,pose,variant),texture=textures.get(url)!;
   for(const [di,facing]of pack.character.directions.entries()){
    if(!Number.isInteger(clip.row)||clip.row<0||!Number.isInteger(clip.frames)||clip.frames<1||clip.fps<=0||w*clip.frames>texture.width||(clip.row+di+1)*h>texture.height)throw new Error(`Fotogramas fuera de la hoja: ${pose}/${facing}`);
    frames.set(`${variant}:${pose}:${facing}`,Array.from({length:clip.frames},(_,i)=>new Texture({source:texture.source,frame:new Rectangle(i*w,(clip.row+di)*h,w,h)})));
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
 const {character}=art.pack;const variant=characterVariants(character).includes(color.toString(16))?color.toString(16):'default';
 const view=new Container(),sprite=new Sprite(art.frames.get(`${variant}:idle:se`)![0]);
 sprite.position.set(-character.anchor[0],-character.anchor[1]);sprite.roundPixels=true;
 const shadow=new Graphics().ellipse(0,1,12,4).fill({color:0x233f39,alpha:.2});view.addChild(shadow,sprite);
 if(me){const mark=new Graphics().poly([-4,-67,4,-67,0,-63]).fill(0xbbdd6b);view.addChild(mark);}
 let lastPose:ActorPose='idle',elapsed=0;
 function update(_time:number,dt:number,pose:ActorPose,facing:Facing,reduced=false){
  if(pose!==lastPose){elapsed=0;lastPose=pose;}elapsed+=dt;
  const clip=character.animations[pose],frames=art.frames.get(`${variant}:${pose}:${facing}`)!;
  sprite.texture=frames[reduced?0:Math.floor(elapsed*clip.fps)%frames.length];
 }
 return {view,update};
}
