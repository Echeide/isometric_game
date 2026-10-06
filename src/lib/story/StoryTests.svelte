<script lang="ts">
 import type {Adventure} from '../demo/adventure';
 import type {InventoryProgress} from '../demo/inventory';
 import {behavior,entityModules,objectState,moduleStatus,availability,matches} from './engine';
 import {statusLabels,moduleStatuses,eventLabels,entityKey,reactionKey,type EntityRef,type ModuleStatus,type StoryProgress,type Condition} from './types';
 let {adventure,progress,inventory,onstate,onmodule,onitem}:{adventure:Adventure;progress:StoryProgress;inventory:InventoryProgress;onstate:(ref:EntityRef,state:string)=>void;onmodule:(ref:EntityRef,module:string,status:ModuleStatus,reactions:boolean)=>void;onitem:(item:string,quantity:number)=>void}=$props();
 let trigger=$state(false);
 const entries=$derived(adventure.maps.flatMap(map=>map.entities.filter(e=>behavior(adventure,{mapId:map.id,entityId:e.id})||entityModules(adventure,{mapId:map.id,entityId:e.id}).length).map(e=>({ref:{mapId:map.id,entityId:e.id},name:e.label,map:map.name}))));
 function describe(c:Condition){if(c.kind==='item')return (adventure.items?.find(i=>i.id===c.itemId)?.name??c.itemId)+' ≥ '+c.quantity;const name=adventure.maps.find(m=>m.id===c.mapId)?.entities.find(e=>e.id===c.entityId)?.label??c.entityId;return name+' · '+(c.kind==='module'?(entityModules(adventure,c).find(m=>m.id===c.moduleId)?.name??c.moduleId)+' · '+statusLabels[c.status]:behavior(adventure,c)?.states.find(s=>s.id===c.stateId)?.name??c.stateId);}
</script>
<section class="story-tests" aria-label="Pruebas de condiciones">
 <h3>Objetos y módulos</h3><p>Simula el progreso de esta partida. La configuración inicial de la aventura se conserva.</p>
 <label class="check"><input type="checkbox" bind:checked={trigger}/> Ejecutar reacciones al simular cambios de módulos</label><p class="hint">Desactivado: solo cambia el estado. Activado: aplica las consecuencias del evento; respeta «una sola vez».</p>
 {#each entries as entry (entityKey(entry.ref))}{@const b=behavior(adventure,entry.ref)}{@const v=availability(adventure,progress,inventory,entry.ref)}
 <details class="card"><summary>{entry.name}<small>{entry.map} · {v.visible?'Visible':'Oculto'} · {v.interactive?'Interacción habilitada':'Interacción bloqueada'}</small></summary>
 {#if b?.states.length}<label>Estado del objeto<select aria-label={'Estado de '+entry.name} value={objectState(adventure,progress,entry.ref)} onchange={e=>onstate(entry.ref,e.currentTarget.value)}>{#each b.states as s}<option value={s.id}>{s.name}</option>{/each}</select></label>{/if}
 {#each entityModules(adventure,entry.ref) as module}<label>{module.name}<select aria-label={'Progreso de '+entry.name+' · '+module.name} value={moduleStatus(progress,entry.ref,module.id)} onchange={e=>onmodule(entry.ref,module.id,e.currentTarget.value as ModuleStatus,trigger)}>{#each moduleStatuses as s}<option value={s}>{statusLabels[s]}</option>{/each}</select></label>{/each}
 {#each [{name:'Visibilidad',group:b?.visibility},{name:'Interacción',group:b?.interaction},...(b?.reactions??[]).map((r,i)=>({name:'Reacción '+(i+1),group:r.when}))] as section}{#if section.group?.conditions.length}<h4>{section.name} · {section.group.mode==='all'?'Todas':'Alguna'}</h4><ul>{#each section.group.conditions as c}<li class:passed={matches(adventure,progress,inventory,c)}>{matches(adventure,progress,inventory,c)?'✓':'✕'} {c.not?'NO: ':''}{describe(c)}</li>{/each}</ul>{/if}{/each}
 {#if !v.interactive}<p>{v.message}</p>{/if}
 {#each b?.reactions??[] as r,i}<p class="hint">Reacción {i+1} · {eventLabels[r.event]} · {r.once?(progress.fired.includes(reactionKey(entry.ref,r.id))?'Ya ejecutada':'Pendiente, una sola vez'):'Se puede repetir'}</p>{/each}
 </details>{:else}<p>No hay estados ni módulos configurados.</p>{/each}
 {#if adventure.items?.length}<details><summary>Inventario de prueba</summary>{#each adventure.items as item}<label>{item.name}<input aria-label={'Cantidad de '+item.name} type="number" min="0" max="999999" value={inventory.counts[item.id]??0} onchange={e=>onitem(item.id,Math.max(0,Math.floor(+e.currentTarget.value)))}/></label>{/each}</details>{/if}
</section>
<style>
.story-tests{margin-top:24px}.story-tests p{line-height:1.5;color:#607168}.hint{font-size:12px}.card{margin:10px 0;padding:12px;border:1px solid #dce5d6;border-radius:8px}summary{cursor:pointer;font-weight:600}small{display:block;margin-top:5px;color:#697768;font-size:11px;font-weight:400}label{display:block;margin:12px 0;font-size:13px}select,input{width:100%;box-sizing:border-box;display:block;padding:9px;margin-top:5px;border:1px solid #ccd9c4;border-radius:6px;background:white;font:inherit;color:#35502f}.check{display:flex;gap:8px;align-items:center}.check input{width:16px;margin:0}h3{font-size:16px}h4{font-size:12px;margin:14px 0 5px}ul{list-style:none;padding:0;margin:0}li{font-size:12px;color:#a34736;line-height:1.5;margin:6px 0}.passed{color:#355e33}select:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
