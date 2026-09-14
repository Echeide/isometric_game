import {actorPoses,characterImage,characterVariants,type CharacterPack} from './character';
import type {PixelArtPack,NpcClip,ObjectSprite} from './pixelart';
import {tileKinds,isTileKind,isCustomTile,type TileKind} from './types';
export type ImageSize={width:number;height:number};
export function validateGraphics(pack:PixelArtPack,sizes:Map<string,ImageSize>){
 const fail=(message:string):never=>{throw new Error(message);};
 const positive=(n:number)=>Number.isFinite(n)&&n>0&&n<=4096;
 const integer=(n:number)=>Number.isInteger(n)&&positive(n);
 const point=(p:number[])=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=4096);
 const image=(url:string)=>sizes.get(url)??fail('Falta una imagen del recurso.');
 const frame=(f:number[],url:string)=>{const s=image(url);if(!Array.isArray(f)||f.length!==4||!f.every(Number.isInteger)||f[0]<0||f[1]<0||f[2]<=0||f[3]<=0||f[0]+f[2]>s.width||f[1]+f[3]>s.height)fail('El recorte sale de la imagen.');};
 function character(c:CharacterPack){
  if(!c||!integer(c.frameWidth)||!integer(c.frameHeight)||!point(c.anchor)||JSON.stringify(c.directions)!=='["ne","se","sw","nw"]'||!c.animations)fail('Configuración de jugador no válida.');
  if(c.scale!==undefined&&(!Number.isFinite(c.scale)||c.scale<.05||c.scale>8))fail('La escala debe estar entre 5% y 800%.');
  if(Object.keys(c.animations).some(a=>!actorPoses.includes(a as typeof actorPoses[number])))fail('Acción de jugador no admitida.');
  for(const pose of actorPoses){
   const a=c.animations[pose];if(!a||!integer(a.frames)||a.frames>64||!Number.isInteger(a.row)||a.row<0||!Number.isFinite(a.fps)||a.fps<1||a.fps>60)fail(`Revisa los fotogramas y la velocidad de ${pose}.`);
   for(const variant of characterVariants(c)){const s=image(characterImage(c,pose,variant));if(c.frameWidth*a.frames>s.width||(a.row+4)*c.frameHeight>s.height)fail(`La acción ${pose} sale de su hoja. Necesita cuatro filas de direcciones.`);}
  }
 }
 if(!pack||pack.version!==1||!pack.objects||!pack.tiles)fail('Catálogo gráfico no válido.');
 character(pack.character);
 if(Object.keys(pack.players??{}).length>24)fail('La biblioteca admite hasta 24 jugadores propios.');
 for(const [id,p]of Object.entries(pack.players??{})){if(!/^custom\.[a-zA-Z0-9_-]{1,80}$/.test(id)||!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>120)fail('Jugador no válido.');character(p.character);}
 if(pack.activePlayer&&!Object.hasOwn(pack.players??{},pack.activePlayer))fail('El jugador activo no existe.');
 if(Object.keys(pack.objects).length>256)fail('El catálogo gráfico tiene demasiados objetos.');
 for(const o of Object.values(pack.objects))validateObject(o);
 function validateObject(o:ObjectSprite){
  if(!o||!positive(o.width)||!positive(o.height)||!point(o.origin))fail('Dimensiones o punto de apoyo no válidos.');
  image(o.image);if(o.frame)frame(o.frame,o.image);
  for(const [pose,clip]of Object.entries(o.animations??{})){
   if(!['idle','talk'].includes(pose))fail('Un PNJ solo admite idle y talk.');
   const c=clip as NpcClip;
   if(!c||!integer(c.frameWidth)||!integer(c.frameHeight)||!integer(c.frames)||c.frames>64||!Number.isInteger(c.row)||c.row<0||!Number.isFinite(c.fps)||c.fps<1||c.fps>60)fail(`Animación ${pose} del PNJ no válida.`);
   const s=image(c.image);if(c.frameWidth*c.frames>s.width||(c.row+1)*c.frameHeight>s.height)fail(`La animación ${pose} del PNJ sale de su hoja.`);
  }
 }
 for(const kind of tileKinds)if(!Object.hasOwn(pack.tiles,kind))fail(`Falta el suelo base ${kind}.`);
 if(Object.keys(pack.tiles).filter(isCustomTile).length>128)fail('La biblioteca admite hasta 128 suelos propios.');
 for(const [kind,url]of Object.entries(pack.tiles)){
  if(!isTileKind(kind))fail('Tipo de suelo no válido.');
  image(url);const f=pack.tileFrames?.[kind as TileKind];if(f)frame(f,url);
  if(isCustomTile(kind)&&!pack.tileNames?.[kind])fail('Escribe un nombre para el suelo personalizado.');
 }
 for(const [kind,name]of Object.entries(pack.tileNames??{}))if(!Object.hasOwn(pack.tiles,kind)||typeof name!=='string'||!name.trim()||name.length>120)fail('Nombre de suelo no válido.');
 if(Object.keys(pack.tileFrames??{}).some(k=>!Object.hasOwn(pack.tiles,k)))fail('El recorte referencia un suelo que no existe.');
}
