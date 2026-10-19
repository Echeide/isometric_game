import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {parseScene} from '../packages/world/src/scene';
import type {WorldScene} from '../packages/world/src/types';
import {resolveEnvironment,environments,shadedGround} from '../packages/world/src/environments';
import {changeMapEnvironment,changeWallDefault,resizeMapWalls} from '../packages/world/src/map-appearance';
import {sceneWalls,wallKey} from '../packages/world/src/walls';
import {tileAt,validateSceneTiles} from '../packages/world/src/terrain';
import {tileSurfaceColor} from '../packages/world/src/tile-color';
import {exportAdventure,unpackAdventure} from '../src/lib/storage/adventure-package';
import {mapImages} from '../src/lib/storage/local-adventures';
import {createAdventure} from '../src/lib/demo/adventure';
import {graphics} from '../src/lib/demo/pixelart';
import {resourceUsages} from '../src/lib/workshop/resources';
const fixture=():WorldScene=>({schemaVersion:1,id:'room',name:'Mapa',theme:'office',width:8,height:8,spawn:{x:1,y:1},entities:[]});
it('normalizes old input to independent settings and never creates unpainted paths',()=>{
 for(const theme of Object.keys(environments) as WorldScene['theme'][]){const scene=parseScene({...fixture(),theme});expect(scene.environment).toBe(environments[theme].outdoor?'exterior':'interior');expect(scene.baseTile).toBe(environments[theme].tile);expect(tileAt(scene,{x:2,y:2})).toBe(environments[theme].tile);expect(sceneWalls(scene).length>0).toBe(!environments[theme].outdoor);}
 expect(tileAt(parseScene({...fixture(),theme:'outdoors'}),{x:6,y:2})).toBe('grass');
});
it('separates interior/exterior from base floors and preserves painted cells',()=>{
 const scene=parseScene({...fixture(),theme:'outdoors',environment:'interior',baseTile:'cobble',wallMaterial:'glass',tiles:{'2,2':'parquet'}});
 expect(tileAt(scene,{x:6,y:2})).toBe('cobble');expect(tileAt(scene,{x:2,y:2})).toBe('parquet');expect(sceneWalls(scene)).toHaveLength(16);expect(sceneWalls(scene).every(w=>w.material==='glass')).toBe(true);
 const exterior=parseScene(changeMapEnvironment(scene,'exterior'));expect(sceneWalls(exterior)).toEqual([]);expect(exterior.baseTile).toBe('cobble');expect(exterior.tiles).toEqual(scene.tiles);
});
it('adds/removes generated perimeter walls while preserving custom walls and linked doors',()=>{
 const original:WorldScene={...fixture(),theme:'outdoors',walls:[{x:3,y:3,axis:'x',kind:'wall',material:'glass'},{x:3,y:0,axis:'x',kind:'door',exitId:'exit'}],entities:[{id:'exit',kind:'goal',visualId:'pixel.goal',label:'Entrada',position:{x:3,y:0},interaction:{label:'Entrar',action:'adventure.exit',resourceId:'other'},solid:false}]};
 const interior=parseScene(changeMapEnvironment(original,'interior'));expect(interior.automaticWalls).toHaveLength(15);
 const stone=parseScene(changeWallDefault(interior,'stone'));expect(stone.walls!.find(w=>w.x===3&&w.y===3)?.material).toBe('glass');expect(stone.walls!.filter(w=>stone.automaticWalls!.includes(wallKey(w))).every(w=>w.material==='stone')).toBe(true);
 const exterior=parseScene(changeMapEnvironment(stone,'exterior'));expect(exterior.walls).toEqual(original.walls);expect(exterior.entities).toEqual(original.entities);
});
it('resizes generated walls without restoring manually removed segments or altering a custom finish',()=>{
 const interior=changeMapEnvironment({...fixture(),walls:[]},'interior'),removed='x:2,0';
 const edited={...interior,walls:interior.walls!.filter(w=>wallKey(w)!==removed),automaticWalls:interior.automaticWalls!.filter(k=>k!==removed)};
 const resized=parseScene(resizeMapWalls(edited,9,8));expect(resized.walls!.some(w=>wallKey(w)===removed)).toBe(false);expect(resized.walls!.some(w=>wallKey(w)==='x:8,0')).toBe(true);
});
it('rejects malformed settings and missing base tile resources',()=>{
 for(const delta of [{environment:'castle'},{baseTile:'void'},{wallMaterial:'wood'},{cutColor:-1},{cutColor:0x1000000},{cutColor:1.5},{automaticWalls:['x:0,0']}])expect(()=>parseScene({...fixture(),...delta})).toThrow();
 const custom=parseScene({...fixture(),baseTile:'custom.floor'});expect(()=>validateSceneTiles(custom,graphics.tiles)).toThrow('Falta el suelo base');
});
it('samples the visible inner tile instead of transparent areas and outlines, and permits an exact manual override',()=>{
 const w=10,h=10,pixels=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;pixels.set([0,0,0,255],i);if(x>1&&x<8&&y>1&&y<8)pixels.set([170,180,190,255],i);}
 pixels.set([255,0,0,0],(5*w+5)*4);expect(tileSurfaceColor(pixels,w,h)).toBe(0xaab4be);expect(tileSurfaceColor(new Uint8Array(400),10,10)).toBeUndefined();
 expect(resolveEnvironment({...fixture(),baseTile:'cobble'},0xaab4be).ground).toEqual(shadedGround(0xaab4be));expect(resolveEnvironment({...fixture(),baseTile:'cobble',cutColor:0x805020},0xaab4be).ground).toEqual(shadedGround(0x805020));
});
it('exports and imports independent map settings and a custom base tile in the adventure ZIP',async()=>{
 const scene=parseScene({...fixture(),environment:'exterior',baseTile:'custom.floor',wallMaterial:'stone',cutColor:0x123456}),adventure=createAdventure([scene]),pack=structuredClone(graphics);pack.tiles['custom.floor']=pack.tiles.cobble;pack.tileNames={...pack.tileNames,'custom.floor':'Suelo de prueba'};
 const archive=await exportAdventure(adventure,{pack:async()=>mapImages(pack,url=>'asset:'+url),blob:async id=>new Blob([new Uint8Array(await readFile('static'+id))])});
 const imported=unpackAdventure(new Uint8Array(await archive.arrayBuffer()));expect(imported.adventure.maps[0]).toMatchObject({environment:'exterior',baseTile:'custom.floor',wallMaterial:'stone',cutColor:0x123456});expect(imported.pack.tiles['custom.floor']).toMatch(/^asset:/);
});

it('counts a custom base floor as used and does not report obsolete preset paths',()=>{
 const scene=parseScene({...fixture(),theme:'outdoors',baseTile:'custom.floor'});
 const entry={id:'custom.floor',kind:'tile' as const,name:'Suelo',image:'floor.png',custom:true};
 expect(resourceUsages([scene],entry)).toEqual(['Mapa']);
 expect(resourceUsages([scene],{...entry,id:'grass'})).toEqual([]);
 expect(resourceUsages([scene],{...entry,id:'path'})).toEqual([]);
 expect(resourceUsages([{...scene,tiles:{'2,2':'path'}}],{...entry,id:'path'})).toEqual(['Mapa']);
});
it('shrinks painted maps by cropping every cell layer and out-of-bounds walls',()=>{
 const source:WorldScene={...fixture(),width:20,height:8,tiles:{'18,0':'grass','19,0':'grass','1,7':'path'},terrains:{'19,0':'family.grass'},elevations:{'19,0':1},stairs:{'19,0':'se'},blocked:[{x:19,y:0}],walls:[{x:19,y:0,axis:'x',kind:'wall'},{x:18,y:0,axis:'x',kind:'wall'}]};
 const resized=parseScene(resizeMapWalls(source,19,7));
 expect(resized.tiles).toEqual({'18,0':'grass'});
 expect(resized.terrains).toEqual({});expect(resized.elevations).toEqual({});expect(resized.stairs).toEqual({});expect(resized.blocked).toEqual([]);
 expect(resized.walls).toEqual([{x:18,y:0,axis:'x',kind:'wall'}]);
 expect(source.tiles!['19,0']).toBe('grass');expect(source.width).toBe(20);
});
it('shrinks generated perimeter walls and preserves objects for explicit repositioning',()=>{
 const source=changeMapEnvironment({...fixture(),walls:[]},'interior');
 const resized=parseScene(resizeMapWalls(source,7,6));
 expect(resized.walls).toHaveLength(13);expect(resized.automaticWalls).toHaveLength(13);
 const occupied={...fixture(),entities:[{id:'edge',kind:'tree' as const,label:'Árbol',position:{x:7,y:2}}]};
 expect(resizeMapWalls(occupied,7,8).entities).toEqual(occupied.entities);
 expect(()=>parseScene(resizeMapWalls(occupied,7,8))).toThrow('Posición no válida: edge');
});
