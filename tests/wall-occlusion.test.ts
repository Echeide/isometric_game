import {expect,it} from 'vitest';
import {prepareWallOcclusion,wallOccludesActor} from '../packages/world/src/wall-occlusion';
import {projectSurface} from '../packages/world/src/elevation';
import type {WorldScene,Wall} from '../packages/world/src/types';
it('fades raised walls when the body overlaps even with feet below the wall base',()=>{
 for(const axis of ['x','y'] as const)for(const level of [-1,0,1,2]){
 const wall:Wall={x:3,y:3,axis,kind:'wall'};
 const scene:WorldScene={id:'test',name:'Test',theme:'office',width:8,height:8,spawn:{x:0,y:0},entities:[],elevations:{'3,3':level}};
 const cell=axis==='x'?{x:3.5,y:2.75}:{x:2.75,y:3.5};
 const w=prepareWallOcclusion(scene,wall);
 expect(wallOccludesActor(w,cell,projectSurface(scene,cell))).toBe(true);
 const front=axis==='x'?{x:3.5,y:3.25}:{x:3.25,y:3.5};
 expect(wallOccludesActor(w,front,projectSurface(scene,front))).toBe(false);
 const outside=axis==='x'?{x:0,y:2}:{x:2,y:0};
 expect(wallOccludesActor(w,outside,projectSurface(scene,outside))).toBe(false);
 }
});
