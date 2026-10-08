import {describe,expect,it} from 'vitest';
import {createTileBase} from '../src/lib/workshop/tile-base';
import {defaultAdventurePalette} from '../src/lib/demo/adventure-palette';
import {encodePalettePNG} from '../src/lib/workshop/palette-browser';
import {pngSize} from '../src/lib/storage/adventure-package';

describe('new floor base',()=>{
 it('uses an opaque adventure color inside the diamond and transparent corners',()=>{
  const palette=defaultAdventurePalette(),snapshot=structuredClone(palette),frame=createTileBase(palette);
  expect(frame.width).toBe(64);expect(frame.height).toBe(32);
  expect(Array.from(frame.data.subarray((16*64+32)*4,(16*64+32)*4+4))).toEqual([146,149,155,255]);
  for(const index of [0,63,31*64,32*64-1])expect(frame.data[index*4+3]).toBe(0);
  const visible=Array.from({length:64*32},(_,i)=>frame.data[i*4+3]).filter(a=>a===255);
  expect(visible).toHaveLength(1024);
  expect(new Set(Array.from({length:64*32},(_,i)=>frame.data[i*4+3]))).toEqual(new Set([0,255]));
  expect(palette).toEqual(snapshot);
  expect(pngSize(encodePalettePNG(frame))).toEqual({width:64,height:32});
 });
 it('covers the repeated isometric grid exactly once without holes or overlapping opaque pixels',()=>{
  const frame=createTileBase(),coverage=new Uint8Array(256*128);
  for(let a=-5;a<=5;a++)for(let b=-5;b<=5;b++){
   const left=128+(a-b)*32,top=48+(a+b)*16;
   for(let y=0;y<32;y++)for(let x=0;x<64;x++){
    if(!frame.data[(y*64+x)*4+3])continue;
    const px=left+x,py=top+y;
    if(px>=0&&px<256&&py>=0&&py<128)coverage[py*256+px]++;
   }
  }
  for(let y=32;y<96;y++)for(let x=64;x<192;x++)expect(coverage[y*256+x]).toBe(1);
 });
 it('chooses from an imported palette and rejects invalid palettes',()=>{
  const palette=defaultAdventurePalette();palette.colors[4]='#91949a';
  expect(Array.from(createTileBase(palette).data.subarray((16*64+32)*4,(16*64+32)*4+3))).toEqual([145,148,154]);
  expect(()=>createTileBase({...palette,colors:[]})).toThrow();
 });
});
