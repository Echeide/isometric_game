<script lang="ts">
 import {resolveVisualCatalog,compatibleVisualKind,type PixelArtPack,type WorldEntity} from '@isometrico/world';
 import type {Adventure} from '../demo/adventure';
 import {objectFamilyId} from '../../../packages/world/src/object-families';
 import StateGraphic from './StateGraphic.svelte';
 let {adventure,entity,graphics,value,label,onchange}:{adventure:Adventure;entity:WorldEntity;graphics:PixelArtPack;value?:string;label:string;onchange:(id:string|undefined)=>void}=$props();
 let filter=$state<string|null>(null);
 const visuals=$derived(resolveVisualCatalog(adventure.catalog,adventure.catalogOverrides).filter(v=>compatibleVisualKind(entity.kind,v.kind)));
 const families=$derived(graphics.objectFamilies??{});
 const family=$derived(filter??objectFamilyId(families,value??entity.visualId??'')??'all');
 const choices=$derived(visuals.filter(v=>family==='all'||Object.hasOwn(families[family]?.aspects??{},v.id)));
 const familyChoices=$derived(Object.entries(families).filter(([,f])=>visuals.some(v=>Object.hasOwn(f.aspects,v.id))));
 const name=(id:string)=>families[family]?.aspects[id]??visuals.find(v=>v.id===id)?.label??id;
</script>
<div class="picker" aria-label={`Gráfico de ${label}`}>
 {#if entity.kind!=='person'}<label>Familia de gráficos<select aria-label={`${label} · Familia de gráficos`} value={family} onchange={e=>filter=e.currentTarget.value}><option value="all">Todos los objetos</option>{#each familyChoices as [id,f]}<option value={id}>{f.name}</option>{/each}</select></label>{/if}
 <div class="choice"><StateGraphic {graphics} visualId={value??entity.visualId} label={visuals.find(v=>v.id===(value??entity.visualId))?.label??'Gráfico del objeto'} size={64}/><label>Gráfico<select aria-label={`${label} · Gráfico`} value={value??''} onchange={e=>onchange(e.currentTarget.value||undefined)}><option value="">Usar gráfico del objeto</option>{#if value&&!choices.some(v=>v.id===value)}<option value={value}>Actual: {visuals.find(v=>v.id===value)?.label??value}</option>{/if}{#each choices as v}<option value={v.id}>{name(v.id)}</option>{/each}</select></label></div>
 {#if family!=='all'}<div class="aspects" role="group" aria-label={`Aspectos para ${label}`}>{#each choices as v}<button type="button" aria-pressed={(value??entity.visualId)===v.id} aria-label={`Usar ${name(v.id)} en ${label}`} onclick={()=>onchange(v.id)}><StateGraphic {graphics} visualId={v.id} label={v.label} size={48}/><span>{name(v.id)}</span></button>{/each}</div>{/if}
</div>
<style>
 .picker{margin:12px 0}label{display:grid;gap:5px;color:#62755c;font-size:11px;margin:10px 0}select{min-width:0;width:100%;box-sizing:border-box;border:1px solid #d5dfce;border-radius:6px;padding:8px;background:white;color:#35502f;font:inherit}.choice{display:flex;align-items:center;gap:10px}.choice label{flex:1;min-width:0}.aspects{display:grid;grid-template-columns:repeat(auto-fit,minmax(70px,1fr));gap:6px;margin-top:8px}button{display:grid;justify-items:center;gap:4px;min-width:0;border:1px solid #d5dfce;border-radius:7px;background:#fff;color:#35502f;padding:6px;cursor:pointer;font:inherit;font-size:10px}button span{overflow-wrap:anywhere}button[aria-pressed=true]{background:#edf3e5;border-color:#789557}button:focus-visible,select:focus-visible{outline:2px solid #789557;outline-offset:2px}
</style>
