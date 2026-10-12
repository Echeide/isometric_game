import {expect,it} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {terrainAt,terrainTileAt,validateSceneTiles} from '../packages/world/src/terrain';
import {validateTileFamilies,detachTile,type TileFamilies} from '../packages/world/src/tile-families';
import {paintTiles} from '../src/lib/demo/editor';
import {graphics} from '../src/lib/demo/pixelart';
import {terrainTemplate} from '../src/lib/workshop/terrain-template';
import {publicGraphics} from '../src/lib/server/platform/publication-state';
import {resourceUsages} from '../src/lib/workshop/resources';
import {terrainSides} from '../packages/world/src/tile-families';
import {stairDirections} from '../packages/world/src/elevation';
import type {Facing,TileKind,WorldScene} from '../packages/world/src/types';
const families:TileFamilies={'family.lawn':{name:'Césped',tiles:{grass:80,'custom.flower':20,'custom.ne':0,'custom.corner':0,'custom.island':0},borders:{1:'custom.ne',3:'custom.corner',15:'custom.island'}}};
const pack={...structuredClone(graphics),tiles:{...graphics.tiles,'custom.flower':graphics.tiles.grass,'custom.ne':graphics.tiles.grass,'custom.corner':graphics.tiles.grass,'custom.island':graphics.tiles.grass},tileFamilies:families};
const scene=()=>parseScene({schemaVersion:1,id:'yard',name:'Jardín',theme:'outdoors',baseTile:'path',width:6,height:6,spawn:{x:0,y:0},entities:[]});
const cells=Array.from({length:9},(_,i)=>({x:1+i%3,y:1+Math.floor(i/3)}));
it('resolves rectangular edges, corners and isolated tiles; adjoining strokes recompute neighbors',()=>{
 const a=paintTiles(scene(),cells,'terrain:family.lawn',{families});expect(terrainTileAt(a,pack,{x:2,y:1})).toBe('custom.ne');expect(terrainTileAt(a,pack,{x:3,y:1})).toBe('custom.corner');
 const b=paintTiles(a,[{x:3,y:0}],'terrain:family.lawn',{families});expect(terrainTileAt(b,pack,{x:3,y:1})).not.toBe('custom.corner');
 expect(terrainTileAt(paintTiles(scene(),[{x:2,y:2}],'terrain:family.lawn',{families}),pack,{x:2,y:2})).toBe('custom.island');
 expect(JSON.parse(JSON.stringify(a)).terrains).toEqual(a.terrains);
});
it('keeps manual overrides fixed, erases family assignment and does not alter collisions or entities',()=>{
 const a=paintTiles(scene(),cells,'terrain:family.lawn',{families});const manual=paintTiles(a,[{x:3,y:1}],'grass');expect(terrainAt(manual,{x:3,y:1})).toBeUndefined();expect(terrainTileAt(manual,pack,{x:3,y:1})).toBe('grass');
 const erased=paintTiles(manual,[{x:2,y:2}],'erase');expect(erased.terrains?.['2,2']).toBeUndefined();expect(terrainTileAt(erased,pack,{x:2,y:2})).toBe('path');expect(erased.entities).toEqual(a.entities);
});
it('uses stable weighted variations, falls back for missing pieces and applies a family to the base floor',()=>{
 const a={...scene(),baseTerrain:'family.lawn',baseTile:'grass' as const};const results=Array.from({length:20},(_,i)=>terrainTileAt(a,pack,{x:1+i%4,y:1+Math.floor(i/4)}));
 expect(results).toEqual(Array.from({length:20},(_,i)=>terrainTileAt(structuredClone(a),publicGraphics(pack),{x:1+i%4,y:1+Math.floor(i/4)})));expect(new Set(results)).toEqual(new Set(['grass','custom.flower']));const reordered={...pack,tileFamilies:{'family.lawn':{...families['family.lawn'],tiles:Object.fromEntries(Object.entries(families['family.lawn'].tiles).reverse())}}};expect(results).toEqual(Array.from({length:20},(_,i)=>terrainTileAt(a,reordered,{x:1+i%4,y:1+Math.floor(i/4)})));
 const missing=paintTiles(scene(),cells,'terrain:family.lawn',{families});expect(['grass','custom.flower']).toContain(terrainTileAt(missing,pack,{x:1,y:3}));
 expect(terrainTileAt({...a,tiles:{'1,1':'sand'}},pack,{x:1,y:1})).toBe('sand');
});
it('can restrict borders to a particular adjacent floor',()=>{
 const restricted={...pack,tileFamilies:{'family.lawn':{...families['family.lawn'],borderAgainst:'sand' as const}}};const a=paintTiles(scene(),cells,'terrain:family.lawn',{families});expect(terrainTileAt(a,restricted,{x:2,y:1})).not.toBe('custom.ne');
 expect(terrainTileAt(paintTiles(a,[{x:2,y:0}],'sand'),restricted,{x:2,y:1})).toBe('custom.ne');
});
const heightFamily={name:'Alturas',tiles:Object.fromEntries([['grass',100],...Array.from({length:15},(_,i)=>[`custom.edge${i+1}`,0])]),borders:Object.fromEntries(Array.from({length:15},(_,i)=>[String(i+1),`custom.edge${i+1}` as TileKind]))};
const heightPack={...pack,tileFamilies:{'family.height':heightFamily}};
const heightScene=():WorldScene=>({...scene(),baseTile:'grass',baseTerrain:'family.height'});
it('ends each platform at changes of height, including manual family neighbors and underground levels',()=>{
 const center={x:2,y:2};
 for(const side of terrainSides)for(const level of [-2,-1,1,2]){
  const neighbor={x:center.x+side.dx,y:center.y+side.dy},key=`${neighbor.x},${neighbor.y}`;
  const a={...heightScene(),tiles:{[key]:'grass' as const},elevations:{[key]:level}};
  expect(terrainTileAt(a,heightPack,center)).toBe(`custom.edge${side.bit}`);
  expect(terrainTileAt(a,heightPack,neighbor)).toBe('grass'); // manual pieces stay fixed
  expect(terrainTileAt({...a,elevations:{}},heightPack,center)).toBe('grass');
 }
 expect(terrainTileAt({...heightScene(),elevations:{'2,2':1}},heightPack,center)).toBe('custom.edge15');
});
it('keeps physical edges around holes and cliffs even with a restricted adjacent material',()=>{
 const restricted={...heightPack,tileFamilies:{'family.height':{...heightFamily,borderAgainst:'sand' as const}}},center={x:2,y:2};
 expect(terrainTileAt({...heightScene(),elevations:{'2,1':1}},restricted,center)).toBe('custom.edge1');
 expect(terrainTileAt({...heightScene(),tiles:{'2,1':'void'}},restricted,center)).toBe('custom.edge1');
 expect(terrainTileAt({...heightScene(),tiles:{'2,1':'path'}},restricted,center)).toBe('grass');
 expect(terrainTileAt({...heightScene(),tiles:{'2,1':'sand'}},restricted,center)).toBe('custom.edge1');
});
it.each(Object.keys(stairDirections) as Facing[])('keeps both %s stair landings open and parallel stairs joined',facing=>{
 const c={x:2,y:2},d=stairDirections[facing],upper={x:c.x+d.x,y:c.y+d.y},lower={x:c.x-d.x,y:c.y-d.y};
 const upperKey=`${upper.x},${upper.y}`,a:WorldScene={...heightScene(),stairs:{'2,2':facing},elevations:{[upperKey]:1}};
 expect(terrainTileAt(a,heightPack,lower)).toBe('grass');
 const upperMask=terrainSides.filter(side=>side.dx!==-d.x||side.dy!==-d.y).reduce((mask,side)=>mask|side.bit,0);
 expect(terrainTileAt(a,heightPack,upper)).toBe(`custom.edge${upperMask}`);
 const sideMask=d.x?5:10;
 expect(terrainTileAt(a,heightPack,c)).toBe(`custom.edge${sideMask}`);
 const side=terrainSides.find(side=>d.x?side.dx===0:side.dy===0)!,key=`${c.x+side.dx},${c.y+side.dy}`;
 expect(terrainTileAt({...a,stairs:{...a.stairs,[key]:facing}},heightPack,c)).toBe(`custom.edge${sideMask^side.bit}`);
 const opposite=Object.entries(stairDirections).find(([,v])=>v.x===-d.x&&v.y===-d.y)![0] as Facing;
 expect(terrainTileAt({...a,stairs:{...a.stairs,[key]:opposite}},heightPack,c)).toBe(`custom.edge${sideMask}`);
});
it('validates terrain IDs, missing families, border references/weights and cleans detached roles',()=>{
 expect(()=>validateTileFamilies(families,pack.tiles)).not.toThrow();
 for(const borders of [{16:'grass'},{1:'custom.missing'},{1:'grass'},{'01':'custom.ne'}])expect(()=>validateTileFamilies({'family.a':{...families['family.lawn'],borders}},pack.tiles)).toThrow();
 expect(()=>parseScene({...scene(),terrains:{'6,0':'family.lawn'}})).toThrow();expect(()=>parseScene({...scene(),tiles:{'1,1':'void'},terrains:{'1,1':'family.lawn'}})).toThrow();expect(()=>parseScene({...scene(),baseTerrain:'nope'})).toThrow();
 const a=paintTiles(scene(),cells,'terrain:family.lawn',{families});expect(()=>validateSceneTiles(a,pack.tiles,{})).toThrow('Falta la familia');expect(()=>paintTiles(a,cells,'terrain:missing',{families})).toThrow();
 expect(detachTile(families,'custom.ne')['family.lawn'].borders?.[1]).toBeUndefined();
 const entry={id:'custom.ne',kind:'tile' as const,name:'Borde',image:'x',custom:true};expect(resourceUsages([a],entry,undefined,families)).toEqual(['Jardín']);
});
it('creates matching pixel templates within the adventure palette and leaves the source untouched',()=>{
 const data=new Uint8ClampedArray(64*32*4);for(let i=0;i<data.length;i+=4)data.set([160,180,100,255],i);const source={width:64,height:32,data},before=new Uint8ClampedArray(data),palette={name:'Prueba',colors:['#a0b464','#506432','#d0dc96']};
 const center=terrainTemplate(source,[0,0,64,32],0,palette as never),border=terrainTemplate(source,[0,0,64,32],15,palette as never),variant=terrainTemplate(source,[0,0,64,32],0,palette as never,1);
 expect(source.data).toEqual(before);expect(border.data).not.toEqual(center.data);expect(variant.data).not.toEqual(center.data);
 expect(border.data[3]).toBe(0);expect(border.data[(16*64+32)*4+3]).toBe(255);
 for(let i=0;i<border.data.length;i+=4)if(border.data[i+3])expect(palette.colors).toContain('#'+Array.from(border.data.slice(i,i+3)).map(n=>n.toString(16).padStart(2,'0')).join(''));
});
