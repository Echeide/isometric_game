import {describe,expect,it} from 'vitest';
import {bounds,buildCharacter,emptyFrame,normalizeOriginal,planCharacter,validateSettings} from '../packages/character-generator/src/pipeline';
import {defaultSettings,type Frame,type GeneratorSettings,type RGB,type Sources} from '../packages/character-generator/src/types';
import {loadProject,saveProject} from '../packages/character-generator/src/browser';
import {originalBytes,validateOriginal} from '../packages/character-generator/src/originals';

function sprite(color:RGB=[220,160,80], factor=1):Frame {
  const frame=emptyFrame(64*factor,96*factor);
  for(let y=40*factor;y<80*factor;y++)for(let x=24*factor;x<40*factor;x++)frame.data.set([...color,255],(y*frame.width+x)*4);
  return frame;
}
const clip=(color?:RGB)=>({name:'test',frames:[sprite(color)],sourceFps:8,range:[0,1] as [number,number]});
const settings=():GeneratorSettings=>({...defaultSettings(),background:null,outline:false,actions:['idle','walk']});
describe('project palette and original resolution',()=>{
  it('keeps reviewed view pixels identical when exporting additional actions and orientations',()=>{
    const config=settings(), sources:Sources={idle:{ne:clip([80,90,140]),se:clip()},walk:{ne:clip([10,180,70]),se:clip([200,20,90])}};
    const initial=buildCharacter(config,sources,['idle'],['se']);
    config.palette=initial.metadata.processingPalette;
    const preview=buildCharacter(config,sources,['idle'],['se']);
    const full=buildCharacter(config,sources);
    const sheet=full.sheets.find(s=>s.action==='idle')!;
    const start=sheet.directions.indexOf('se')*config.height*sheet.image.width*4;
    expect(sheet.image.data.slice(start,start+preview.sheets[0].image.data.length)).toEqual(preview.sheets[0].image.data);
    expect(full.metadata.processingPalette).toEqual(config.palette);
  });
  it('preserves Piskel colors even outside the fixed palette',()=>{
    const config=settings();config.palette=[[0,0,0],[255,255,255]];
    const edit=sprite([10,240,33]);
    const result=buildCharacter(config,{idle:{se:{...clip(),edits:Array.from({length:4},()=>edit)}}},['idle'],['se']);
    expect(result.metadata.palette).toContainEqual([10,240,33]);
    expect(result.metadata.processingPalette).toEqual(config.palette);
    for(let y=0;y<96;y++)expect(result.sheets[0].image.data.slice(y*256*4,(y*256+64)*4)).toEqual(edit.data.slice(y*64*4,(y+1)*64*4));
  });
  it.each(['area','nearest'] as const)('uses initial cell, stature, anchor and per-view correction with %s',resampling=>{
    const config:GeneratorSettings={...settings(),width:80,height:120,targetHeight:64,anchor:[40,100],resampling};
    const sources:Sources={idle:{se:{...clip(),scaleBias:1.25,offset:[3,-2]}}};
    const plan=planCharacter(config,sources,['idle'],['se']);
    const transform=plan.prepared[0].transforms[0];
    const small=normalizeOriginal(sprite(),config,transform), large=normalizeOriginal(sprite(undefined,8),config,transform);
    expect(large.frame.data).toEqual(small.frame.data);
    expect([large.frame.width,large.frame.height]).toEqual([80,120]);
    expect(bounds(large.frame)).toMatchObject({height:80,bottom:97,center:43});
  });
  it('nearest preserves source colors and honors the configured destination',()=>{
    const original=sprite();for(let i=0;i<original.data.length;i+=8)if(original.data[i+3])original.data.set([20,40,60],i);
    const output=normalizeOriginal(original,{...settings(),resampling:'nearest'},{scale:.7,footX:32,footY:80,sampleWidth:64,sampleHeight:96}).frame;
    const colors=new Set<string>();for(let i=0;i<output.data.length;i+=4)if(output.data[i+3])colors.add([...output.data.slice(i,i+3)].join(','));
    expect([...colors].sort()).toEqual(['20,40,60','220,160,80']);
  });
  it('round-trips fixed palette and scaling while accepting old projects without either new option',async()=>{
    for(const config of [{...settings(),palette:[[10,20,30],[100,120,140]] as RGB[],resampling:'nearest' as const},{...settings(),paletteMode:undefined,resampling:undefined}]){
      const bytes=await saveProject(config,{description:'test',style:'pixel art',props:'',notes:{}},{});
      const loaded=await loadProject(new File([new Uint8Array(bytes)],'test.zip'));
      expect(loaded.settings).toEqual(config);
    }
  });
  it('rejects malformed palette and source descriptors',()=>{
    for(const palette of [[],[[256,0,0]],[[0,0]],[[NaN,0,0]]])expect(()=>validateSettings({...settings(),palette:palette as RGB[]})).toThrow('Paleta');
    const file=new Blob(['original']);
    expect(()=>validateOriginal({kind:'sheet',files:[file],columns:2,rows:1,row:1},2)).toThrow('Cuadrícula');
    expect(()=>validateOriginal({kind:'images',files:[file]},2)).toThrow('Fuente');
    expect(()=>validateOriginal({kind:'video',files:[file],start:-1},1)).toThrow('Inicio');
    expect(originalBytes({idle:{se:{...clip(),original:{kind:'images',files:[file]}}}})).toBe(file.size);
  });
});
