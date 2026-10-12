import {expect,it} from 'vitest';
import {unzlibSync} from 'fflate';
import {referenceTones,createColorHarmonizer} from '../src/lib/workshop/color-harmony';
import {harmonizedColorsPNG} from '../src/lib/workshop/palette-browser';
import {collectSpriteColors} from '../src/lib/workshop/color-variant';

const frame=(pixels:number[][])=>({width:pixels.length,height:1,data:new Uint8ClampedArray(pixels.flat())});
const luminance=(c:number[])=>.2126*c[0]+.7152*c[1]+.0722*c[2];
const source=frame([[40,30,20,255],[100,90,80,128],[210,200,190,255],[12,34,56,0]]);
const colors=collectSpriteColors([source]);

it('extracts actual tones only from the cropped sprite and ignores transparent backgrounds',()=>{
 const atlas=frame([[255,0,255,255],[15,20,25,255],[90,100,110,255],[210,220,230,255],[0,255,0,0],[255,0,0,255]]),before=atlas.data.slice();
 expect(referenceTones(atlas,[1,0,4,1])).toEqual({dark:[{color:'#0f1419',pixels:1}],mid:[{color:'#5a646e',pixels:1}],light:[{color:'#d2dce6',pixels:1}]});
 expect(atlas.data).toEqual(before);expect(()=>referenceTones(atlas,[5,0,2,1])).toThrow('Recorte');
 expect(referenceTones(frame([[40,50,60,0]]))).toEqual({dark:[],mid:[],light:[]});
 expect(referenceTones(frame([[40,50,60,255]]))).toEqual({dark:[],mid:[{color:'#28323c',pixels:1}],light:[]});
});
it('preserves contrast and source luminance while transferring the reference hue into shadows',()=>{
 const harmonize=createColorHarmonizer(colors,{colors:['#14283c'],strength:100,scope:'shadows'});
 expect(harmonize(210,200,190)).toEqual([210,200,190]);
 const shadow=harmonize(40,30,20);expect(shadow[2]).toBeGreaterThan(shadow[0]);expect(Math.abs(luminance(shadow)-luminance([40,30,20]))).toBeLessThan(.6);
 expect(harmonize(40,30,20)).toEqual(shadow);
});
it('supports gradual strength and all tones without accumulating edits or clipping luminance',()=>{
 const zero=createColorHarmonizer(colors,{colors:['#ff0000'],strength:0,scope:'all'}),half=createColorHarmonizer(colors,{colors:['#ff0000'],strength:50,scope:'all'}),full=createColorHarmonizer(colors,{colors:['#ff0000'],strength:100,scope:'all'});
 for(const c of [[40,30,20],[100,90,80],[210,200,190],[255,255,255],[0,0,0]]){
  expect(zero(c[0],c[1],c[2])).toEqual(c);
  const result=full(c[0],c[1],c[2]),mixed=half(c[0],c[1],c[2]);
  expect(result.every(n=>n>=0&&n<=255)).toBe(true);expect(Math.abs(luminance(result)-luminance(c))).toBeLessThan(.6);
  mixed.forEach((n,i)=>expect(Math.abs(n-(result[i]+c[i])/2)).toBeLessThanOrEqual(1));
 }
 expect(full(210,200,190)).not.toEqual([210,200,190]);
});
it('handles more than 256 source colors and rejects invalid parameters',()=>{
 const source=Array.from({length:1024},(_,i)=>({color:'#'+(i*1237%0xffffff).toString(16).padStart(6,'0'),pixels:1}));
 expect(()=>createColorHarmonizer(source,{colors:['#123456'],strength:65,scope:'all'})).not.toThrow();
 for(const options of [{colors:[],strength:65,scope:'all' as const},{colors:['bad'],strength:65,scope:'all' as const},{colors:['#123456'],strength:NaN,scope:'shadows' as const}])expect(()=>createColorHarmonizer(colors,options)).toThrow('intensidad');
});
it('encodes unchanged geometry and alpha, leaves transparent pixels intact and cancels pending work',async()=>{
 const before=source.data.slice(),harmonize=createColorHarmonizer(colors,{colors:['#14283c'],strength:80,scope:'all'});
 const blob=await harmonizedColorsPNG(source,harmonize),bytes=new Uint8Array(await blob.arrayBuffer());let pixels:Uint8Array|undefined;
 for(let p=8;p<bytes.length;){const size=new DataView(bytes.buffer,p,4).getUint32(0);if(String.fromCharCode(...bytes.subarray(p+4,p+8))==='IDAT')pixels=unzlibSync(bytes.subarray(p+8,p+8+size));p+=size+12;}
 expect([...pixels!.slice(-4)]).toEqual([12,34,56,0]);expect([pixels![4],pixels![8],pixels![12]]).toEqual([255,128,255]);expect(source.data).toEqual(before);
 const controller=new AbortController();controller.abort();await expect(harmonizedColorsPNG(source,harmonize,controller.signal)).rejects.toThrow();
});
