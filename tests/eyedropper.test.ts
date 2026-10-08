import {expect,it} from 'vitest';
import {eyedropperPixel,eyedropperLoupePosition} from '../src/lib/workshop/eyedropper';

it('samples the same backing pixel at full, reduced and enlarged display sizes',()=>{
 expect(eyedropperPixel(350,190,{left:10,top:20,width:680,height:430},680,430)).toEqual({x:340,y:170});
 expect(eyedropperPixel(180,105,{left:10,top:20,width:340,height:215},680,430)).toEqual({x:340,y:170});
 expect(eyedropperPixel(690,360,{left:10,top:20,width:1360,height:860},680,430)).toEqual({x:340,y:170});
});
it('rejects outside coordinates and hidden canvases without reading an invalid pixel',()=>{
 const bounds={left:10,top:20,width:340,height:215};
 expect(eyedropperPixel(10,20,bounds,680,430)).toEqual({x:0,y:0});
 expect(eyedropperPixel(349.99,234.99,bounds,680,430)).toEqual({x:679,y:429});
 for(const [x,y] of [[9,20],[350,20],[10,235],[10,19]])expect(eyedropperPixel(x,y,bounds,680,430)).toBeUndefined();
 expect(eyedropperPixel(10,20,{...bounds,width:0},680,430)).toBeUndefined();
});
it('flips the loupe away from the right edge and clamps it at preview corners',()=>{
 expect(eyedropperLoupePosition(100,150,400,300)).toEqual({left:120,top:82});
 expect(eyedropperLoupePosition(390,150,400,300)).toEqual({left:234,top:82});
 expect(eyedropperLoupePosition(1,1,400,300)).toEqual({left:21,top:0});
 expect(eyedropperLoupePosition(390,299,400,300)).toEqual({left:234,top:164});
 expect(eyedropperLoupePosition(30,30,100,100)).toEqual({left:0,top:0});
});
