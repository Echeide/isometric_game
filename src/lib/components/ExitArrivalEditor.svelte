<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';
 import {exitArrival,type Adventure,type MapExit} from '$lib/demo/adventure';
 const ui=interfaceLanguage();
 let {adventure,exit,onchange,onpick}:{adventure:Adventure;exit:MapExit;onchange:(values:Partial<MapExit>)=>void;onpick:()=>void}=$props();
 const destination=$derived(exitArrival(adventure,exit));
 const mode=$derived(destination.entity?'entity:'+destination.entity.id:destination.mode);
 const entrances=$derived(destination.map.entities.filter(e=>e.interaction?.action==='adventure.exit'||e.id===exit.destinationEntityId));
 function choose(value:string){
  const common={arrival:{...destination.cell},destinationEntityId:undefined};
  if(value==='spawn')onchange({...common,arrivalMode:'spawn',arrival:{...destination.map.spawn}});
  else if(value==='position')onchange({...common,arrivalMode:'position'});
  else{const entity=entrances.find(e=>'entity:'+e.id===value);if(entity)onchange({arrivalMode:undefined,destinationEntityId:entity.id,arrival:{...entity.position}});}
 }
 function coordinate(axis:'x'|'y',input:HTMLInputElement){onchange({arrivalMode:'position',destinationEntityId:undefined,arrival:{...destination.cell,[axis]:input.valueAsNumber}});input.value=String(destination.cell[axis]);}
</script>
<label>{ui.text('Llegar a')}<select aria-label={ui.text('Tipo de llegada')} value={mode} onchange={e=>choose(e.currentTarget.value)}><option value="spawn">{ui.text('Entrada del mapa')}</option>{#each entrances as entity}<option value={'entity:'+entity.id}>{ui.text('Salida vinculada')}: {entity.label}</option>{/each}<option value="position">{ui.text('Casilla fija')}</option></select></label>
<div class="pair"><label>{ui.text('Llegada X')}<input type="number" min="0" max={destination.map.width-1} value={destination.cell.x} disabled={mode!=='position'} onchange={e=>coordinate('x',e.currentTarget)}/></label><label>{ui.text('Llegada Y')}<input type="number" min="0" max={destination.map.height-1} value={destination.cell.y} disabled={mode!=='position'} onchange={e=>coordinate('y',e.currentTarget)}/></label></div>
<p>{#if destination.mode==='entity'}{ui.text('La llegada sigue la posición actual de la salida vinculada.')}{:else if destination.mode==='spawn'}{ui.text('La llegada se actualiza al cambiar la entrada del mapa destino.')}{:else}{ui.text('Esta casilla permanece fija aunque muevas la entrada del mapa.')}{/if}</p>
<button type="button" onclick={onpick}>{ui.text('Elegir casilla fija en el mapa')}</button>
<style>
 label{display:grid;gap:6px;font-size:12px;color:#718269;margin:14px 0 6px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}input,select{width:100%;box-sizing:border-box;border:1px solid #dce5d6;border-radius:6px;background:white;padding:9px;font-size:12px;color:#3c5135}input:disabled{background:#eef2e9;color:#718269}p{font-size:11px;line-height:1.5;color:#718269;margin:8px 0}button{padding:8px;border:1px solid #dce5d6;border-radius:6px;font-size:12px;color:#52664a}
</style>
