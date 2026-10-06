<script lang="ts">
 import type {Adventure} from '../demo/adventure';
 import {entityKey,type StoryEffect} from './types';
 let {adventure,effects,onchange}:{adventure:Adventure;effects:StoryEffect[];onchange:(effects:StoryEffect[])=>void}=$props();
 let kind=$state<StoryEffect['kind']>('state');
 const objects=$derived((adventure.story?.entities??[]).filter(b=>b.states.length).map(b=>({...b,label:adventure.maps.find(m=>m.id===b.mapId)?.name+' · '+adventure.maps.find(m=>m.id===b.mapId)?.entities.find(e=>e.id===b.entityId)?.label})));
 const items=$derived(adventure.items??[]);
 function first(k:StoryEffect['kind']):StoryEffect|undefined{if(k==='state'&&objects[0])return {kind:k,mapId:objects[0].mapId,entityId:objects[0].entityId,stateId:objects[0].states[0].id};if(k!=='state'&&items[0])return {kind:k,itemId:items[0].id,quantity:1};}
 function change(i:number,v:StoryEffect){onchange(effects.map((e,n)=>n===i?v:e));}
</script>
<div aria-label="Consecuencias" role="group">
 {#each effects as e,i}<div class="effect"><div class="line"><strong>{e.kind==='state'?'Cambiar estado':e.kind==='give'?'Dar artículo':'Consumir artículo'}</strong><button disabled={effects.length===1} title={effects.length===1?'Usa Eliminar reacción para quitar la última consecuencia':'Eliminar consecuencia'} aria-label={'Eliminar consecuencia '+(i+1)} onclick={()=>onchange(effects.filter((_,n)=>n!==i))}>×</button></div>
 {#if e.kind==='state'}<label>Objeto<select value={entityKey(e)} onchange={event=>{const b=objects.find(b=>entityKey(b)===event.currentTarget.value);if(b)change(i,{...e,mapId:b.mapId,entityId:b.entityId,stateId:b.states[0].id});}}>{#each objects as o}<option value={entityKey(o)}>{o.label}</option>{/each}</select></label><label>Nuevo estado<select value={e.stateId} onchange={event=>change(i,{...e,stateId:event.currentTarget.value})}>{#each objects.find(o=>entityKey(o)===entityKey(e))?.states??[] as state}<option value={state.id}>{state.name}</option>{/each}</select></label>
 {:else}<label>Artículo<select value={e.itemId} onchange={event=>change(i,{...e,itemId:event.currentTarget.value})}>{#each items as item}<option value={item.id}>{item.name}</option>{/each}</select></label><label>Cantidad<input type="number" min="1" max="999999" value={e.quantity} onchange={event=>change(i,{...e,quantity:Math.max(1,Math.floor(+event.currentTarget.value))})}/></label>{/if}</div>{/each}
 <div class="add"><select aria-label="Tipo de consecuencia" bind:value={kind}><option value="state">Cambiar estado</option><option value="give">Dar artículo</option><option value="consume">Consumir artículo</option></select><button disabled={!first(kind)||effects.length>=16} onclick={()=>{const e=first(kind);if(e)onchange([...effects,e]);}}>+ Añadir</button></div>
 {#if !first(kind)}<p>{kind==='state'?'Define primero los estados de algún objeto.':'Crea primero un artículo en Inventario.'}</p>{/if}
</div>
<style>
.effect{border:1px solid #dce5d6;background:white;border-radius:8px;padding:10px;margin:10px 0;font-size:12px}.line,.add{display:flex;align-items:center;gap:8px}.line{justify-content:space-between}.add{margin:12px 0}.add select{flex:1;min-width:0}.add button{flex-shrink:0}label{display:block;margin:10px 0;color:#62755c}select,input{display:block;width:100%;box-sizing:border-box;margin-top:5px;padding:8px;border:1px solid #d5dfce;border-radius:6px;background:white;color:#35502f;font:inherit}button{border:1px solid #d5dfce;border-radius:6px;padding:8px;background:#edf3e5;color:#35502f;cursor:pointer}button:disabled{opacity:.4;cursor:default}p{font-size:12px;color:#718269;line-height:1.5}select:focus-visible,button:focus-visible,input:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
