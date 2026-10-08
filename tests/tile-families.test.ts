import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {tileFamilyId,detachTile,sampleTileVariant,validateTileFamilies,type TileFamilies} from '../packages/world/src/tile-families';
import {graphics} from '../src/lib/demo/pixelart';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {createAdventure} from '../src/lib/demo/adventure';
import {parseScene} from '../packages/world/src/scene';
import {imageUrls,mapImages} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {graphicsChanged,publicGraphics} from '../src/lib/server/platform/publication-state';
import {groupWorkshopTiles,workshopEntries} from '../src/lib/workshop/resources';

const families:TileFamilies={'family.grass':{name:'Pradera',tiles:{grass:70,'custom.flowers':30}}};
function pack(){const p=structuredClone(graphics);p.tiles['custom.flowers']=p.tiles.grass;p.tileNames={'custom.flowers':'Flores'};p.tileFrames={'custom.flowers':[0,0,64,32]};p.tileFamilies=structuredClone(families);return p;}
describe('floor texture families',()=>{
 it('finds families by name, filters their children by texture name and shows each tile only once',()=>{
  const entries=workshopEntries(pack()),snapshot=JSON.stringify(entries),catalog=groupWorkshopTiles(entries,families);
  const ids=[...catalog.groups.flatMap(g=>g.entries),...catalog.ungrouped].map(e=>e.id);
  expect(ids).toHaveLength(Object.keys(pack().tiles).length);expect(new Set(ids).size).toBe(ids.length);
  expect(groupWorkshopTiles(entries,families,' PRADERA ').groups[0].entries.map(e=>e.id)).toEqual(['grass','custom.flowers']);
  expect(groupWorkshopTiles(entries,families,'flores').groups[0].entries.map(e=>e.id)).toEqual(['custom.flowers']);
  expect(groupWorkshopTiles(entries,families,'arena').ungrouped.map(e=>e.id)).toEqual(['sand']);
  expect(groupWorkshopTiles(entries,families,'sin coincidencias')).toEqual({groups:[],ungrouped:[]});expect(JSON.stringify(entries)).toBe(snapshot);
 });
 it('accepts legacy packs and validates references, unique membership and relative weights',()=>{
  const p=pack();expect(()=>validateTileFamilies(undefined,p.tiles)).not.toThrow();expect(()=>validateTileFamilies(p.tileFamilies,p.tiles)).not.toThrow();
  for(const invalid of [[],null,{'family.a':{name:'',tiles:{grass:100}}},{'family.a':{name:'A',tiles:{'custom.missing':100}}},{'family.a':{name:'A',tiles:{grass:0}}},{'family.a':{name:'A',tiles:{grass:101}}},{'family.a':{name:'A',tiles:{grass:1.5}}},{'family.a':{name:'A',tiles:{grass:100}},'family.b':{name:'B',tiles:{grass:100}}}])expect(()=>validateTileFamilies(invalid,p.tiles)).toThrow('Familias');
  const sizes=new Map(imageUrls(p).map(url=>[url,pngSize(readFileSync('static'+url))]));expect(()=>validateGraphics(p,sizes)).not.toThrow();
  delete p.tiles['custom.flowers'];delete p.tileFrames!['custom.flowers'];delete p.tileNames!['custom.flowers'];expect(()=>validateGraphics(p,sizes)).toThrow('Familias');
 });
 it('detaches members without deleting graphics and cleans empty families without mutating originals',()=>{
  const before=JSON.stringify(families),next=detachTile(families,'grass');expect(tileFamilyId(next,'custom.flowers')).toBe('family.grass');expect(next['family.grass'].tiles).toEqual({'custom.flowers':30});
  expect(detachTile(next,'custom.flowers')).toEqual({});expect(JSON.stringify(families)).toBe(before);
  expect(detachTile({'family.a':{name:'A',tiles:{grass:100,path:0}}},'grass')['family.a'].tiles.path).toBe(100);
 });
 it('samples reproducibly, respects relative weights and excludes disabled variants',()=>{
  const members=[{name:'base',weight:70},{name:'flowers',weight:30},{name:'off',weight:0}],counts={base:0,flowers:0,off:0};
  for(let y=0;y<100;y++)for(let x=0;x<100;x++){
   const picked=sampleTileVariant(members,x,y)!;expect(sampleTileVariant(members,x,y)).toBe(picked);counts[picked.name as keyof typeof counts]++;
   expect(sampleTileVariant(members.map(m=>({...m,weight:m.weight*2})),x,y)?.name).toBe(picked.name);
  }
  expect(counts.off).toBe(0);expect(counts.base/10000).toBeGreaterThan(.68);expect(counts.base/10000).toBeLessThan(.72);
  expect(sampleTileVariant([{weight:0}],0,0)).toBeUndefined();expect(sampleTileVariant([],0,0)).toBeUndefined();
 });
 it('does not turn editorial family changes into unpublished gameplay changes',()=>{
  const original=pack(),changed=structuredClone(original);changed.tileFamilies!['family.grass'].name='Otra';changed.tileFamilies!['family.grass'].tiles.grass=1;
  expect(graphicsChanged(changed,original)).toBe(false);expect(publicGraphics(changed).tileFamilies).toBeUndefined();expect(original.tileFamilies).toEqual(families);
  changed.tiles['custom.flowers']=changed.tiles.sand;expect(graphicsChanged(changed,original)).toBe(true);
 });
 it('round-trips families, weights and concrete painted tiles in adventure ZIPs',async()=>{
  const original=pack(),source=mapImages(original,url=>'asset:'+url),before=JSON.stringify(source);
  const scene=parseScene({schemaVersion:1,id:'empty',name:'Prueba',theme:'outdoors',width:10,height:10,spawn:{x:0,y:0},entities:[],tiles:{'1,1':'custom.flowers'}});
  const adventure=createAdventure([scene]),blob=await exportAdventure(adventure,{pack:async()=>source,blob:async id=>new Blob([readFileSync('static'+id)])});
  const restored=unpackAdventure(new Uint8Array(await blob.arrayBuffer()));
  expect(restored.pack.tileFamilies).toEqual(families);expect(restored.pack.tileFrames).toEqual(original.tileFrames);expect(restored.adventure.maps[0].tiles).toEqual(scene.tiles);
  expect(JSON.stringify(source)).toBe(before);expect(restored.pack.tiles['custom.flowers']).toMatch(/^asset:/);
 });
});
