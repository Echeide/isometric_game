<script lang="ts">
 import {ArrowUp,ArrowDown} from 'lucide-svelte';
 import type {Adventure} from '../demo/adventure';
 import {resolveVisualCatalog} from '@isometrico/world';
 import {behavior,entityModules} from './engine';
 import {eventLabels,type EntityRef,type EntityBehavior,type ObjectState,type StoryReaction,type StoryEffect,type StoryEvent} from './types';
 import ConditionEditor from './ConditionEditor.svelte';
 import EffectsEditor from './EffectsEditor.svelte';
 let {adventure,ref,onchange}:{adventure:Adventure;ref:EntityRef;onchange:(b:EntityBehavior)=>void}=$props();
 const config=$derived(behavior(adventure,ref)??{...ref,states:[],reactions:[]});
 const entity=$derived(adventure.maps.find(m=>m.id===ref.mapId)?.entities.find(e=>e.id===ref.entityId));
 const modules=$derived(entityModules(adventure,ref));
 const visuals=$derived(resolveVisualCatalog(adventure.catalog,adventure.catalogOverrides).filter(v=>v.kind===entity?.kind));
 function patch(values:Partial<EntityBehavior>){onchange({...config,...values});}
 function editState(id:string,values:Partial<ObjectState>){patch({states:config.states.map(s=>s.id===id?{...s,...values}:s)});}
 function addState(){const id=crypto.randomUUID();patch({states:[...config.states,{id,name:'Estado '+(config.states.length+1)}],initialState:config.initialState??id});}
 function removeState(id:string){const states=config.states.filter(s=>s.id!==id);patch({states,initialState:config.initialState===id?states[0]?.id:config.initialState});}
 function defaultEffect():StoryEffect|undefined{const target=adventure.story?.entities.find(b=>b.states.length);if(target)return {kind:'state',mapId:target.mapId,entityId:target.entityId,stateId:target.states[0].id};const item=adventure.items?.[0];if(item)return {kind:'give',itemId:item.id,quantity:1};}
 function addReaction(){const e=defaultEffect();if(e)patch({reactions:[...config.reactions,{id:crypto.randomUUID(),event:'interact',once:true,effects:[e]}]});}
 function moveReaction(from:number,to:number){const reactions=[...config.reactions];const [r]=reactions.splice(from,1);reactions.splice(to,0,r);patch({reactions});}
 function editReaction(id:string,values:Partial<StoryReaction>){patch({reactions:config.reactions.map(r=>r.id===id?{...r,...values}:r)});}
 const booleanValue=(v:boolean|undefined)=>v===undefined?'inherit':v?'yes':'no';
 const booleanFrom=(v:string)=>v==='inherit'?undefined:v==='yes';
</script>
<section class="behavior" aria-label="Condiciones del objeto">
 <p class="intro">Requisitos y consecuencias de este objeto en la partida.</p>
 <details open><summary>Estados del objeto <span>{config.states.length}</span></summary>
 {#if config.states.length}<label>Estado inicial<select value={config.initialState} onchange={e=>patch({initialState:e.currentTarget.value})}>{#each config.states as s}<option value={s.id}>{s.name}</option>{/each}</select></label>{:else}<p>Sin estados propios: se usan las propiedades actuales.</p>{/if}
 {#each config.states as s,i (s.id)}<details class="card" open={i===0}><summary>{s.name}</summary><label>Nombre del estado<input value={s.name} maxlength="80" onchange={e=>editState(s.id,{name:e.currentTarget.value})}/></label><label>Descripción en este estado<textarea rows="2" maxlength="2000" value={s.description??''} placeholder="Usar la descripción del objeto" onchange={e=>editState(s.id,{description:e.currentTarget.value||undefined})}></textarea></label><label>Gráfico<select value={s.visualId??''} onchange={e=>editState(s.id,{visualId:e.currentTarget.value||undefined})}><option value="">Usar gráfico del objeto</option>{#each visuals as v}<option value={v.id}>{v.label}</option>{/each}</select></label>
 {#each [{key:'solid' as const,label:'Bloquea el paso'},{key:'visible' as const,label:'Visible'},{key:'interactive' as const,label:'Permite interacción'}] as field}<label>{field.label}<select value={booleanValue(s[field.key])} onchange={e=>editState(s.id,{[field.key]:booleanFrom(e.currentTarget.value)})}><option value="inherit">Heredar configuración</option><option value="yes">Sí</option><option value="no">No</option></select></label>{/each}
 <button class="delete" onclick={()=>removeState(s.id)}>Eliminar estado</button></details>{/each}
 <button disabled={config.states.length>=16} onclick={addState}>+ Añadir estado</button></details>
 <details><summary>Visibilidad <span>{config.visibility?.conditions.length??0}</span></summary><ConditionEditor {adventure} group={config.visibility} label="Visibilidad" onchange={visibility=>patch({visibility})}/></details>
 <details><summary>Interacción <span>{config.interaction?.conditions.length??0}</span></summary><ConditionEditor {adventure} group={config.interaction} label="Interacción" onchange={interaction=>patch({interaction})}/><label>Mensaje si está bloqueado<input value={config.blockedMessage??''} maxlength="500" placeholder="Todavía no puedes usar este objeto." onchange={e=>patch({blockedMessage:e.currentTarget.value||undefined})}/></label></details>
 <details><summary>Reacciones <span>{config.reactions.length}</span></summary>
 {#if !entity?.interaction}<p>Activa una interacción en Propiedades para ejecutar estas reacciones al usar el objeto.</p>{/if}
 {#each config.reactions as r,i (r.id)}<details class="card" open={i===0}><summary>Reacción {i+1} · {eventLabels[r.event]}</summary><div class="order"><button disabled={i===0} aria-label={"Subir reacción "+(i+1)} title="Subir reacción" onclick={()=>moveReaction(i,i-1)}><ArrowUp size={16}/></button><button disabled={i===config.reactions.length-1} aria-label={"Bajar reacción "+(i+1)} title="Bajar reacción" onclick={()=>moveReaction(i,i+1)}><ArrowDown size={16}/></button></div><label>Cuando<select value={r.event} onchange={e=>{const event=e.currentTarget.value as StoryEvent;editReaction(r.id,{event,moduleId:event==='interact'?undefined:modules[0]?.id});}}><option value="interact">{eventLabels.interact}</option>{#if modules.length}{#each ['module.started','module.completed','module.failed'] as event}<option value={event}>{eventLabels[event as StoryEvent]}</option>{/each}{/if}</select></label>
 {#if r.event!=='interact'}<label>Módulo<select value={r.moduleId} onchange={e=>editReaction(r.id,{moduleId:e.currentTarget.value})}>{#each modules as module}<option value={module.id}>{module.name}</option>{/each}</select></label>{/if}
 <label class="check"><input type="checkbox" checked={r.once} onchange={e=>editReaction(r.id,{once:e.currentTarget.checked})}/> Ejecutar una sola vez</label>
 <details><summary>Si se cumplen estos requisitos</summary><ConditionEditor {adventure} group={r.when} label={'Reacción '+(i+1)} onchange={when=>editReaction(r.id,{when})}/></details>
 <h4>Entonces</h4><EffectsEditor {adventure} effects={r.effects} onchange={effects=>{if(effects.length)editReaction(r.id,{effects});else patch({reactions:config.reactions.filter(v=>v.id!==r.id)});}}/>
 <button class="delete" onclick={()=>patch({reactions:config.reactions.filter(v=>v.id!==r.id)})}>Eliminar reacción</button></details>{/each}
 <button disabled={!defaultEffect()||config.reactions.length>=32} onclick={addReaction}>+ Añadir reacción</button>
 {#if !defaultEffect()}<p>Define un estado de objeto o un artículo de inventario para añadir consecuencias.</p>{/if}
 </details>
 <p class="hint">Los cambios se guardan con la aventura y se pueden deshacer. Prueba el progreso desde la vista previa.</p>
</section>
<style>
.behavior{font-size:12px;color:#35502f}.intro,.hint,p{font-size:12px;color:#718269;line-height:1.6}.intro{margin:4px 0 16px}.hint{font-size:11px;margin-top:20px}details{padding:14px 0;border-top:1px solid #dce5d6}summary{cursor:pointer;font-weight:600;line-height:1.5}summary span{float:right;font-weight:400;border-radius:10px;background:#edf3e5;padding:0 7px}.card{border:1px solid #dce5d6;border-radius:9px;background:white;padding:12px;margin:12px 0}label{display:block;margin:12px 0;color:#62755c}input,select,textarea{display:block;box-sizing:border-box;width:100%;margin-top:5px;border:1px solid #d5dfce;border-radius:6px;padding:8px;background:white;color:#35502f;font:inherit}textarea{resize:vertical}button{padding:9px;border:1px solid #d5dfce;border-radius:7px;background:#edf3e5;color:#35502f;font:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:default}.check{display:flex;align-items:center;gap:8px}.check input{width:15px;margin:0}.order{display:flex;justify-content:flex-end;gap:5px;margin-top:10px}.order button{display:grid;place-items:center;padding:6px}.delete{background:white;color:#a66754}h4{margin:12px 0 4px;font-size:12px}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
