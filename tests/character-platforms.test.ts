import { describe, expect, it } from 'vitest';
import { actionRecipe, defaultSettings, selectedActions, type ClipInput, type GeneratorSettings } from '../packages/character-generator/src/types';
import { bounds, buildCharacter, emptyFrame, missingSources, selectSequence, validateSettings } from '../packages/character-generator/src/pipeline';
import { extractFrames } from '../packages/character-generator/src/pixel-edit';
import { createPrompts } from '../packages/character-generator/src/prompts';
import { imagePlan, pngUrl, validateImageRequest } from '../packages/character-generator/src/generation';
import { workflowTasks } from '../packages/character-generator/src/workflow';
import { spriteManifest } from '../packages/character-generator/src/sprite-export';
import { exportCharacter, loadProject, saveProject } from '../packages/character-generator/src/browser';
import { validateVideoRequest } from '../packages/character-generator/src/video';
const brief={description:'Robot',style:'Pixel art',props:'',notes:{}};
const config = ():GeneratorSettings => ({...defaultSettings(),profile:'platformer',actions:['jump'],background:null,outline:false,targetHeight:40});
function pose(lift=0,fallen=false){
 const f=emptyFrame(64,96);
 for(let y=80-lift-(fallen?8:40);y<80-lift;y++)for(let x=24;x<(fallen?56:40);x++)f.data.set([70,120,90,255],(y*64+x)*4);
 return f;
}
const clip=(frames=[pose(),pose(5),pose(10),pose(20)]):ClipInput=>({frames,sourceFps:8,name:'fixture'});
const png=()=>{const b=new Uint8Array(32);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(12,0x49484452);v.setUint32(16,512);v.setUint32(20,768);return pngUrl(b);};

describe('platform sprites',()=>{
 it('requires only right and left, starts with right, and accepts left as a mirror or an independent source',()=>{
  const s=config();expect(missingSources(s,{jump:{e:clip()}})).toEqual([]);
  expect(missingSources({...s,mirror:false},{jump:{e:clip()}})).toEqual(['jump/W']);
  expect(workflowTasks(s,{}, {references:{}},true)[0]).toEqual({action:'jump',direction:'e',step:'reference'});
  const built=buildCharacter(s,{jump:{e:clip()}});
  expect(built.sheets[0].directions).toEqual(['e','w']);expect(built.sheets[0].loops.w?.mirroredFrom).toBe('e');
  expect(buildCharacter(s,{jump:{e:clip(),w:clip()}}).sheets[0].loops.w?.mirroredFrom).toBeUndefined();
 });
 it('samples the full one-shot including the final pose, even if an earlier segment could loop',()=>{
  const frames=[pose(),pose(5),pose(),pose(5),pose(),pose(20)];
  expect(selectSequence(frames,8,4).indices).toEqual([0,2,3,5]);
  expect(selectSequence(frames,8,3,[1,5]).indices).toEqual([1,3,4]);
  expect(()=>selectSequence(frames,8,4,[2,7])).toThrow('intervalo');
  const sheet=buildCharacter(config(),{jump:{e:clip(frames)}}).sheets[0];
  expect(sheet.loops.e?.indices.at(-1)).toBe(5);expect(sheet.playback).toBe('once');
 });
 it('preserves vertical motion even when foot stabilization is enabled',()=>{
  const result=buildCharacter({...config(),stabilize:true},{idle:{e:clip([pose()])},jump:{e:clip()}});
  const frames=extractFrames(result.sheets[0].image,64,96,4);
  expect(frames.map(f=>bounds(f)?.bottom)).toEqual([79,74,69,59]);
  expect(result.metadata.warnings.some(w=>w.includes('desplazamiento'))).toBe(true);
 });
 it('retains fallen proportions and the final death pose using the idle scale',()=>{
  const s={...config(),actions:['die'],actionOptions:{die:{frames:2}}};
  const result=buildCharacter(s,{idle:{e:clip([pose()])},die:{e:clip([pose(),pose(0,true)])}});
  const frames=extractFrames(result.sheets[0].image,64,96,2);
  expect(bounds(frames[0])?.height).toBe(40);expect(bounds(frames[1])?.height).toBe(8);
  expect(bounds(frames[1])?.bottom).toBe(79);
 });
 it('exports relative PNG paths, exact cells, per-view speed, pivot and one-shot behavior',()=>{
  const s={...config(),actionOptions:{jump:{frames:3,fps:12}}};
  const result=buildCharacter(s,{jump:{e:clip()}}), manifest=spriteManifest(result);
  expect(manifest.projection).toBe('side');expect(manifest.anchor).toEqual([32,80]);
  expect(manifest.animations.jump.image).toBe('jump.png');expect(manifest.animations.jump.loop).toBe(false);
  expect(manifest.animations.jump.views.w).toEqual({row:1,fps:12,frames:[{x:0,y:96,width:64,height:96},{x:64,y:96,width:64,height:96},{x:128,y:96,width:64,height:96}]});
  expect(()=>spriteManifest(buildCharacter(s,{jump:{e:clip()}},['jump'],['e']))).toThrow('orientaciones');
 });
 it('uses lateral cameras and one-shot prompts consistently for references, image actions and video',()=>{
  const options={jump:{frames:3,fps:10,playback:'once' as const}};
  const prompts=createPrompts(brief,'platformer',true,['jump'],'video',options);
  expect(prompts.map(p=>p.direction)).toEqual(['e']);
  expect(prompts[0].still).toContain('side-view');expect(prompts[0].still).not.toContain('isometric');
  expect(prompts[0].clips[0].prompt).toContain('Do not loop');expect(prompts[0].clips[0].prompt).not.toContain('exact starting pose');
  const request={brief,profile:'platformer' as const,action:'jump',direction:'e' as const,kind:'action' as const,quality:'low' as const,reference:png(),referenceDirection:'e' as const,recipe:options.jump};
  const plan=imagePlan(request);expect(plan.frames).toBe(3);expect(plan.prompt).toContain('side-view');expect(plan.prompt).toContain('Do not loop');expect(plan.prompt).not.toContain('isometric');
  expect(()=>validateImageRequest({...request,recipe:{frames:5}})).toThrow('1 y 4');
  expect(()=>validateImageRequest({...request,recipe:{frames:-1}})).toThrow('Ajustes');
  expect(validateVideoRequest({requestId:'11111111-1111-4111-8111-111111111111',projectId:'robot',profile:'platformer',action:'die',direction:'e',reference:png(),prompt:'Fall',negative:''}).action).toBe('die');
 });
 it('round-trips optional settings and loads legacy projects without changing old action defaults',async()=>{
  const s={...config(),exportFormat:'generic' as const,actionOptions:{jump:{frames:3,fps:9,playback:'once' as const}}};
  const file=await saveProject(s,brief,{});
  const restored=await loadProject(new File([new Uint8Array(file)],'robot.project.zip'));
  expect(restored.settings).toEqual(s);expect(selectedActions(restored.settings)[0].frames).toBe(3);
  const old=await saveProject(defaultSettings(),brief,{});
  const legacy=await loadProject(new File([new Uint8Array(old)],'old.project.zip'));
  expect(selectedActions(legacy.settings).every(r=>r.playback==='loop')).toBe(true);
  expect(actionRecipe('game','walk')?.frames).toBe(8);
  for(const actionOptions of [{jump:{frames:17}},{jump:{fps:0}},{jump:{playback:'invalid'}},{unknown:{frames:2}}])expect(()=>validateSettings({...s,actionOptions} as unknown as GeneratorSettings)).toThrow();
 });
 it('does not export platform assets as the game character contract',async()=>{
  const result=buildCharacter(config(),{jump:{e:clip()}});
  await expect(exportCharacter(result,brief,'game')).rejects.toThrow('genérica');
 });
});
