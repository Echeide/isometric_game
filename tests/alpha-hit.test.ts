import {it,expect} from 'vitest';
import {alphaHitArea,footprintHitArea} from '../packages/world/src/alpha-hit';
const mask={width:4,height:2,alpha:new Uint8Array([0,255,255,0,0,40,255,0])};
it('passes clicks through padding, gaps and shadows but keeps solid pixels clickable',()=>{
 const hit=alphaHitArea(mask,{width:40,height:20,origin:[20,20]});
 expect(hit.contains(-19,-19)).toBe(false);
 expect(hit.contains(-5,-15)).toBe(true);
 expect(hit.contains(-5,-5)).toBe(false);
 expect(hit.contains(5,-5)).toBe(true);
 expect(hit.contains(20,0)).toBe(false);
});

it('covers the complete isometric footprint without extending beyond it',()=>{
 const oneCell=footprintHitArea();
 expect(oneCell.contains(0,16)).toBe(true);
 expect(oneCell.contains(31,16)).toBe(true);
 expect(oneCell.contains(32,0)).toBe(false);
 expect(oneCell.contains(0,33)).toBe(false);

 const wide=footprintHitArea({x:2,y:1});
 expect(wide.contains(48,24)).toBe(true);
 expect(wide.contains(65,32)).toBe(false);
});
it('accounts for horizontal reflection and atlas frame offsets',()=>{
 const item={width:20,height:20,origin:[10,20] as [number,number],frame:[1,0,2,2] as [number,number,number,number]};
 expect(alphaHitArea(mask,item).contains(-5,-5)).toBe(false);
 expect(alphaHitArea(mask,item,true).contains(-5,-5)).toBe(true);
 expect(alphaHitArea(mask,item,true).contains(5,-5)).toBe(false);
});
