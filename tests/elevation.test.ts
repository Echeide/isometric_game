import {expect,it} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {findPath} from '../packages/world/src/navigation';
import {canCross} from '../packages/world/src/walls';
import {surfaceHeight,projectSurface,topContains,wallHeight,stairDirections} from '../packages/world/src/elevation';
import {depthOrder,insertMovingDepth} from '../packages/world/src/depth';
import {paintTiles} from '../src/lib/demo/editor';
import type {WorldScene,Facing} from '../packages/world/src/types';
const base:WorldScene={schemaVersion:1,id:'levels',name:'Levels',theme:'outdoors',width:5,height:5,spawn:{x:0,y:2},entities:[]};
it('preserves flat legacy maps and serializes height data',()=>{
 expect(surfaceHeight(base,{x:2,y:2})).toBe(0);
 const raised=paintTiles(base,[{x:3,y:2}],'height:2');expect(raised.elevations?.['3,2']).toBe(2);
 expect(parseScene(JSON.parse(JSON.stringify(raised)))).toEqual(raised);expect(base.elevations).toBeUndefined();
 expect(paintTiles(raised,[{x:3,y:2}],'height:0').elevations).toEqual({});
});
it.each(Object.keys(stairDirections) as Facing[])('connects both ways only along %s stairs',direction=>{
 const a={x:2,y:2},d=stairDirections[direction],b={x:a.x+d.x,y:a.y+d.y},entry={x:a.x-d.x,y:a.y-d.y};
 const scene={...base,elevations:{[`${b.x},${b.y}`]:1},stairs:{'2,2':direction}};
 expect(canCross(scene,a,b)).toBe(true);expect(canCross(scene,b,a)).toBe(true);expect(canCross(scene,entry,a)).toBe(true);
 expect(canCross(scene,a,{x:a.x+d.y,y:a.y+d.x})).toBe(false);
 expect(findPath(scene,entry,[b])).toEqual([a,b]);
 expect(canCross({...scene,stairs:{}},a,b)).toBe(false);
 expect(canCross({...scene,elevations:{[`${b.x},${b.y}`]:2}},a,b)).toBe(false);
});
it('walls still block stairs and doors allow passage',()=>{
 const scene:WorldScene={...base,stairs:{'2,2':'se'},elevations:{'3,2':1},walls:[{x:3,y:2,axis:'y',kind:'wall'}]};
 expect(canCross(scene,{x:2,y:2},{x:3,y:2})).toBe(false);
 expect(canCross({...scene,walls:[{...scene.walls![0],kind:'door'}]},{x:2,y:2},{x:3,y:2})).toBe(true);
 expect(wallHeight(scene,scene.walls![0])).toBe(24);
});
it('validates height range and protects furniture support',()=>{
 for(const n of [-3,.5,3,NaN])expect(()=>parseScene({...base,elevations:{'2,2':n}})).toThrow();
 expect(()=>parseScene({...base,stairs:{'2,2':'bad'}})).toThrow();
 const furniture:WorldScene={...base,entities:[{id:'t',kind:'table',label:'Mesa',position:{x:2,y:2},size:{x:2,y:1}}]};
 expect(()=>paintTiles(furniture,[{x:2,y:2}],'height:1')).toThrow('suelo plano');
 expect(()=>paintTiles(furniture,[{x:2,y:2}],'stairs:se')).toThrow('suelo plano');
 expect(paintTiles(furniture,[{x:2,y:2},{x:3,y:2}],'height:1').entities).toHaveLength(1);
});
it('removes height and stairs when erasing a tile',()=>{
 const raised:WorldScene={...base,elevations:{'2,2':1},stairs:{'2,2':'se'}};
 const next=paintTiles(raised,[{x:2,y:2}],'void');expect(next.elevations).toEqual({});expect(next.stairs).toEqual({});
});
it('projects elevated platforms and stair movement continuously',()=>{
 const scene:WorldScene={...base,stairs:{'2,2':'se'},elevations:{'3,2':1}};
 expect(surfaceHeight(scene,{x:2.25,y:2.5})).toBe(6);
 expect(surfaceHeight(scene,{x:2.75,y:2.5})).toBe(18);
 expect(surfaceHeight(scene,{x:3,y:2.5})).toBe(24);
 const p=projectSurface(scene,{x:3.5,y:2.5});expect(topContains(scene,{x:3,y:2},p)).toBe(true);
 expect(topContains(scene,{x:3,y:2},{x:p.x,y:p.y+24})).toBe(false);
});
it('draws every supporting tile before furniture spanning several tiles',()=>{
 const items=[{x:0,y:0,width:3,height:1},{x:0,y:0,width:1,height:1,floor:true},{x:1,y:0,width:1,height:1,floor:true},{x:2,y:0,width:1,height:1,floor:true}];
 expect(depthOrder(items).at(-1)).toBe(0);
});

it('supports both underground levels and stairs through zero',()=>{
 const low=paintTiles(base,[{x:1,y:2},{x:2,y:2}],'height:-2');
 expect(surfaceHeight(low,{x:1.5,y:2.5})).toBe(-48);
 const mid=paintTiles(low,[{x:3,y:2}],'height:-1');
 const joined=paintTiles(mid,[{x:2,y:2}],'stairs:se');
 expect(findPath(joined,{x:1,y:2},[{x:3,y:2}])).toEqual([{x:2,y:2},{x:3,y:2}]);
 const toZero=paintTiles(joined,[{x:3,y:2}],'stairs:se');
 expect(findPath(toZero,{x:1,y:2},[{x:4,y:2}])).not.toBeNull();
 expect(projectSurface(low,{x:1.5,y:2.5}).y).toBe(112);
});

it('keeps a moving actor above its floor and behind a foreground platform',()=>{
 const floors=[{x:2,y:2,width:1,height:1,floor:true},{x:3,y:2,width:1,height:1,floor:true}];
 expect(insertMovingDepth(floors,depthOrder(floors),{x:2.35,y:2.35,width:.3,height:.3})).toEqual([0,2,1]);
});
