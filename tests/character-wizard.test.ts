import { describe, expect, it } from 'vitest';
import { animationProgress, invalidateReference, resumeCursor } from '../packages/character-generator/src/wizard';
import { defaultSettings, type ClipInput, type GeneratorSettings } from '../packages/character-generator/src/types';
import { emptyArt } from '../packages/character-generator/src/generation';
import { emptyFrame } from '../packages/character-generator/src/pipeline';
import { saveProject, loadProject } from '../packages/character-generator/src/browser';
const settings = (): GeneratorSettings => ({...defaultSettings(),actions:['idle']});
const clip = (reviewed=false): ClipInput => ({name:'fixture',frames:[emptyFrame(16,16)],sourceFps:1,reviewed});
describe('character wizard',()=>{
 it('counts mirrored views as approved only when their source is approved and respects an independent replacement',()=>{
  const sources={idle:{se:clip(true),ne:clip(),sw:clip()}};
  expect(animationProgress(settings(),sources).map(v=>[v.direction,v.status,v.reflected])).toEqual([
   ['ne','review',false],['se','approved',false],['sw','review',false],['nw','review',true]
  ]);
  expect(animationProgress({...settings(),mirror:false},{idle:{se:clip(true)}}).filter(v=>v.status==='approved')).toHaveLength(1);
 });
 it('resumes a legacy project at the appropriate stage without requiring references for manually imported sources',()=>{
  expect(resumeCursor(settings(),{},emptyArt(),true).step).toBe(1);
  expect(resumeCursor(settings(),{idle:{se:clip()}},emptyArt(),true)).toEqual({step:4,action:'idle',direction:'se'});
  expect(resumeCursor(settings(),{idle:{se:clip(true),ne:clip(true)}},emptyArt(),true).step).toBe(5);
  const art={references:{se:{image:'fixture',prompt:'',model:'manual'}}};
  expect(resumeCursor(settings(),{},art,true).step).toBe(3);
 });
 it('restores valid navigation and rejects stale actions, invalid phases and directions from other profiles',()=>{
  expect(resumeCursor(settings(),{},emptyArt(),true,{step:2,action:'idle',direction:'ne'})).toEqual({step:2,action:'idle',direction:'ne'});
  for(const navigation of [{step:7,action:'idle',direction:'se'},{step:3,action:'run',direction:'se'},{step:4,action:'idle',direction:'e'}])expect(resumeCursor(settings(),{},emptyArt(),true,navigation).step).toBe(1);
  expect(resumeCursor({...settings(),profile:'platformer'}, {},emptyArt(),true).direction).toBe('e');
 });
 it('invalidates only affected approvals and preserves original frames and Piskel edits',()=>{
  const se={...clip(true),edits:[emptyFrame(64,96)]},ne=clip(true),sources={idle:{se,ne}};
  const updated=invalidateReference(sources,'se');
  expect(updated.idle.se?.reviewed).toBe(false);expect(updated.idle.se?.frames).toBe(se.frames);expect(updated.idle.se?.edits).toBe(se.edits);
  expect(updated.idle.ne).toBe(ne);expect(se.reviewed).toBe(true);
 });
 it('round-trips the wizard position in a project ZIP while older ZIPs stay compatible',async()=>{
  const brief={description:'Test',style:'Pixel art',props:'',notes:{}},navigation={step:3 as const,action:'idle',direction:'ne' as const};
  const bytes=await saveProject(settings(),brief,{},emptyArt(),navigation);
  const loaded=await loadProject(new File([new Uint8Array(bytes)],'test.project.zip'));
  expect(loaded.navigation).toEqual(navigation);
  const old=await saveProject(settings(),brief,{});
  expect((await loadProject(new File([new Uint8Array(old)],'old.project.zip'))).navigation).toBeUndefined();
 });
});
