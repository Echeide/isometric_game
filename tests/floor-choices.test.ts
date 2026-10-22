import {expect,it} from 'vitest';
import {baseTileChoices,mapFloorChoices,mapFloorValue,workshopTiles} from '../src/lib/workshop/resources';
import {graphics} from '../src/lib/demo/pixelart';
import {parseScene} from '../packages/world/src/scene';
import {terrainTileAt} from '../packages/world/src/terrain';

function pack(){
 const p=structuredClone(graphics);
 for(const id of ['custom.ne','custom.interior','custom.disabled','custom.unrelated'] as const)p.tiles[id]=p.tiles.grass;
 p.tileNames={'custom.ne':'Césped · NE','custom.interior':'Césped · Interior 1','custom.disabled':'Césped · Interior 2','custom.unrelated':'Baldosas NE'};
 p.tileFrames={'custom.ne':[0,0,64,32]};
 p.tileFamilies={'family.grass':{name:'Pradera',tiles:{'custom.ne':0,'custom.interior':20,'custom.disabled':0,grass:80},borders:{1:'custom.ne'}}};
 return p;
}
it('shows one material per family while keeping ungrouped floors and every workshop piece',()=>{
 const p=pack(),before=JSON.stringify(p),choices=mapFloorChoices(p);
 expect(choices.filter(c=>c.familyId)).toMatchObject([{id:'grass',label:'Pradera',value:'terrain:family.grass'}]);
 for(const id of ['custom.ne','custom.interior','custom.disabled'])expect(choices.some(c=>c.id===id)).toBe(false);
 expect(choices.find(c=>c.id==='custom.unrelated')).toMatchObject({label:'Baldosas NE',value:'custom.unrelated'});
 expect(workshopTiles(p)).toHaveLength(Object.keys(p.tiles).length);expect(JSON.stringify(p)).toBe(before);
});
it('resolves existing fixed variants to their base option without changing the saved map',()=>{
 const p=pack();for(const id of ['grass','custom.ne','custom.interior'] as const)expect(mapFloorValue(p,id)).toBe('terrain:family.grass');
 expect(mapFloorValue(p,'path')).toBe('path');expect(mapFloorValue(p,'void')).toBe('void');expect(mapFloorValue(p,'grass','family.grass')).toBe('terrain:family.grass');
 expect(mapFloorChoices(graphics).map(c=>c.id)).toEqual(workshopTiles(graphics).map(c=>c.id));
});
it('selects a family as automatic base terrain and recomputes borders after a neighbor changes',()=>{
 const p=pack(),choice=mapFloorChoices(p).find(c=>c.familyId==='family.grass')!;
 const scene=parseScene({schemaVersion:1,id:'lawn',name:'Pradera',theme:'outdoors',baseTile:choice.id,baseTerrain:choice.familyId,width:5,height:5,spawn:{x:2,y:2},entities:[]});
 expect(terrainTileAt(scene,p,{x:2,y:0})).toBe('custom.ne');
 expect(terrainTileAt({...scene,tiles:{'2,1':'path'}},p,{x:2,y:2})).toBe('custom.ne');
 expect(['grass','custom.interior']).toContain(terrainTileAt(scene,p,{x:2,y:2}));
});
it('filters adjacent material choices regardless of member order and preserves the primary crop',()=>{
 const p=pack();p.tileFrames!.grass=[4,8,64,32];
 const choices=baseTileChoices(workshopTiles(p),p.tileFamilies);
 expect(choices.find(c=>c.familyId==='family.grass')).toMatchObject({id:'grass',frame:[4,8,64,32]});
 const reordered={...p,tileFamilies:{'family.grass':{...p.tileFamilies!['family.grass'],tiles:Object.fromEntries(Object.entries(p.tileFamilies!['family.grass'].tiles).reverse())}}};
 expect(mapFloorChoices(reordered)).toEqual(mapFloorChoices(p));
});
