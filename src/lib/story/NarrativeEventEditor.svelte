<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {Trash2} from 'lucide-svelte';
 import type {Adventure} from '../demo/adventure';
 import EntityModules from '../modules/EntityModules.svelte';
 import {createContentModule} from '../modules/content';
 import type {ContentModuleType} from '../modules/types';
 import type {NarrativeEvent,NarrativeModule} from './types';
 import {narrativeReady} from './narrative';
 import ConditionEditor from './ConditionEditor.svelte';
 import EffectsEditor from './EffectsEditor.svelte';
 let {adventure,event,onchange,onchat,onremove}:{adventure:Adventure;event:NarrativeEvent;onchange:(event:NarrativeEvent)=>void;onchat:(moduleId:string)=>void;onremove:()=>void}=$props();
 let confirmRemove=$state(false);
 function patch(values:Partial<NarrativeEvent>){const next={...event,...values};if(JSON.stringify(next)!==JSON.stringify(event))onchange(next);}
 function add(type:ContentModuleType){const module=createContentModule(type);patch({enabled:false,modules:[...event.modules,module]});onchat(module.id);}
 function updateModules(modules:NarrativeModule[]){const next={...event,modules};onchange({...next,enabled:next.enabled&&narrativeReady(adventure,next)});}
</script>
<section aria-label={ui.text("Configuración del evento narrativo")} class="event-editor">
 <label>{ui.text("Nombre del evento")}<input aria-label={ui.text("Nombre del evento")} maxlength="120" value={event.name} onblur={e=>patch({name:e.currentTarget.value})}/></label>
 <label>{ui.text("Cuándo se ejecuta")}<select aria-label={ui.text("Desencadenante del evento")} value={event.trigger} onchange={e=>patch({trigger:e.currentTarget.value as NarrativeEvent['trigger'],mapId:e.currentTarget.value==='map.enter'?(event.mapId??adventure.startMap):undefined})}><option value="adventure.start">{ui.text("Al iniciar la aventura")}</option><option value="map.enter">{ui.text("Al entrar en un mapa")}</option></select></label>
 {#if event.trigger==='map.enter'}<label>{ui.text("Mapa")}<select aria-label={ui.text("Mapa del evento")} value={event.mapId} onchange={e=>patch({mapId:e.currentTarget.value})}>{#each adventure.maps as map}<option value={map.id}>{map.name}</option>{/each}</select></label>{/if}
 <label class="check"><input type="checkbox" checked={event.enabled} disabled={!narrativeReady(adventure,event)} onchange={e=>patch({enabled:e.currentTarget.checked})}/> {ui.text("Evento activo")}</label>
 <label class="check"><input type="checkbox" checked={event.once} onchange={e=>patch({once:e.currentTarget.checked})}/> {ui.text("Ejecutar una sola vez por partida")}</label>
 {#if !narrativeReady(adventure,event)}<p class="hint">{ui.text("Añade contenido o una consecuencia para activar el evento.")}</p>{/if}
 <details><summary>{ui.text("Requisitos")} <span>{event.when?.conditions.length??0}</span></summary><ConditionEditor {adventure} group={event.when} label={ui.text("Requisitos del evento")} onchange={when=>patch({when})}/></details>
 <section class="modules"><h3>{ui.text("Contenido del evento")}</h3>
 <EntityModules modules={event.modules} chats={adventure.chats} onadd={add} onedit={onchat} onchange={updateModules}/></section>
 <details><summary>{ui.text("Al completar")} <span>{event.effects.length}</span></summary><EffectsEditor {adventure} allowEmpty effects={event.effects} onchange={effects=>{const next={...event,effects};onchange({...next,enabled:next.enabled&&narrativeReady(adventure,next)});}}/></details>
 <p class="hint">{ui.text("Se guarda con la aventura. Reiniciar la partida desde Pruebas permite probar el inicio y los contextos de nuevo.")}</p>
 {#if confirmRemove}<p>{ui.text("¿Eliminar este evento del guion?")}</p><div class="add"><button onclick={onremove}>{ui.text("Eliminar")}</button><button onclick={()=>confirmRemove=false}>{ui.text("Cancelar")}</button></div>{:else}<button class="delete" onclick={()=>confirmRemove=true}><Trash2 size={15}/> {ui.text("Eliminar evento…")}</button>{/if}
</section>
<style>
 .event-editor{font-size:12px;color:#35502f}label{display:block;margin:12px 0;color:#62755c}input,select{display:block;box-sizing:border-box;width:100%;margin-top:5px;padding:8px;border:1px solid #d5dfce;border-radius:7px;background:#fff;font:inherit;color:#35502f}.check{display:flex;align-items:center;gap:8px}.check input{width:16px;margin:0}details{margin:14px 0;padding:12px 0;border-top:1px solid #dce5d6}summary{cursor:pointer;font-weight:600}summary span{float:right;color:#73836a}.hint{font-size:11px;line-height:1.6;color:#718269}.modules{margin-top:20px}h3{font-size:13px}.add{display:flex;align-items:center;gap:6px;margin:12px 0}button{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:7px 9px;border:1px solid #d5dfce;border-radius:7px;background:#edf3e5;color:#35502f;font:inherit;cursor:pointer;flex:none}button:disabled,input:disabled{opacity:.45;cursor:default}.delete{color:#a66754;background:#fff;margin-top:12px}input:focus-visible,select:focus-visible:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
