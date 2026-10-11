<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {Plus,Link,Settings2} from 'lucide-svelte';
 import type {Adventure} from '$lib/demo/adventure';
 let {adventure,mapId,destination=$bindable(''),expanded=$bindable(false),onopen,onplace,oncreate,onselect}:{adventure:Adventure;mapId:string;destination?:string;expanded?:boolean;onopen:()=>void;onplace:()=>void;oncreate:()=>void;onselect:(id:string)=>void}=$props();
 const targets=$derived(adventure.maps.filter(m=>m.id!==mapId)),exits=$derived(adventure.exits.filter(e=>e.fromMap===mapId));
 const validTarget=$derived(targets.some(m=>m.id===destination));
</script>
<section class="map-exits" aria-label={ui.text("Salidas del mapa")}>
 <div class="heading"><h3><Link size={15}/>{ui.text("Salidas del mapa")}</h3><button type="button" class="add" aria-expanded={expanded} onclick={()=>{if(expanded)expanded=false;else onopen();}}><Plus size={14}/>{ui.text("Añadir salida")}</button></div>
 {#if expanded}
  {#if targets.length}
   <label>{ui.text("Mapa destino")}<select aria-label={ui.text("Destino de la nueva salida")} bind:value={destination}><option value="">{ui.text("Elegir destino…")}</option>{#each targets as map}<option value={map.id}>{map.name}</option>{/each}</select></label>
   <p>{ui.text("Elige el destino y pulsa una casilla libre para colocar la salida.")}</p>
   <div class="actions"><button type="button" class="place" disabled={!validTarget} onclick={onplace}>{ui.text("Colocar salida")}</button><button type="button" onclick={()=>expanded=false}>{ui.text("Cancelar")}</button></div>
  {:else}
   <p>{ui.text("Necesitas otro mapa en esta aventura para añadir una salida.")}</p><button type="button" class="place" onclick={oncreate}><Plus size={14}/>{ui.text("Crear mapa destino")}</button>
  {/if}
 {:else if !exits.length}<p>{ui.text("Todavía no hay salidas en este mapa.")}</p>{/if}
 {#if exits.length}<div class="connections">{#each exits as exit}<button type="button" aria-label={ui.text("Editar salida hacia {arg0}",{arg0:adventure.maps.find(m=>m.id===exit.toMap)?.name??''})} onclick={()=>onselect(exit.entityId)}><Link size={14}/><span>{adventure.maps.find(m=>m.id===exit.toMap)?.name}</span><Settings2 size={14}/></button>{/each}</div>{/if}
</section>
<style>
 .map-exits{display:grid;gap:8px;margin:14px 0;padding:12px 0;border-top:1px solid #e2e8dd;border-bottom:1px solid #e2e8dd;color:#3c5135}.heading{display:flex;align-items:center;justify-content:space-between;gap:8px}h3{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;margin:0}button{display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid #dce5d6;border-radius:6px;padding:7px 8px;font:inherit;font-size:11px;color:inherit;background:#fffef9;cursor:pointer}.add{flex:none;background:#edf3e5}.add[aria-expanded=true]{border-color:#789557}.place{background:#476238;color:white;border-color:#476238}.actions{display:flex;gap:6px}.place:disabled{opacity:.45;cursor:default}p{font-size:11px;line-height:1.5;color:#718269;margin:0}label{display:grid;gap:6px;font-size:11px;color:#718269;margin:3px 0}select{width:100%;box-sizing:border-box;padding:8px;border:1px solid #dce5d6;border-radius:6px;color:#3c5135;background:white;font:inherit;font-size:12px}.connections{display:grid;gap:5px}.connections button{justify-content:flex-start;text-align:left}.connections span{flex:1;overflow-wrap:anywhere}button:focus-visible,select:focus-visible{outline:2px solid #74994e;outline-offset:2px}
</style>
