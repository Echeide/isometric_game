import {expect,it} from 'vitest';
import {depthOrder} from '../packages/world/src/depth';
it('places long furniture behind a wall on its front edge despite centre depth',()=>{
 const sofa={x:2,y:2,width:1,height:3};
 const wall={x:3,y:2,width:0,height:1};
 expect(depthOrder([wall,sofa])).toEqual([1,0]);
});
it('places an actor on either side of a wall correctly',()=>{
 const wall={x:3,y:2,width:0,height:1};
 expect(depthOrder([wall,{x:2.4,y:2.4,width:.2,height:.2}])).toEqual([1,0]);
 expect(depthOrder([wall,{x:3.4,y:2.4,width:.2,height:.2}])).toEqual([0,1]);
});
it('preserves chair layers around a seated actor',()=>{
 const seat={x:2,y:2,width:1,height:1};
 expect(depthOrder([{...seat,tie:2},{...seat,tie:0},{x:2.35,y:2.35,width:.3,height:.3,tie:1}])).toEqual([1,2,0]);
});
