import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {defaultAdventurePalette} from '../src/lib/demo/adventure-palette';
import {adaptFrameToColors} from '../src/lib/workshop/palette';
import {validateEditorPalette,validateEditorPixels,editorRevision} from '../src/lib/workshop/image-edit';
import {encodePalettePNG} from '../src/lib/workshop/palette-browser';
import {unzlibSync} from 'fflate';

const context={window:{} as {IsometricoPalette:{validate:typeof validateEditorPalette;createMapper:(palette:{name:string;colors:string[]})=>(pixels:Uint32Array)=>void}}};
runInNewContext(readFileSync('vendor/piskel/palette.js','utf8'),context);
const native=context.window.IsometricoPalette;

it('uses the same color matching in Piskel and the workshop across alpha values and frame boundaries',()=>{
 const palette=defaultAdventurePalette(),data=new Uint8ClampedArray(8192*4);
 let seed=123456;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}
 const original=new Uint8ClampedArray(data),expected=adaptFrameToColors({width:128,height:64,data},palette);
 const pixels=new Uint32Array(data.buffer.slice(0)),map=native.createMapper(palette);
 map(pixels.subarray(0,4096));map(pixels.subarray(4096));
 expect(new Uint8ClampedArray(pixels.buffer)).toEqual(expected.data);expect(data).toEqual(original);
});

it('preserves transparent RGB and partial alpha while adapting each layer independently',()=>{
 const palette={name:'Dos colores',colors:['#000000','#ffffff']},map=native.createMapper(palette);
 const colors=new Uint8ClampedArray([1,2,3,0,254,254,254,1,1,1,1,128,128,128,128,255]);
 const pixels=new Uint32Array(colors.buffer.slice(0));map(pixels);
 const result=new Uint8ClampedArray(pixels.buffer);
 expect(Array.from(result)).toEqual([1,2,3,0,255,255,255,1,0,0,0,128,255,255,255,255]);
 expect(Array.from(colors)).toEqual([1,2,3,0,254,254,254,1,1,1,1,128,128,128,128,255]);
});

it('validates palettes consistently without changing the shared adventure palette',()=>{
 const palette=defaultAdventurePalette(),before=structuredClone(palette);
 expect(native.validate(palette)).toEqual(validateEditorPalette(palette));
 for(const invalid of [null,{name:'',colors:['#123456']},{name:'x',colors:[]},{name:'x',colors:['#ABCDEF','#abcdef']},{name:'x',colors:['rgba(0,0,0,0)']},{name:'x',colors:Array.from({length:257},(_,i)=>'#'+i.toString(16).padStart(6,'0'))}]){
  expect(()=>native.validate(invalid as any)).toThrow();expect(()=>validateEditorPalette(invalid)).toThrow();
 }
 const copy=native.validate(palette);copy.colors[0]='#abcdef';expect(palette).toEqual(before);
});

it('loads the palette adapter before the bridge and serves the matching vendored helper',()=>{
 expect(readFileSync('static/tools/piskel/palette.js','utf8')).toBe(readFileSync('vendor/piskel/palette.js','utf8'));
 for(const file of ['static/tools/piskel/index.html','scripts/vendor-piskel.mjs']){
  const source=readFileSync(file,'utf8');expect(source.indexOf(`palette.js?v=${editorRevision}`)).toBeLessThan(source.indexOf(`bridge.js?v=${editorRevision}`));expect(source).toContain(`palette.js?v=${editorRevision}`);
 }
});

it('retains exact palette RGB at alpha 1, validates transferred pixels and encodes straight RGBA',()=>{
 const source=new Uint8ClampedArray([32,32,43,1,255,0,255,255]),frame=validateEditorPixels(source,{width:2,height:1});
 source[0]=0;expect(frame.data[0]).toBe(32);
 const png=encodePalettePNG(frame);let p=8,idat:Uint8Array|undefined;
 while(p<png.length){const n=new DataView(png.buffer,p,4).getUint32(0);if(String.fromCharCode(...png.subarray(p+4,p+8))==='IDAT')idat=png.subarray(p+8,p+8+n);p+=n+12;}
 expect(Array.from(unzlibSync(idat!))).toEqual([0,32,32,43,1,255,0,255,255]);
 expect(()=>validateEditorPixels(new Uint8Array(8),{width:2,height:1})).toThrow('píxeles');
 expect(()=>validateEditorPixels(source,{width:3,height:1})).toThrow('píxeles');
});
