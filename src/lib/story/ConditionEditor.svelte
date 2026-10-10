<script lang="ts">
 import type {Adventure} from '../demo/adventure';
 import {entityModules} from './engine';
 import {entityKey,statusLabels,moduleStatuses,type Condition,type ConditionGroup} from './types';
 let {adventure,group,label,onchange}:{adventure:Adventure;group?:ConditionGroup;label:string;onchange:(g:ConditionGroup|undefined)=>void}=$props();
 let kind=$state<Condition['kind']>('module');
 const objects=$derived((adventure.story?.entities??[]).filter(b=>b.states.length).map(b=>({...b,label:adventure.maps.find(m=>m.id===b.mapId)?.name+' · '+adventure.maps.find(m=>m.id===b.mapId)?.entities.find(e=>e.id===b.entityId)?.label})));
 const modules=$derived(adventure.maps.flatMap(m=>m.entities.flatMap(e=>entityModules(adventure,{mapId:m.id,entityId:e.id}).map(module=>({mapId:m.id,entityId:e.id,moduleId:module.id,label:m.name+' · '+e.label+' · '+module.name})))));
 const events=$derived(adventure.story?.events??[]);
 const items=$derived(adventure.items??[]);
 function first(k:Condition['kind']):Condition|undefined{if(k==='object'&&objects[0])return {kind:k,mapId:objects[0].mapId,entityId:objects[0].entityId,stateId:objects[0].states[0].id};if(k==='module'&&modules[0])return {kind:k,mapId:modules[0].mapId,entityId:modules[0].entityId,moduleId:modules[0].moduleId,status:'completed'};if(k==='event'&&events[0])return {kind:k,eventId:events[0].id,status:'completed'};if(k==='item'&&items[0])return {kind:k,itemId:items[0].id,quantity:1};}
 function change(i:number,c:Condition){onchange({mode:group?.mode??'all',conditions:(group?.conditions??[]).map((old,n)=>n===i?c:old)});}
 function target(i:number,c:Condition,value:string){if(c.kind==='object'){const b=objects.find(b=>entityKey(b)===value);if(b)change(i,{...c,mapId:b.mapId,entityId:b.entityId,stateId:b.states[0].id});}else if(c.kind==='module'){const b=modules.find(b=>JSON.stringify([b.mapId,b.entityId,b.moduleId])===value);if(b)change(i,{...c,mapId:b.mapId,entityId:b.entityId,moduleId:b.moduleId});}}
 function add(){const c=first(kind);if(c)onchange({mode:group?.mode??'all',conditions:[...(group?.conditions??[]),c]});}
</script>
<div class="conditions" aria-label={label} role="group">
 {#if group?.conditions.length}<label>Combinar requisitos<select aria-label={label+' · Combinar requisitos'} value={group.mode} onchange={e=>onchange({...group!,mode:e.currentTarget.value as 'all'|'any'})}><option value="all">Todas deben cumplirse</option><option value="any">Basta con una</option></select></label>{/if}
 {#each group?.conditions??[] as c,i}
 <div class="condition">
 <div class="line"><strong>Requisito {i+1}</strong><button type="button" aria-label={label+' · Eliminar requisito '+(i+1)} onclick={()=>{const conditions=group!.conditions.filter((_,n)=>n!==i);onchange(conditions.length?{...group!,conditions}:undefined);}}>×</button></div>
 {#if c.kind==='object'}<label>Objeto<select value={entityKey(c)} onchange={e=>target(i,c,e.currentTarget.value)}>{#each objects as o}<option value={entityKey(o)}>{o.label}</option>{/each}</select></label><label>Está en el estado<select value={c.stateId} onchange={e=>change(i,{...c,stateId:e.currentTarget.value})}>{#each objects.find(o=>entityKey(o)===entityKey(c))?.states??[] as state}<option value={state.id}>{state.name}</option>{/each}</select></label>
 {:else if c.kind==='module'}<label>Módulo del objeto<select value={JSON.stringify([c.mapId,c.entityId,c.moduleId])} onchange={e=>target(i,c,e.currentTarget.value)}>{#each modules as m}<option value={JSON.stringify([m.mapId,m.entityId,m.moduleId])}>{m.label}</option>{/each}</select></label><label>Progreso<select value={c.status} onchange={e=>change(i,{...c,status:e.currentTarget.value as typeof c.status})}>{#each moduleStatuses as status}<option value={status}>{statusLabels[status]}</option>{/each}</select></label>
 {:else if c.kind==='event'}<label>Evento narrativo<select value={c.eventId} onchange={e=>change(i,{...c,eventId:e.currentTarget.value})}>{#each events as event}<option value={event.id}>{event.name}</option>{/each}</select></label><label>Progreso<select value={c.status} onchange={e=>change(i,{...c,status:e.currentTarget.value as typeof c.status})}>{#each moduleStatuses as status}<option value={status}>{statusLabels[status]}</option>{/each}</select></label>
 {:else}<label>Artículo<select value={c.itemId} onchange={e=>change(i,{...c,itemId:e.currentTarget.value})}>{#each items as item}<option value={item.id}>{item.name}</option>{/each}</select></label><label>Cantidad mínima<input type="number" min="1" max="999999" value={c.quantity} onchange={e=>change(i,{...c,quantity:Math.max(1,Math.floor(+e.currentTarget.value))})}/></label>{/if}
 <label class="check"><input type="checkbox" checked={!!c.not} onchange={e=>change(i,{...c,not:e.currentTarget.checked})}/> Invertir: debe NO cumplirse</label>
 </div>
 {/each}
 {#if !group?.conditions.length}<p>Sin requisitos.</p>{/if}
 <div class="add"><select aria-label={label+' · Tipo de requisito'} bind:value={kind}><option value="module">Progreso de un módulo</option><option value="object">Estado de un objeto</option><option value="item">Artículo en inventario</option><option value="event">Progreso de un evento narrativo</option></select><button type="button" disabled={!first(kind)||(group?.conditions.length??0)>=32} onclick={add}>+ Añadir</button></div>
 {#if !first(kind)}<p>{kind==='event'?'Añade primero un evento narrativo en Guion.':kind==='object'?'Define primero los estados de algún objeto.':kind==='module'?'Añade primero un módulo a un objeto.':'Crea primero un artículo en Inventario.'}</p>{/if}
</div>
<style>
.conditions{font-size:12px}.condition{border:1px solid #dce5d6;background:white;border-radius:8px;padding:10px;margin:10px 0}.line,.add{display:flex;align-items:center;gap:8px}.line{justify-content:space-between}.add{margin:12px 0}.add select{flex:1;min-width:0}.add button{flex-shrink:0}label{display:block;margin:10px 0;color:#62755c}select,input{display:block;box-sizing:border-box;width:100%;margin-top:5px;padding:8px;border:1px solid #d5dfce;border-radius:6px;background:white;color:#35502f;font:inherit}button{border:1px solid #d5dfce;border-radius:6px;padding:8px;background:#edf3e5;color:#35502f;cursor:pointer}button:disabled{opacity:.4;cursor:default}.check{display:flex;align-items:center;gap:6px}.check input{width:15px;margin:0}p{color:#718269;line-height:1.5}select:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
