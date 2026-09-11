import {expect,it} from 'vitest';
import {wallEndExposed} from '../packages/world/src/walls';
import type {Wall} from '../packages/world/src/types';
it('exposes the solid jamb at both ends of glass on both wall axes',()=>{
 for(const axis of ['x','y'] as const){
  const a:Wall={x:0,y:0,axis,kind:'wall'};
  const glass:Wall={...a,x:axis==='x'?1:0,y:axis==='y'?1:0,material:'glass'};
  const b:Wall={...a,x:axis==='x'?2:0,y:axis==='y'?2:0};
  const walls=[a,glass,b];
  expect(wallEndExposed(a,1,walls)).toBe(true);
  expect(wallEndExposed(b,0,walls)).toBe(true);
  expect(wallEndExposed(glass,0,walls)).toBe(false);
  expect(wallEndExposed(glass,1,walls)).toBe(false);
  expect(wallEndExposed(a,1,[a,{...glass,material:'white'}])).toBe(false);
  expect(wallEndExposed(glass,1,[glass,{...b,material:'glass'}])).toBe(false);
 }
});
