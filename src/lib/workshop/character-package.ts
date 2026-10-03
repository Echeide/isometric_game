import {strFromU8,unzipSync} from 'fflate';
import {actorPoses,validateCharacterGraphics,type CharacterPack,type ImageSize} from '@isometrico/world';
import {pngSize} from '$lib/storage/adventure-package';

const MAX=100_000_000,MAX_PNG=10_000_000;
const projectMessage='Este ZIP es un proyecto editable. Ábrelo en el generador y usa «Descargar personaje ZIP» para importarlo como jugador.';
/** Read only the exported character and its PNGs; public URLs become local assets, never network requests. */
export function unpackCharacter(bytes:Uint8Array){
 if(bytes.length>MAX)throw new Error('El ZIP del personaje no puede superar 100 MB.');
 let total=0,count=0,project=false;
 const seen=new Set<string>();
 const files=unzipSync(bytes,{filter:entry=>{
  if(++count>512||(total+=entry.originalSize)>MAX)throw new Error('El contenido del ZIP supera los límites permitidos.');
  if(entry.name.startsWith('/')||entry.name.includes('\\')||entry.name.split('/').some(p=>p==='..'||p==='.')||seen.has(entry.name))throw new Error('El ZIP contiene rutas no válidas o duplicadas.');
  seen.add(entry.name);
  if(entry.name==='project.json')project=true;
  const wanted=entry.name==='character.json'||/^[a-zA-Z0-9_-]+\.png$/.test(entry.name);
  if(wanted&&entry.originalSize>(entry.name==='character.json'?1_000_000:MAX_PNG))throw new Error('El personaje supera el límite de 1 MB de configuración o 10 MB por PNG.');
  return wanted;
 }});
 if(project)throw new Error(projectMessage);
 if(!files['character.json'])throw new Error('Falta character.json. Usa el ZIP exportado con «Descargar personaje ZIP».');
 let character:CharacterPack;
 try{character=JSON.parse(strFromU8(files['character.json']));}catch{throw new Error('character.json no contiene un JSON válido.');}
 if(!character||typeof character!=='object'||!character.animations||typeof character.animations!=='object'||Array.isArray(character.animations))throw new Error('La configuración del personaje no es válida.');
 if(JSON.stringify(character.directions)!=='["ne","se","sw","nw"]')throw new Error('Exporta con el perfil «Nuestro juego · 4 direcciones» (NE, SE, SW y NW).');
 if(character.variants||Object.values(character.animations).some(a=>a?.variants))throw new Error('Importa un personaje sin variantes de color, como el exportado por el generador.');
 const images=new Map<string,Uint8Array>(),sizes=new Map<string,ImageSize>();
 function imagePath(value:string){
  if(typeof value!=='string'||!/^\/?(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.png$/.test(value))throw new Error('El personaje debe usar PNG incluidos en el ZIP, sin enlaces externos.');
  const file=value.slice(value.lastIndexOf('/')+1);
  if(!Object.hasOwn(files,file))throw new Error(`Falta la hoja ${file} en el ZIP.`);
  if(!images.has(file)){images.set(file,files[file]);sizes.set(file,pngSize(files[file]));}
  return file;
 }
 character.image=imagePath(character.image);
 for(const pose of actorPoses){
  const clip=character.animations[pose];
  if(!clip||typeof clip!=='object')throw new Error(`Falta la acción ${pose} en character.json.`);
  clip.image=imagePath(clip.image??character.image);
 }
 validateCharacterGraphics(character,sizes);
 const replacements=new Map<string,string>(),blobs:Record<string,Blob>={};
 for(const [file,data] of images){const id=crypto.randomUUID();replacements.set(file,`asset:${id}`);blobs[id]=new Blob([new Uint8Array(data)],{type:'image/png'});}
 character.image=replacements.get(character.image)!;
 for(const pose of actorPoses)character.animations[pose].image=replacements.get(character.animations[pose].image!)!;
 return {character,blobs};
}
export async function readCharacterZip(file:File){
 if(file.name.endsWith('.project.zip'))throw new Error(projectMessage);
 if(file.size>MAX)throw new Error('El ZIP del personaje no puede superar 100 MB.');
 const result=unpackCharacter(new Uint8Array(await file.arrayBuffer()));
 for(const blob of Object.values(result.blobs)){const bitmap=await createImageBitmap(blob);bitmap.close();}
 return {...result,name:file.name.replace(/\.zip$/i,'').trim().slice(0,120)||'Jugador importado'};
}
