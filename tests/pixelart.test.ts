import { expect, it } from 'vitest';
import { insertEntity } from '../src/lib/demo/editor';
import { parseScene } from '../packages/world/src/scene';
import office from '../src/lib/demo/maps/checkpoint.json';
it('preserves the chosen visual when two catalog entries share a kind', () => {
 const scene=parseScene(office);
 expect(insertEntity(scene,'tree','pixel','pixel.tree').entities.at(-1)?.visualId).toBe('pixel.tree');
 expect(insertEntity(scene,'tree','classic','builtin.tree').entities.at(-1)?.visualId).toBe('builtin.tree');
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
