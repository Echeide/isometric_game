import {expect,it} from 'vitest';
import {readFile} from 'node:fs/promises';
import type {Wall,WorldScene} from '../packages/world/src/types';
import {parseScene} from '../packages/world/src/scene';
import {canCross,wallBodyHeight,wallEndExposed} from '../packages/world/src/walls';
import {createNavigator,findPath,project} from '../packages/world/src/navigation';
import {wallHeight} from '../packages/world/src/elevation';
import {prepareWallOcclusion,wallOccludesActor} from '../packages/world/src/wall-occlusion';
import {railingArt,railingGroup} from '../packages/world/src/railing-art';
import {changeMapEnvironment} from '../packages/world/src/map-appearance';
import {createAdventure} from '../src/lib/demo/adventure';
import {exportAdventure,unpackAdventure} from '../src/lib/storage/adventure-package';
import {mapImages} from '../src/lib/storage/local-adventures';
import {graphics} from '../src/lib/demo/pixelart';
const base:WorldScene={schemaVersion:1,id:'yard',name:'Terraza',theme:'outdoors',width:4,height:4,spawn:{x:0,y:0},entities:[]};
const rail:Wall={x:2,y:1,axis:'y',kind:'railing',railingStyle:'stone'};
it('accepts both railing styles and rejects door links, unknown styles and style metadata on walls',()=>{
 for(const railingStyle of ['stone','metal'] as const){const scene=parseScene({...base,walls:[{...rail,railingStyle}]});expect(parseScene(JSON.parse(JSON.stringify(scene))).walls).toEqual(scene.walls);}
 expect(()=>parseScene({...base,walls:[{...rail,railingStyle:undefined}]})).not.toThrow();
 for(const w of [{...rail,railingStyle:'wood'},{...rail,kind:'wall'},{...rail,exitId:'exit'},{...rail,x:5}])expect(()=>parseScene({...base,walls:[w]})).toThrow();
});
it('blocks movement across railings in both navigation implementations, while a gap remains usable',()=>{
 const walls=Array.from({length:4},(_,y)=>({...rail,y})),scene=parseScene({...base,walls});
 expect(canCross(scene,{x:1,y:1},{x:2,y:1})).toBe(false);expect(findPath(scene,base.spawn,[{x:3,y:1}])).toBeNull();expect(createNavigator(scene).findPath(base.spawn,[{x:3,y:1}])).toBeNull();
 const gap={...scene,walls:walls.filter(w=>w.y!==2)};expect(findPath(gap,base.spawn,[{x:3,y:1}])).toContainEqual({x:2,y:2});expect(createNavigator(gap).findPath(base.spawn,[{x:3,y:1}])).toContainEqual({x:2,y:2});
});
it('uses exactly half wall height and anchors railings to existing support tiles including lowered boundaries',()=>{
 expect(wallBodyHeight(rail)).toBe(wallBodyHeight({...rail,kind:'wall'})/2);
 const border:Wall={...rail,x:0,y:0,axis:'x'};expect(wallHeight({...base,elevations:{'0,0':-1}},border)).toBe(-24);
 expect(wallHeight({...base,elevations:{'2,1':2}},rail)).toBe(48);expect(wallHeight({...base,tiles:{'1,1':'void'},elevations:{'2,1':-1}},rail)).toBe(-24);
});
it('does not fade short railings when only a full-height wall would overlap the actor',()=>{
 const low=prepareWallOcclusion(base,rail),full=prepareWallOcclusion(base,{...rail,kind:'wall'}),cell={x:1.75,y:1.5};
 const feet={x:low.x+low.dx*.5,y:low.y+low.dy*.5-45};expect(wallOccludesActor(full,cell,feet)).toBe(true);expect(wallOccludesActor(low,cell,feet)).toBe(false);
});
it('keeps taller wall ends exposed next to railings and groups rails by style and support height',()=>{
 const w:Wall={x:0,y:0,axis:'x',kind:'wall'},r:Wall={...rail,x:1,y:0,axis:'x'};expect(wallEndExposed(w,1,[w,r])).toBe(true);
 const next={...r,x:2};expect(railingGroup(base,r,[r,next])).toBe(railingGroup(base,next,[r,next]));
 expect(railingGroup(base,{...next,railingStyle:'metal'},[r,{...next,railingStyle:'metal'}])).not.toBe(railingGroup(base,r,[r,next]));
 expect(railingGroup({...base,elevations:{'2,0':1}},next,[r,next])).not.toBe(railingGroup(base,r,[r,next]));
});
it('renders both styles on both orientations and keeps open holes instead of a solid wall backing',()=>{
 for(const axis of ['x','y'] as const)for(const railingStyle of ['stone','metal'] as const){const w={...rail,axis,railingStyle},view=railingArt(base,w,[w]),bounds=view.getLocalBounds();expect(bounds.width).toBeGreaterThan(30);expect(bounds.height).toBeLessThan(55);expect(bounds.height).toBeGreaterThan(31);const t=railingStyle==='metal'?.42:.5,z=railingStyle==='metal'?20:16,point=project({x:w.x+(axis==='x'?t:0),y:w.y+(axis==='y'?t:0)});expect(view.containsPoint({x:point.x,y:point.y-z})).toBe(false);const cap=project({x:w.x+(axis==='x'?.5:0),y:w.y+(axis==='y'?.5:0)});expect(view.containsPoint({x:cap.x,y:cap.y-28})).toBe(true);view.destroy();}
});
it('preserves authored railings when the map switches between interior and exterior',()=>{
 const interior=changeMapEnvironment({...base,walls:[rail]},'interior');expect(changeMapEnvironment(interior,'exterior').walls).toEqual([rail]);
});
it('round-trips railings and their styles through an adventure ZIP',async()=>{
 const scene=parseScene({...base,walls:[rail,{...rail,x:1,axis:'x',railingStyle:'metal'}]}),adventure=createAdventure([scene]);
 const archive=await exportAdventure(adventure,{pack:async()=>mapImages(graphics,url=>'asset:'+url),blob:async id=>new Blob([new Uint8Array(await readFile('static'+id))])});
 expect(unpackAdventure(new Uint8Array(await archive.arrayBuffer())).adventure.maps[0].walls).toEqual(scene.walls);
});
