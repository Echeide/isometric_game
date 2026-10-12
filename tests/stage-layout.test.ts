import {expect,it} from 'vitest';
import {stageLayout} from '../src/lib/workshop/stage-layout';
import {graphics} from '../src/lib/demo/pixelart';
import {supportOrigin} from '../src/lib/workshop/resources';

it.each([{x:1,y:1},{x:30,y:25},{x:64,y:1},{x:1,y:64},{x:64,y:64}])('fits the complete floor and building for footprint %o',size=>{
 const item={image:'building.png',width:1500,height:1000,rotation:15,origin:supportOrigin({width:1500,height:1000,rotation:15},size)};
 const view=stageLayout(size,item,graphics.character,2);
 expect(view.columns).toBeGreaterThanOrEqual(size.x+2);expect(view.rows).toBeGreaterThanOrEqual(size.y+2);
 const points=[[0,0],[view.columns*32,view.columns*16],[-view.rows*32,view.rows*16],[(view.columns-view.rows)*32,(view.columns+view.rows)*16]];
 const a=15*Math.PI/180;
 for(const x of [-item.origin[0],item.width-item.origin[0]])for(const y of [-item.origin[1],item.height-item.origin[1]])points.push([x*Math.cos(a)-y*Math.sin(a),32+x*Math.sin(a)+y*Math.cos(a)]);
 for(const [x,y]of points){expect(view.x+x*view.scale).toBeGreaterThanOrEqual(31.99);expect(view.x+x*view.scale).toBeLessThanOrEqual(648.01);expect(view.y+y*view.scale).toBeGreaterThanOrEqual(39.99);expect(view.y+y*view.scale).toBeLessThanOrEqual(390.01);}
 expect(stageLayout(size,item,graphics.character,4).scale).toBeCloseTo(view.scale*2);
});

it('bounds transient input while a footprint field is being edited',()=>{
 for(const x of [undefined,NaN,Infinity,-1,0,10000]){
  const view=stageLayout({x:x as number,y:30},undefined,graphics.character,2);
  expect(view.columns).toBeGreaterThanOrEqual(4);expect(view.columns).toBeLessThanOrEqual(66);expect(Number.isFinite(view.scale+view.x+view.y)).toBe(true);
 }
});
