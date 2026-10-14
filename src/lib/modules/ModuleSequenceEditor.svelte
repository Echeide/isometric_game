<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {Plus,ArrowUp,ArrowDown} from 'lucide-svelte';
 import type {Adventure} from '../demo/adventure';
 import type {ConditionGroup} from '../story/types';
 import {type ContentModule,type ContentModuleType,type ModuleStep} from './types';
 import {createContentModule,MAX_CONTENT_MODULES,contentModuleName} from './content';
 import {moduleSequence,stepModules,reconcileSequence} from './sequence';
 import ConditionEditor from '../story/ConditionEditor.svelte';
 import EntityModules from './EntityModules.svelte';
 let {adventure,modules,sequence,loading=false,onedit,onchange}:{adventure:Adventure;modules:ContentModule[];sequence?:ModuleStep[];loading?:boolean;onedit:(id:string)=>void;onchange:(modules:ContentModule[],sequence:ModuleStep[])=>boolean}=$props();
 const steps=$derived(moduleSequence(modules,sequence));
 const grouped=$derived(steps.length>1);
 let moving=$state(''),destination=$state('');
 function add(type:ContentModuleType,group?:string,otherwise=false){
  const m=createContentModule(type,type==='chat'&&!modules.some(m=>m.id==='chat')?'chat':crypto.randomUUID());
  const flow=group?steps.map(step=>step.id===group?{...step,...(otherwise?{elseModuleIds:[...step.elseModuleIds??[],m.id]}:{moduleIds:[...step.moduleIds,m.id]})}:step):[{kind:'condition' as const,id:crypto.randomUUID(),moduleIds:[m.id]}];
  if(onchange([...modules,m],flow))onedit(m.id);
 }
 function addGroup(){const initial=steps.length?steps:[{kind:'condition' as const,id:crypto.randomUUID(),moduleIds:[]}];onchange(modules,[...initial,{kind:'condition',id:crypto.randomUUID(),moduleIds:[]}]);}
 function removeGroup(id:string){const step=steps.find(s=>s.id===id);if(!step)return;const removed=new Set(stepModules(step));onchange(modules.filter(m=>!removed.has(m.id)),steps.filter(s=>s.id!==id));}
 function editCondition(id:string,when?:ConditionGroup){onchange(modules,steps.map(step=>step.kind==='condition'&&step.id===id?{...step,when}:step));}
 function moveStep(from:number,to:number){const flow=[...steps],step=flow.splice(from,1)[0];flow.splice(to,0,step);onchange(modules,flow);}

 function changeBranch(step:Extract<ModuleStep,{kind:'condition'}>,list:ContentModule[],otherwise=false){
  const old=new Set(otherwise?step.elseModuleIds??[]:step.moduleIds),all=[...modules.filter(m=>!old.has(m.id)),...list];
  const flow=steps.map(s=>s.kind==='condition'&&s.id===step.id?{...s,...(otherwise?{elseModuleIds:list.map(m=>m.id)}:{moduleIds:list.map(m=>m.id)})}:s);
  onchange(all,reconcileSequence(flow,all));
 }
 function branchModules(ids:string[]){return ids.map(id=>modules.find(m=>m.id===id)!);}
 function relocate(){if(!moving||!destination)return;const [id,branch]=destination.split(':');
  const flow=steps.map(step=>({...step,moduleIds:step.moduleIds.filter(id=>id!==moving),...(step.elseModuleIds?{elseModuleIds:step.elseModuleIds.filter(id=>id!==moving)}:{})}));
  const step=flow.find(s=>s.id===id);if(!step)return;if(branch==='else')step.elseModuleIds=[...step.elseModuleIds??[],moving];else step.moduleIds=[...step.moduleIds,moving];onchange(modules,flow);
 }
</script>
<section class="sequence" aria-label={ui.text(grouped?'Grupos de módulos':'Secuencia de módulos')}>
 <p class="hint">{ui.text(grouped?'Los grupos se recorren en orden. Dentro de cada grupo, los módulos se reproducen uno detrás de otro.':'Los módulos se reproducen en orden.')}</p>
 {#each steps as step,index (step.id)}
 <section class:step={grouped} class:conditional={grouped} aria-label={grouped?ui.text('Grupo')+' '+(index+1):ui.text('Módulos')}>
  {#if grouped}<header><strong>{ui.text('Grupo')} {index+1}</strong><div><button aria-label={ui.text('Subir grupo')+' '+(index+1)} disabled={loading||index===0} onclick={()=>moveStep(index,index-1)}><ArrowUp size={15}/></button><button aria-label={ui.text('Bajar grupo')+' '+(index+1)} disabled={loading||index===steps.length-1} onclick={()=>moveStep(index,index+1)}><ArrowDown size={15}/></button></div></header>{/if}
  {#if grouped||step.when?.conditions.length||step.elseModuleIds!==undefined}<details class="requirements" open={!!step.when?.conditions.length}><summary>{ui.text(grouped?'Condiciones del grupo':'Condiciones')} · {ui.text(step.when?.conditions.length?'Solo si se cumplen':'Siempre se reproduce')}</summary>
   <ConditionEditor {adventure} group={step.when} label={ui.text('Condiciones del grupo')+' '+(index+1)} onchange={when=>editCondition(step.id,when)}/>
   <p class="hint">{ui.text('Sin condiciones, el grupo se reproduce siempre.')}</p>
  </details>{/if}
  {#if grouped}<h4>{ui.text('Módulos del grupo')}</h4>{/if}
  <EntityModules modules={branchModules(step.moduleIds)} chats={adventure.chats} {loading} addDisabled={modules.length>=MAX_CONTENT_MODULES} onadd={type=>add(type,step.id)} {onedit} onchange={list=>changeBranch(step,list)}/>
  {#if step.elseModuleIds!==undefined}
   <h4>{ui.text('Si no se cumplen las condiciones')}</h4>
   <EntityModules modules={branchModules(step.elseModuleIds)} chats={adventure.chats} {loading} addDisabled={modules.length>=MAX_CONTENT_MODULES} onadd={type=>add(type,step.id,true)} {onedit} onchange={list=>changeBranch(step,list,true)}/>
  {:else if step.when?.conditions.length}<button class="link" disabled={loading} onclick={()=>onchange(modules,steps.map(s=>s.id===step.id?{...s,elseModuleIds:[]}:s))}>{ui.text('Añadir Si no…')}</button>{/if}
  {#if grouped}<button class="link" disabled={loading} onclick={()=>removeGroup(step.id)}>{ui.text('Eliminar grupo y sus módulos')}</button>{/if}
 </section>
 {:else}<EntityModules modules={[]} chats={adventure.chats} {loading} onadd={type=>add(type)} {onedit} onchange={()=>{}}/>{/each}
 <button class="condition-add" disabled={loading||steps.length>=48} onclick={addGroup}><Plus size={16}/>{ui.text('Añadir grupo')}</button>
 {#if modules.length&&steps.length>1}<details class="organize"><summary>{ui.text('Mover módulos entre grupos')}</summary><label>{ui.text('Módulo')}<select bind:value={moving}><option value="">{ui.text('Selecciona un módulo')}</option>{#each modules as m}<option value={m.id}>{contentModuleName(m,adventure.chats)}</option>{/each}</select></label><label>{ui.text('Destino')}<select bind:value={destination}><option value="">{ui.text('Selecciona un grupo')}</option>{#each steps as s,i}<option value={s.id+':then'}>{ui.text('Grupo')} {i+1}</option>{#if s.elseModuleIds!==undefined}<option value={s.id+':else'}>{ui.text('Grupo')} {i+1} · {ui.text('Si no, reproducir')}</option>{/if}{/each}</select></label><button disabled={loading||!moving||!destination} onclick={relocate}>{ui.text('Mover módulo')}</button></details>{/if}
</section>
<style>
 .sequence{display:flex;flex-direction:column;gap:12px}.hint{font-size:12px;line-height:1.6;color:#62755c;margin:0}.step{padding:10px;border:1px solid #d5dfce;border-radius:10px;background:#fff}.conditional{border-left:4px solid #789557;background:#f4f7ef}.step header{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#35502f;font-size:13px}.step header div{display:flex;gap:5px}button{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid #d5dfce;border-radius:7px;background:white;color:#35502f;font:inherit;font-size:12px;cursor:pointer}button:disabled{opacity:.45;cursor:default}.link{margin-top:8px;font-size:11px;background:transparent;text-align:left}.condition-add{background:#edf3e5}label{display:block;font-size:12px;color:#62755c;margin-top:8px}select{display:block;width:100%;box-sizing:border-box;font:inherit;padding:8px;border:1px solid #d5dfce;border-radius:7px;color:#35502f;background:#fff;margin-top:5px}h4{font-size:12px;color:#35502f;margin:16px 0 0}.requirements{font-size:12px;color:#52694a;margin-top:12px}.requirements summary{cursor:pointer;line-height:1.5}.organize{font-size:12px;color:#62755c}.organize summary{cursor:pointer}.organize button{margin-top:8px}button:focus-visible,select:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
