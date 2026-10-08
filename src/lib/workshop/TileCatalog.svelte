<script lang="ts">
 import {ChevronRight,Layers} from 'lucide-svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 import type {ResourceEntry} from './resources';
 let {groups,ungrouped,selected,dirty=false,busy=false,search='',resolve,onselect}:{groups:{id:string;name:string;entries:ResourceEntry[]}[];ungrouped:ResourceEntry[];selected:string;dirty?:boolean;busy?:boolean;search?:string;resolve:(url:string)=>string;onselect:(id:string)=>void}=$props();
</script>
{#snippet tile(entry:ResourceEntry)}
 <button class:selected={selected===entry.id} aria-pressed={selected===entry.id} disabled={busy} onclick={()=>{if(selected!==entry.id)onselect(entry.id);}}>
  <span class="thumb"><SpriteThumbnail image={resolve(entry.image)} frame={entry.frame}/></span>
  <span class="name"><strong>{entry.name}</strong><small>{dirty&&selected===entry.id?'Sin guardar':entry.custom?'Personalizado':'Catálogo base'}</small></span>
  {#if selected===entry.id}<span class="selection-dot"></span>{/if}
 </button>
{/snippet}
<div class="tile-catalog" aria-label="Suelos por familia">
 {#each groups as group (group.id)}
  <details open={!!search.trim()||group.entries.some(e=>e.id===selected)}>
   <summary aria-label={`Familia ${group.name} · ${group.entries.length} texturas`}><span class="chevron"><ChevronRight size={14}/></span><Layers size={14}/><strong>{group.name}</strong><span class="count">{group.entries.length}</span></summary>
   <div class="members">{#each group.entries as entry (entry.id)}{@render tile(entry)}{/each}</div>
  </details>
 {/each}
 {#if ungrouped.length}<section aria-label="Suelos sin familia">{#if groups.length}<h3>Sin familia</h3>{/if}{#each ungrouped as entry (entry.id)}{@render tile(entry)}{/each}</section>{/if}
 {#if !groups.length&&!ungrouped.length}<p>{search?'No hay coincidencias.':'Añade un suelo para empezar.'}</p>{/if}
</div>
<style>
 .tile-catalog{display:grid;gap:10px;min-width:0}details{min-width:0}summary{display:flex;align-items:center;gap:6px;padding:9px 5px;border-radius:6px;background:#edf2e4;color:#486238;font-size:11px;cursor:pointer;list-style:none;min-width:0}summary::-webkit-details-marker{display:none}summary strong{font-weight:600;min-width:0;overflow-wrap:anywhere}.chevron{display:flex;flex-shrink:0;transition:transform .15s}details[open] .chevron{transform:rotate(90deg)}.count{margin-left:auto;background:#ffffff90;border-radius:4px;padding:2px 5px;font-size:10px}.members{padding-left:10px;border-left:1px solid #d8e3c9;margin:6px 0 0 8px;display:grid;gap:4px}section{display:grid;gap:4px}h3{font-size:10px;color:#7d8b71;margin:8px 5px 3px;font-weight:500}button{display:flex;align-items:center;gap:8px;width:100%;padding:8px;text-align:left;background:transparent;border:1px solid transparent;border-radius:7px;font:inherit;color:inherit;cursor:pointer;min-width:0}button.selected{background:#edf2e4;border-color:#c7d8b4}button:hover:not(:disabled){background:#f1f5e9;border-color:#9eb687}button:disabled{opacity:.45;cursor:default}.thumb{width:40px;height:36px;border-radius:5px;background:#e8eedf;display:grid;place-items:center;overflow:hidden;flex-shrink:0}.thumb :global(canvas){width:100%;height:100%}.name{display:grid;gap:5px;min-width:0}.name strong{font-size:11px;font-weight:550;overflow-wrap:anywhere}.name small{font-size:9px;color:#869176}.selection-dot{width:6px;height:6px;background:#7ea253;border-radius:50%;margin-left:auto;flex-shrink:0}p{font-size:11px;color:#87927b;line-height:1.6}button:focus-visible,summary:focus-visible{outline:2px solid #74994e;outline-offset:2px}@media(prefers-reduced-motion:reduce){.chevron{transition:none}}
</style>
