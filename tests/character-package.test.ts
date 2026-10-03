import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {actorPoses,characterFps,validateCharacterGraphics,parseScene} from '../packages/world/src';
import {graphics} from '../src/lib/demo/pixelart';
import {standaloneCharacter} from '../src/lib/workshop/resources';
import {unpackCharacter,readCharacterZip} from '../src/lib/workshop/character-package';
import {pngSize,exportAdventure,unpackAdventure} from '../src/lib/storage/adventure-package';
import {createAdventure} from '../src/lib/demo/adventure';
import {mapImages} from '../src/lib/storage/local-adventures';

function fixture(){
 const character=standaloneCharacter(graphics.character),files:Record<string,Uint8Array>={};
 for(const action of actorPoses){
  const clip=character.animations[action];
  files[`${action}.png`]=new Uint8Array(readFileSync(`static/pixelart/characters/grey-player-v1/${action}.png`));
  clip.image=`/pixelart/characters/mi-heroe/${action}.png`;clip.row=0;
 }
 character.image=character.animations.idle.image!;
 character.animations.sit.frames=1;character.animations.walk.directionFps={ne:7,se:11.5,sw:11.5,nw:7};
 return {character,files};
}
function archive(data=fixture()){return zipSync({...data.files,'character.json':strToU8(JSON.stringify(data.character))});}
describe('character ZIP import',()=>{
 it('imports generator paths as independent local images and preserves all player metadata',async()=>{
  const original=fixture(),result=unpackCharacter(archive(original));
  expect(Object.keys(result.blobs)).toHaveLength(6);
  expect(result.character).toMatchObject({frameWidth:original.character.frameWidth,frameHeight:original.character.frameHeight,anchor:original.character.anchor,directions:['ne','se','sw','nw']});
  for(const pose of actorPoses){
   const clip=result.character.animations[pose];
   expect(clip).toMatchObject({...original.character.animations[pose],image:expect.stringMatching(/^asset:/)});
   expect(new Uint8Array(await result.blobs[clip.image!.slice(6)].arrayBuffer())).toEqual(original.files[`${pose}.png`]);
  }
  expect(characterFps(result.character,'walk','se')).toBe(11.5);
  expect(result.character.animations.sit.image).not.toBe(result.character.animations.work.image);
  expect(result.character.image).toBe(result.character.animations.idle.image);
  const sizes=new Map(await Promise.all(Object.entries(result.blobs).map(async([id,blob])=>[`asset:${id}`,pngSize(new Uint8Array(await blob.arrayBuffer()))] as const)));
  expect(()=>validateCharacterGraphics(result.character,sizes)).not.toThrow();
 });
 it('rejects missing actions, missing PNGs and animation cells outside their sheet',()=>{
  const missing=fixture();delete missing.files['walk.png'];expect(()=>unpackCharacter(archive(missing))).toThrow('walk.png');
  const action=fixture();delete (action.character.animations as Record<string,unknown>).talk;expect(()=>unpackCharacter(archive(action))).toThrow('talk');
  const overflow=fixture();overflow.character.animations.walk.row=4;expect(()=>unpackCharacter(archive(overflow))).toThrow('cuatro filas');
  const badPng=fixture();badPng.files['sit.png']=strToU8('not png');expect(()=>unpackCharacter(archive(badPng))).toThrow('PNG');
 });
 it('explains editable projects and incompatible eight-direction exports',async()=>{
  expect(()=>unpackCharacter(zipSync({'project.json':strToU8('{}')}))).toThrow('proyecto editable');
  await expect(readCharacterZip(new File([''], 'heroe.project.zip'))).rejects.toThrow('Descargar personaje ZIP');
  const eight=fixture();eight.character.directions=['se','sw','ne','nw','e','w','s','n'] as never;
  expect(()=>unpackCharacter(archive(eight))).toThrow('4 direcciones');
  expect(()=>unpackCharacter(zipSync({'manifest.json':strToU8('{}')}))).toThrow('character.json');
 });
 it('rejects remote image paths, traversal and oversized compressed contents',()=>{
  for(const path of ['https://example.com/idle.png','//example.com/idle.png','../idle.png','/pixelart/../idle.png','asset:secret']){
   const data=fixture();data.character.image=path;expect(()=>unpackCharacter(archive(data))).toThrow('sin enlaces externos');
  }
  expect(()=>unpackCharacter(zipSync({'../idle.png':new Uint8Array(1)}))).toThrow('rutas');
  expect(()=>unpackCharacter(zipSync({'character.json':new Uint8Array(1_000_001)}))).toThrow('límite');
 });
 it('keeps an imported player and per-direction speeds when exporting and reopening the adventure',async()=>{
  const imported=unpackCharacter(archive()),pack=structuredClone(graphics);
  pack.players={'custom.imported':{name:'Importado',character:imported.character}};pack.activePlayer='custom.imported';
  const adventure=createAdventure([parseScene({schemaVersion:1,id:'test',name:'Prueba',theme:'office',width:10,height:10,spawn:{x:0,y:0},entities:[]})]);
  const stored=mapImages(pack,url=>url.startsWith('asset:')?url:`asset:${url}`);
  const zip=await exportAdventure(adventure,{pack:async()=>stored,blob:async id=>imported.blobs[id]??new Blob([readFileSync('static'+id)])});
  const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));
  const player=restored.pack.players!['custom.imported'].character;
  expect(restored.pack.activePlayer).toBe('custom.imported');
  expect(characterFps(player,'walk','se')).toBe(11.5);
  expect(player.animations.sit.image).not.toBe(player.animations.work.image);
 });
});
