<script lang="ts">
 import {Plus,Trash2,ArrowUp,ArrowDown,Pencil} from 'lucide-svelte';
 import type {Adventure} from '../demo/adventure';
 import {chatResource} from '../chat/editor';
 import type {NarrativeEvent,NarrativeModule} from './types';
 import {narrativeReady,narrativeModuleLabels} from './narrative';
 import ConditionEditor from './ConditionEditor.svelte';
 import EffectsEditor from './EffectsEditor.svelte';
 let {adventure,event,onchange,onchat,onremove}:{adventure:Adventure;event:NarrativeEvent;onchange:(event:NarrativeEvent)=>void;onchat:(moduleId:string)=>void;onremove:()=>void}=$props();
 let moduleType=$state<'context'|'chat'>('context'),confirmRemove=$state(false);
 function patch(values:Partial<NarrativeEvent>){const next={...event,...values};if(JSON.stringify(next)!==JSON.stringify(event))onchange(next);}
 function module(id:string,values:Record<string,string>){patch({modules:event.modules.map(m=>m.id===id?{...m,...values}:m) as NarrativeModule[]});}
 function add(){const id=crypto.randomUUID();patch({enabled:false,modules:[...event.modules,moduleType==='context'?{id,type:'context',title:'Contexto',text:''}:{id,type:'chat',...(adventure.chats?.[0]?{resourceId:chatResource(adventure.chats[0].id)}:{})}]});}
 function move(from:number,to:number){const modules=[...event.modules],[m]=modules.splice(from,1);modules.splice(to,0,m);patch({modules});}
 function removeModule(id:string){const next={...event,modules:event.modules.filter(m=>m.id!==id)};onchange({...next,enabled:next.enabled&&narrativeReady(adventure,next)});}
</script>
<section aria-label="Configuración del evento narrativo" class="event-editor">
 <label>Nombre del evento<input aria-label="Nombre del evento" maxlength="120" value={event.name} onblur={e=>patch({name:e.currentTarget.value})}/></label>
 <label>Cuándo se ejecuta<select aria-label="Desencadenante del evento" value={event.trigger} onchange={e=>patch({trigger:e.currentTarget.value as NarrativeEvent['trigger'],mapId:e.currentTarget.value==='map.enter'?(event.mapId??adventure.startMap):undefined})}><option value="adventure.start">Al iniciar la aventura</option><option value="map.enter">Al entrar en un mapa</option></select></label>
 {#if event.trigger==='map.enter'}<label>Mapa<select aria-label="Mapa del evento" value={event.mapId} onchange={e=>patch({mapId:e.currentTarget.value})}>{#each adventure.maps as map}<option value={map.id}>{map.name}</option>{/each}</select></label>{/if}
 <label class="check"><input type="checkbox" checked={event.enabled} disabled={!narrativeReady(adventure,event)} onchange={e=>patch({enabled:e.currentTarget.checked})}/> Evento activo</label>
 <label class="check"><input type="checkbox" checked={event.once} onchange={e=>patch({once:e.currentTarget.checked})}/> Ejecutar una sola vez por partida</label>
 {#if !narrativeReady(adventure,event)}<p class="hint">Añade contenido o una consecuencia para activar el evento.</p>{/if}
 <details><summary>Requisitos <span>{event.when?.conditions.length??0}</span></summary><ConditionEditor {adventure} group={event.when} label="Requisitos del evento" onchange={when=>patch({when})}/></details>
 <section class="modules"><h3>Contenido del evento</h3>
 <div class="add"><select aria-label="Tipo de módulo del evento" bind:value={moduleType}><option value="context">Contexto</option><option value="chat">Conversación</option></select><button disabled={event.modules.length>=16} onclick={add}><Plus size={15}/> Añadir</button></div>
 {#each event.modules as m,i (m.id)}<details class="module" open={i===0}><summary>{i+1}. {m.type==='context'?m.title:narrativeModuleLabels.chat}</summary><div class="order"><button disabled={i===0} aria-label={'Subir módulo '+(i+1)} onclick={()=>move(i,i-1)}><ArrowUp size={15}/></button><button disabled={i===event.modules.length-1} aria-label={'Bajar módulo '+(i+1)} onclick={()=>move(i,i+1)}><ArrowDown size={15}/></button><button aria-label={'Eliminar módulo '+(i+1)} onclick={()=>removeModule(m.id)}><Trash2 size={15}/></button></div>
 {#if m.type==='context'}<label>Título<input aria-label={'Título de contexto '+(i+1)} value={m.title} maxlength="120" onblur={e=>module(m.id,{title:e.currentTarget.value})}/></label><label>Texto<textarea aria-label={'Texto de contexto '+(i+1)} rows="6" maxlength="12000" value={m.text} onblur={e=>module(m.id,{text:e.currentTarget.value})} placeholder="Explica dónde está el jugador y qué está ocurriendo…"></textarea></label>
 {:else}<label>Conversación<select aria-label={'Conversación del evento '+(i+1)} value={m.resourceId??''} onchange={e=>module(m.id,{resourceId:e.currentTarget.value})}><option value="" disabled>Elige o crea una conversación…</option>{#each adventure.chats??[] as chat}<option value={chatResource(chat.id)}>{chat.name}</option>{/each}</select></label><button data-event-chat={m.id} onclick={()=>onchat(m.id)}><Pencil size={15}/>{m.resourceId?'Editar conversación':'Crear conversación'}</button>{/if}
 </details>{:else}<p class="hint">Los módulos se muestran en orden. Sin módulos, el evento solo ejecuta sus consecuencias.</p>{/each}</section>
 <details><summary>Al completar <span>{event.effects.length}</span></summary><EffectsEditor {adventure} allowEmpty effects={event.effects} onchange={effects=>{const next={...event,effects};onchange({...next,enabled:next.enabled&&narrativeReady(adventure,next)});}}/></details>
 <p class="hint">Se guarda con la aventura. Reiniciar la partida desde Pruebas permite probar el inicio y los contextos de nuevo.</p>
 {#if confirmRemove}<p>¿Eliminar este evento del guion?</p><div class="add"><button onclick={onremove}>Eliminar</button><button onclick={()=>confirmRemove=false}>Cancelar</button></div>{:else}<button class="delete" onclick={()=>confirmRemove=true}><Trash2 size={15}/> Eliminar evento…</button>{/if}
</section>
<style>
 .event-editor{font-size:12px;color:#35502f}label{display:block;margin:12px 0;color:#62755c}input,select,textarea{display:block;box-sizing:border-box;width:100%;margin-top:5px;padding:8px;border:1px solid #d5dfce;border-radius:7px;background:#fff;font:inherit;color:#35502f}textarea{resize:vertical}.check{display:flex;align-items:center;gap:8px}.check input{width:16px;margin:0}details{margin:14px 0;padding:12px 0;border-top:1px solid #dce5d6}summary{cursor:pointer;font-weight:600}summary span{float:right;color:#73836a}.hint{font-size:11px;line-height:1.6;color:#718269}.modules{margin-top:20px}h3{font-size:13px}.module{border:1px solid #dce5d6;border-radius:9px;background:#fff;padding:12px}.order,.add{display:flex;align-items:center;gap:6px;margin:12px 0}.order{justify-content:flex-end}.add select{margin:0;flex:1;min-width:0}button{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:7px 9px;border:1px solid #d5dfce;border-radius:7px;background:#edf3e5;color:#35502f;font:inherit;cursor:pointer;flex:none}button:disabled,input:disabled{opacity:.45;cursor:default}.delete{color:#a66754;background:#fff;margin-top:12px}input:focus-visible,select:focus-visible,textarea:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
