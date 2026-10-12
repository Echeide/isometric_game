import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseScene,type VisualAsset} from '../packages/world/src/scene';
import {decorationBounds,decorationPosition} from '../packages/world/src/decorations';
import {createNavigator,walkable} from '../packages/world/src/navigation';
import {insertDecoration,updateDecoration} from '../src/lib/demo/decorations';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {graphics} from '../src/lib/demo/pixelart';
import {exportAdventure,unpackAdventure,validateCatalogGraphics} from '../src/lib/storage/adventure-package';
import {mapImages} from '../src/lib/storage/local-adventures';
import {resourceUsages,workshopEntries} from '../src/lib/workshop/resources';
const map=()=>parseScene({schemaVersion:1,id:'square',name:'Plaza',theme:'outdoors',width:8,height:8,spawn:{x:1,y:1},entities:[]});
const asset:VisualAsset={id:'custom.townhall',label:'Ayuntamiento',kind:'object',category:'urban',size:{x:30,y:25}};
const placed=()=>insertDecoration(map(),asset,'hall',{x:-12,y:-25});
it('places a building beyond the terrain without changing walkability, elevations or entities',()=>{
 const before=map(),after=placed();expect(after.entities).toEqual(before.entities);expect(after.width).toBe(8);
 expect([...createNavigator(after).reachableFrom(after.spawn)]).toEqual([...createNavigator(before).reachableFrom(before.spawn)]);
 expect(walkable(after,{x:-1,y:0})).toBe(false);
 expect(parseScene({...after,tiles:{'0,0':'void'}}).decorations).toEqual(after.decorations);
});
it('moves and raises a decoration independently of terrain while preserving history snapshots',()=>{
 const before=placed(),snapshot=JSON.stringify(before);
 const after=updateDecoration(before,'hall',{position:{x:0,y:-25},baseLevel:2,offset:{x:4,y:-6},scale:.75});
 expect(JSON.stringify(before)).toBe(snapshot);expect(after.decorations![0]).toMatchObject({baseLevel:2,scale:.75});
 expect(decorationPosition(after.decorations![0])).toEqual({x:804,y:-454});
 expect(parseScene(JSON.parse(snapshot))).toEqual(before);
});
it('validates separate IDs, resource types and bounded placement data',()=>{
 const scene=placed(),d=scene.decorations![0];
 for(const patch of [{position:{x:129,y:0}},{position:{x:NaN,y:0}},{size:{x:0,y:1}},{scale:0},{baseLevel:3},{offset:{x:Infinity,y:0}},{visualId:'pixel.person'},{interaction:{}},{label:''}])expect(()=>parseScene({...scene,decorations:[{...d,...patch}]})).toThrow();
 expect(()=>parseScene({...scene,decorations:[d,d]})).toThrow();
 expect(()=>parseScene({...scene,decorations:[{...d,id:'occupied'}],entities:[{id:'occupied',kind:'goal',label:'X',position:{x:4,y:4}}]})).toThrow();
 expect(()=>insertDecoration(map(),{...asset,kind:'person'},'npc',{x:0,y:0})).toThrow();
});
it('requires a matching object catalogue and image and counts decoration-only resource usage',()=>{
 const scene=placed(),adventure={...createAdventure([map()]),maps:[scene],catalog:[asset]};
 expect(parseAdventure(adventure).maps[0].decorations).toEqual(scene.decorations);
 expect(()=>parseAdventure({...adventure,catalog:[]})).toThrow();
 expect(()=>parseAdventure({...adventure,catalog:[{...asset,kind:'person'}]})).toThrow();
 expect(()=>validateCatalogGraphics(adventure,graphics)).toThrow('decorado');
 const pack={...graphics,objects:{...graphics.objects,[asset.id]:graphics.objects['pixel.desk']}};
 expect(resourceUsages([scene],workshopEntries(pack,[asset]).find(e=>e.id===asset.id)!)).toEqual(['Plaza']);
});
it('includes scale, image support, rotation and base height in camera bounds',()=>{
 const d={...placed().decorations![0],position:{x:0,y:0},baseLevel:2,scale:2,offset:{x:10,y:5}};
 expect(decorationBounds(d,{image:'x',width:100,height:200,origin:[50,200]})).toEqual({left:-90,right:110,top:-443,bottom:-43});
 const b=decorationBounds(d,{image:'x',width:100,height:200,origin:[50,200],rotation:90});
 expect(b.left).toBeCloseTo(10);expect(b.right).toBeCloseTo(410);expect(b.top).toBeCloseTo(-143);expect(b.bottom).toBeCloseTo(57);
});
it('round-trips exterior scenery in the adventure ZIP with its graphics',async()=>{
 const adventure=parseAdventure({...createAdventure([map()]),maps:[placed()],catalog:[asset]});
 const pack=mapImages({...graphics,objects:{...graphics.objects,[asset.id]:graphics.objects['pixel.desk']}},url=>'asset:'+url);
 const zip=await exportAdventure(adventure,{pack:async()=>pack,blob:async id=>new Blob([readFileSync('static'+id)])});
 const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));expect(restored.adventure).toEqual(adventure);expect(restored.pack.objects[asset.id].image).toMatch(/^asset:/);
});
