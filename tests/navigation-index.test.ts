import {expect,it} from 'vitest';
import {createNavigator,findPath,walkable,neighbors,cellKey} from '../packages/world/src/navigation';
import {canCross} from '../packages/world/src/walls';
import type {Cell,WorldScene} from '../packages/world/src/types';
function reference(scene:WorldScene,start:Cell){
 const reached=new Set<string>(),queue=[start];
 if(!walkable(scene,start))return reached;
 reached.add(cellKey(start));
 for(let i=0;i<queue.length;i++)for(const next of neighbors(queue[i]))if(!reached.has(cellKey(next))&&walkable(scene,next)&&canCross(scene,queue[i],next)){reached.add(cellKey(next));queue.push(next);}
 return reached;
}
it('indexed navigation agrees with collision rules across obstacles, voids, walls and levels',()=>{
 for(let seed=0;seed<12;seed++){
  const scene:WorldScene={schemaVersion:1,id:'test',name:'Test',theme:'outdoors',width:8,height:8,spawn:{x:0,y:0},entities:[],blocked:[],elevations:{'5,5':1},stairs:{'4,5':'se'},walls:[{x:3,y:2,axis:'x',kind:'wall'},{x:3,y:3,axis:'y',kind:'door'}],tiles:{'2,2':'void'}};
  for(let x=1;x<8;x++)for(let y=1;y<8;y++)if((x*13+y*7+seed)%9===0)scene.blocked!.push({x,y});
  const index=createNavigator(scene),reached=reference(scene,scene.spawn);
  expect(index.reachableFrom(scene.spawn)).toEqual(reached);
  for(const target of [{x:7,y:7},{x:5,y:5},{x:0,y:0}]){
   const path=index.findPath(scene.spawn,[target]);expect(path!==null).toBe(reached.has(cellKey(target)));
   if(path){let previous=scene.spawn;for(const cell of path){expect(walkable(scene,cell)&&canCross(scene,previous,cell)).toBe(true);previous=cell;}expect(previous).toEqual(target);}
  }
 }
});
it('fresh searches observe editor changes without a stale collision cache',()=>{
 const scene:WorldScene={schemaVersion:1,id:'a',name:'A',theme:'outdoors',width:3,height:1,spawn:{x:0,y:0},entities:[]};
 expect(findPath(scene,scene.spawn,[{x:2,y:0}])).toHaveLength(2);
 scene.blocked=[{x:1,y:0}];expect(findPath(scene,scene.spawn,[{x:2,y:0}])).toBeNull();
});
