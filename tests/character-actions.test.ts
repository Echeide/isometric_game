import { describe, expect, it } from 'vitest';
import { defaultSettings, availableActions, selectedActions, type ClipInput } from '../packages/character-generator/src/types';
import { buildCharacter, emptyFrame, missingSources, validateSettings } from '../packages/character-generator/src/pipeline';
import { workflowTasks } from '../packages/character-generator/src/workflow';
import { createPrompts } from '../packages/character-generator/src/prompts';
import { imagePlan, pngUrl, shortActionRecipe } from '../packages/character-generator/src/generation';
import { validateVideoRequest } from '../packages/character-generator/src/video';
import { loadProject, saveProject } from '../packages/character-generator/src/browser';
const brief = { description: 'Bear', style: 'Pixel art', props: '', notes: {} };
function clip(): ClipInput {
 const frame = emptyFrame(16,16);
 for(let y=2;y<14;y++)for(let x=5;x<11;x++)frame.data.set([60,90,80,255],(y*16+x)*4);
 return {frames:[frame],sourceFps:1,name:'fixture',reviewed:true};
}
describe('selected character actions',()=>{
 it('keeps old profile defaults and existing eight-direction recipes',()=>{
  expect(selectedActions(defaultSettings()).map(a=>a.action)).toEqual(['idle','walk','work','talk','celebrate','sit']);
  expect(selectedActions({...defaultSettings(),profile:'iso-eight'}).map(a=>a.action)).toEqual(['idle','walk','run','attack']);
  expect(availableActions('iso-eight').find(a=>a.action==='attack')?.fps).toBe(8);
 });
 it('builds only the selected actions and completes without requiring unselected sources',()=>{
  const settings={...defaultSettings(),actions:['walk','hurt'],background:null,outline:false};
  const sources={walk:{se:clip(),ne:clip()},hurt:{se:clip(),ne:clip()},sit:{se:clip()}};
  expect(missingSources(settings,sources)).toEqual([]);
  expect(workflowTasks(settings,sources,{references:{}},false)).toEqual([]);
  const result=buildCharacter(settings,sources);
  expect(result.sheets.map(s=>[s.action,s.frames])).toEqual([['walk',8],['hurt',3]]);
  expect(Object.keys(result.character.animations)).toEqual(['walk','hurt']);
  expect(result.metadata.settings.actions).toEqual(['walk','hurt']);
  expect(()=>buildCharacter({...settings,actions:['walk','hurt','attack']},sources)).toThrow('attack');
  expect(()=>buildCharacter(settings,sources,['idle'])).toThrow('desconocidas');
 });
 it('keeps prompts and pending tasks aligned with selection',()=>{
  const settings={...defaultSettings(),actions:['attack','run']};
  expect(new Set(workflowTasks(settings,{}, {references:{}},false).map(t=>t.action))).toEqual(new Set(['attack','run']));
  const prompts=createPrompts(brief,'game',true,settings.actions);
  expect(prompts).toHaveLength(2);
  expect(prompts[0].clips.map(c=>c.action)).toEqual(['attack','run']);
  expect(prompts[0].clips[0].prompt).toContain('complete attack');
 });
 it('accepts new video actions and routes three-frame damage to the image provider',()=>{
  const bytes=new Uint8Array(32);bytes.set([137,80,78,71,13,10,26,10]);
  const view=new DataView(bytes.buffer);view.setUint32(12,0x49484452);view.setUint32(16,512);view.setUint32(20,768);
  const reference=pngUrl(bytes);
  for(const action of ['attack','run']) expect(validateVideoRequest({requestId:'11111111-1111-4111-8111-111111111111',projectId:'bear',profile:'game',action,direction:'se',reference,prompt:'Move',negative:''}).action).toBe(action);
  expect(shortActionRecipe('game','hurt')?.frames).toBe(3);
  const plan=imagePlan({brief,profile:'game',action:'hurt',direction:'se',kind:'action',quality:'low',reference,referenceDirection:'se'});
  expect(plan.frames).toBe(3);expect(plan.prompt).toContain('React to one hit');
 });
 it('round-trips selection in projects and rejects invalid lists',async()=>{
  const settings={...defaultSettings(),actions:['hurt','attack']};
  const bytes=await saveProject(settings,brief,{});
  const restored=await loadProject(new File([new Uint8Array(bytes)],'bear.project.zip'));
  expect(restored.settings.actions).toEqual(['hurt','attack']);
  for(const actions of [[],['no-such-action'],['walk','walk']])expect(()=>validateSettings({...settings,actions})).toThrow('acción válida');
 });
});
