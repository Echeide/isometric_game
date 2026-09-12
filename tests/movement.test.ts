import {expect,it} from 'vitest';
import {advanceRoute} from '../packages/world/src/movement';
import type {Cell,Facing} from '../packages/world/src/types';
function simulate(fps:number){
 const route=Array.from({length:12},(_,i)=>({x:i+1,y:0}));let position:Cell={x:0,y:0},facing:Facing='se';
 for(let n=0;n<fps*2;n++){const moved=advanceRoute(position,route,4.5/fps,facing);position=moved;facing=moved.facing;}
 return position;
}
it('maintains the same speed across tile boundaries at 30, 60 and 120 fps',()=>{
 for(const fps of [30,60,120])expect(simulate(fps).x).toBeCloseTo(9,10);
});
it('spends residual distance around a corner without cutting through it',()=>{
 const route=[{x:1,y:0},{x:1,y:1},{x:2,y:1}];
 const moved=advanceRoute({x:.9,y:0},route,.3,'se');
 expect(moved.x).toBe(1);expect(moved.y).toBeCloseTo(.2);expect(moved.facing).toBe('sw');expect(moved.reached).toEqual({x:1,y:0});
});
it('stops exactly at the destination even after a long frame',()=>{
 const route=[{x:1,y:0}];expect(advanceRoute({x:0,y:0},route,2,'se')).toMatchObject({x:1,y:0,reached:{x:1,y:0}});expect(route).toEqual([]);
});
