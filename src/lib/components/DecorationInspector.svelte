<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import type {MapDecoration} from '@isometrico/world';
 let {value,picking,onchange,onheight,onremove}:{value:MapDecoration;picking:boolean;onchange:(patch:Partial<MapDecoration>)=>void;onheight:()=>void;onremove:()=>void}=$props();
</script>
<p>{ui.text('Decorado exterior: se dibuja detrás del terreno y no bloquea el paso.')}</p>
<label>{ui.text('Nombre')}<input value={value.label} maxlength="120" onchange={e=>onchange({label:e.currentTarget.value})}/></label>
<div class="pair">{#each (['x','y'] as const) as axis}<label>{ui.text(axis==='x'?'Posición X':'Posición Y')}<input type="number" min="-128" max="128" step="1" value={value.position[axis]} onchange={e=>onchange({position:{...value.position,[axis]:e.currentTarget.valueAsNumber}})}/></label>{/each}</div>
<label>{ui.text('Altura de apoyo')}<input type="number" min="-2" max="2" step="1" value={value.baseLevel} onchange={e=>onchange({baseLevel:e.currentTarget.valueAsNumber})}/></label>
<button onclick={onheight}>{ui.text(picking?'Cancelar selección':'Tomar altura del terreno')}</button>
{#if picking}<p>{ui.text('Pulsa una casilla del terreno para tomar su altura.')}</p>{/if}
<label>{ui.text('Escala (%)')}<input type="number" min="5" max="400" value={value.scale*100} onchange={e=>onchange({scale:e.currentTarget.valueAsNumber/100})}/></label>
<div class="pair">{#each (['x','y'] as const) as axis}<label>{ui.text(axis==='x'?'Ajuste horizontal (px)':'Ajuste vertical (px)')}<input type="number" min="-4096" max="4096" value={value.offset[axis]} onchange={e=>onchange({offset:{...value.offset,[axis]:e.currentTarget.valueAsNumber}})}/></label>{/each}</div>
<p>{ui.text('Crea la entrada con «Salidas del mapa» en una casilla libre delante de la puerta.')}</p>
<button class="remove" onclick={onremove}>{ui.text('Eliminar decorado')}</button>
<style>
 label{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:12px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}input{min-width:0;width:100%;box-sizing:border-box;border:1px solid #d8e0ce;border-radius:7px;padding:9px;background:#fff;color:#3e5334}p{font-size:12px;line-height:1.6;color:#65765d}button{font:inherit;font-size:12px;padding:9px;border:1px solid #d8e0ce;border-radius:7px;background:#fffef9;color:#3e5334;cursor:pointer}.remove{color:#a15a48;margin-top:16px}
</style>
