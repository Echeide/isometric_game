import {expect,it} from 'vitest';
import {terrainTemplate} from '../src/lib/workshop/terrain-template';
import {createTileBase} from '../src/lib/workshop/tile-base';
import {defaultAdventurePalette} from '../src/lib/demo/adventure-palette';
import {terrainMasks} from '../packages/world/src/tile-families';

const palette=defaultAdventurePalette(),source=createTileBase(palette),crop:[number,number,number,number]=[0,0,64,32];
const pixel=(data:Uint8ClampedArray,x:number,y:number)=>Array.from(data.slice((y*64+x)*4,(y*64+x)*4+4));
it('builds all fifteen sidewalk curb pieces with the same full tile and unchanged interior',()=>{
 const before=new Uint8ClampedArray(source.data),images=new Set<string>();
 for(const mask of terrainMasks){
  const piece=terrainTemplate(source,crop,mask,palette,0,'curb');expect([piece.width,piece.height]).toEqual([64,32]);
  expect(pixel(piece.data,32,16)).toEqual(pixel(source.data,32,16));
  for(let i=0;i<piece.data.length;i+=4){expect(piece.data[i+3]).toBe(source.data[i+3]);if(piece.data[i+3])expect(palette.colors).toContain('#'+Array.from(piece.data.slice(i,i+3)).map(n=>n.toString(16).padStart(2,'0')).join(''));}
  images.add(Buffer.from(piece.data).toString('base64'));
 }
 expect(images.size).toBe(15);expect(source.data).toEqual(before);
});
it('draws a curb on the chosen side and leaves the opposite material edge intact',()=>{
 // Midpoints of the four edges, inset to sample the top of the curb.
 const sides=[{bit:1,x:45,y:8},{bit:2,x:45,y:23},{bit:4,x:18,y:23},{bit:8,x:18,y:8}];
 for(const [index,side]of sides.entries()){
  const piece=terrainTemplate(source,crop,side.bit,palette,0,'curb'),opposite=sides[(index+2)%4];
  expect(pixel(piece.data,side.x,side.y)).not.toEqual(pixel(source.data,side.x,side.y));
  expect(pixel(piece.data,opposite.x,opposite.y)).toEqual(pixel(source.data,opposite.x,opposite.y));
 }
 expect(terrainTemplate(source,crop,0,palette,0,'curb').data).toEqual(source.data);
 expect(terrainTemplate(source,crop,15,palette,0,'curb').data).not.toEqual(terrainTemplate(source,crop,15,palette).data);
});
