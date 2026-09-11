import { expect, it } from 'vitest';
import { insertEntity } from '../src/lib/demo/editor';
import { parseScene } from '../packages/world/src/scene';
import office from '../src/lib/demo/maps/checkpoint.json';
it('only offers pixel visuals for new objects', () => {
 const scene=parseScene(office);
 expect(insertEntity(scene,'tree','pixel','pixel.tree').entities.at(-1)?.visualId).toBe('pixel.tree');
 expect(()=>insertEntity(scene,'tree','classic','builtin.tree')).toThrow();
 expect(visualCatalog.every(a=>a.id.startsWith('pixel.'))).toBe(true);
 expect(()=>insertEntity(scene,'tree','invalid','pixel.desk')).toThrow();
});

import { visualCatalog } from '../packages/world/src/scene';
import catalog from '../static/pixelart/catalog.json';
import outdoors from '../src/lib/demo/maps/routingtales.json';
it('covers every object kind and both demo maps with pixel visuals',()=>{
 for(const kind of new Set(visualCatalog.map(a=>a.kind))){
  expect(visualCatalog.some(a=>a.id===`pixel.${kind}`)).toBe(true);
  if(kind!=='person')expect(catalog.objects).toHaveProperty([`pixel.${kind}`]);
 }
 for(const map of [office,outdoors])for(const e of parseScene(map).entities)expect(e.visualId).toBe(`pixel.${e.kind}`);
 expect(catalog.objects['pixel.goal-completed'].image).not.toBe(catalog.objects['pixel.goal'].image);
});
it('creates the pixel sofa with its full three-cell footprint',()=>{
 const scene=parseScene({schemaVersion:1,id:'empty',name:'Empty',theme:'office',width:8,height:8,spawn:{x:0,y:0},entities:[]});
 const sofa=insertEntity(scene,'sofa','sofa','pixel.sofa').entities.at(-1)!;
 expect(sofa.size).toEqual({x:1,y:3});
 expect(sofa.position.y+sofa.size!.y).toBeLessThanOrEqual(scene.height);
});

it('migrates legacy maps without mutating their data or interactions',()=>{
 for(const map of [office,outdoors]){
  const legacy=structuredClone(map);
  for(const e of legacy.entities)e.visualId=`builtin.${e.kind}`;
  const before=structuredClone(legacy);
  const migrated=parseScene(legacy);
  expect(legacy).toEqual(before);
  expect(migrated).toEqual(parseScene(map));
  const noVisual={...legacy,entities:legacy.entities.map(({visualId,...e})=>e)};
  expect(parseScene(noVisual)).toEqual(migrated);
 }
});
it('rejects mismatched classic IDs instead of silently changing the object kind',()=>{
 const legacy=structuredClone(office);
 legacy.entities[0].visualId='builtin.tree';
 expect(()=>parseScene(legacy)).toThrow('Recurso visual');
});
it('places every library asset using its declared footprint and character palette',()=>{
 const empty=parseScene({schemaVersion:1,id:'empty',name:'Empty',theme:'outdoors',width:8,height:8,spawn:{x:0,y:0},entities:[]});
 expect(new Set(visualCatalog.map(a=>a.category))).toEqual(new Set(['office','nature','urban','people']));
 for(const asset of visualCatalog){
  const scene=insertEntity(empty,asset.kind,asset.id,asset.id,{x:2,y:2});
  const entity=scene.entities[0];
  expect(entity.size).toEqual(asset.size);
  expect(entity.color).toBe(asset.color);
  expect(parseScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  if(asset.kind!=='person')expect(catalog.objects).toHaveProperty([asset.id]);
 }
});
