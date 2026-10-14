import type {ContentModule,ModuleStep} from './types';
import type {Adventure} from '../demo/adventure';
import type {EntityRef,StoryProgress} from '../story/types';
import type {InventoryProgress} from '../demo/inventory';
import {allows,behavior} from '../story/engine';
import {objectContentModules} from './adventure-modules';
/** Old per-module conditions become visible blocks without rewriting saved adventures. */
export function moduleSequence(modules:ContentModule[],saved?:ModuleStep[]):Extract<ModuleStep,{kind:'condition'}>[] {
 const raw=saved??modules.map(m=>m.when?{kind:'condition' as const,id:'condition-'+m.id,when:m.when,moduleIds:[m.id]}:{kind:'module' as const,moduleId:m.id});
 const groups:Extract<ModuleStep,{kind:'condition'}>[]= [],usedIds=new Set(raw.flatMap(step=>step.kind==='condition'?[step.id]:[]));let previousModule=false;
 for(const step of raw){
  if(step.kind==='condition'){groups.push(step);previousModule=false;}
  else {if(previousModule)groups[groups.length-1].moduleIds.push(step.moduleId);else {const base='group-'+step.moduleId;let id=base,suffix=1;while(usedIds.has(id))id=base+'-'+suffix++;usedIds.add(id);groups.push({kind:'condition',id,moduleIds:[step.moduleId]});}previousModule=true;}
 }
 return groups;
}
export function stepModules(step:ModuleStep){return step.kind==='module'?[step.moduleId]:[...step.moduleIds,...step.elseModuleIds??[]];}
export function validateModuleSequence(flow:unknown,modules:ContentModule[]):asserts flow is ModuleStep[]{
 if(!Array.isArray(flow)||flow.length>48)throw Error('La secuencia admite hasta 48 pasos.');
 const ids=new Set(modules.map(m=>m.id)),used=new Set<string>(),blocks=new Set<string>();
 for(const step of flow){
  if(!step||!['module','condition'].includes(step.kind))throw Error('Paso de secuencia no válido.');
  if(step.kind==='condition'){
   if(typeof step.id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(step.id)||blocks.has(step.id))throw Error('Bloque de condición no válido.');blocks.add(step.id);
   if(!Array.isArray(step.moduleIds)||step.elseModuleIds!==undefined&&!Array.isArray(step.elseModuleIds))throw Error('Módulos del bloque no válidos.');
  }
  for(const id of stepModules(step)){if(!ids.has(id)||used.has(id))throw Error('Cada módulo debe aparecer una sola vez en la secuencia.');used.add(id);}
 }
 if(used.size!==ids.size)throw Error('Faltan módulos en la secuencia.');
}
export function eligibleSequence(a:Adventure,p:StoryProgress,i:InventoryProgress,ref:EntityRef){
 const modules=objectContentModules(a,ref),flow=moduleSequence(modules,behavior(a,ref)?.moduleSequence);
 return flow.flatMap(step=>{
  const ids=allows(a,p,i,step.when)?step.moduleIds:step.elseModuleIds??[];
  return ids.map(id=>modules.find(m=>m.id===id)!);
 });
}
/** Once entered, finish a block's chosen branch before evaluating later blocks. */
export function nextSequenceModule(a:Adventure,p:StoryProgress,i:InventoryProgress,ref:EntityRef,id:string){
 const modules=objectContentModules(a,ref),flow=moduleSequence(modules,behavior(a,ref)?.moduleSequence),index=flow.findIndex(step=>stepModules(step).includes(id));
 if(index<0)return;
 const step=flow[index];
 if(step.kind==='condition'){
  const branch=step.moduleIds.includes(id)?step.moduleIds:step.elseModuleIds??[],next=branch[branch.indexOf(id)+1];
  if(next)return modules.find(m=>m.id===next);
 }
 for(const step of flow.slice(index+1)){
  const ids=allows(a,p,i,step.when)?step.moduleIds:step.elseModuleIds??[];
  if(ids.length)return modules.find(m=>m.id===ids[0]);
 }
}
/** Removing content also removes dangling references, retaining empty authored blocks. */
export function reconcileSequence(flow:ModuleStep[],modules:ContentModule[]):ModuleStep[]{
 const ids=new Set(modules.map(m=>m.id)),next:ModuleStep[]=flow.flatMap<ModuleStep>(step=>step.kind==='module'?ids.has(step.moduleId)?[step]:[]:[{...step,moduleIds:step.moduleIds.filter(id=>ids.has(id)),...(step.elseModuleIds?{elseModuleIds:step.elseModuleIds.filter(id=>ids.has(id))}:{})}]);
 const used=new Set(next.flatMap(stepModules));return [...next,...modules.filter(m=>!used.has(m.id)).map(m=>({kind:'module' as const,moduleId:m.id}))];
}
