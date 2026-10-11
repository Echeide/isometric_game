<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import type {Snippet} from 'svelte';
 import CatalogBrowser from './CatalogBrowser.svelte';
 import type {ObjectFamilies,TileFamilies} from '@isometrico/world';
 import type {ResourceEntry,ResourceKind} from './resources';
 import {resourceCatalog,type CatalogCategory} from './catalog';
 import TileCatalog from './TileCatalog.svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 let {entries,kind,kinds=['object','npc','player','tile','railing'],query=$bindable(''),category=$bindable('all'),objectFamilies={},tileFamilies={},selected='',dirty=false,busy=false,activePlayer='default',resolve,tools,contained=false,scroll=$bindable(0),onkindchange,onselect}:{entries:ResourceEntry[];kind:ResourceKind;kinds?:ResourceKind[];query?:string;category?:CatalogCategory;objectFamilies?:ObjectFamilies;tileFamilies?:TileFamilies;selected?:string;dirty?:boolean;busy?:boolean;activePlayer?:string;resolve:(url:string)=>string;tools?:Snippet;contained?:boolean;scroll?:number;onkindchange?:(kind:ResourceKind)=>void;onselect:(id:string)=>void}=$props();
 const catalog=$derived(resourceCatalog(entries,{kind,query,category,objectFamilies,tileFamilies}));
</script>
<section class="catalog" class:contained aria-label={ui.text("Catálogo de recursos de la aventura")}>
 <CatalogBrowser {kind} {kinds} bind:query bind:category bind:scroll count={catalog.count} {busy} {contained} {onkindchange}>
 {#if tools}<div class="tools">{@render tools()}</div>{/if}
 <div class="resources">
 {#if kind==='object'||kind==='tile'}<TileCatalog groups={catalog.groups} ungrouped={catalog.ungrouped} {selected} {dirty} {busy} search={query} filtered={category!=='all'} resourceType={kind} {resolve} {onselect}/>
 {:else}{#each catalog.ungrouped as entry (entry.id)}<button class:selected={selected===entry.id} aria-pressed={selected===entry.id} disabled={busy} onclick={()=>onselect(entry.id)}><span class="thumb"><SpriteThumbnail image={resolve(entry.image)} frame={entry.frame}/></span><span class="name"><strong>{entry.name}</strong><small>{dirty&&selected===entry.id?ui.text("Sin guardar"):kind==='player'&&activePlayer===entry.id?ui.text("Jugador activo"):entry.custom?ui.text("Personalizado"):ui.text("Catálogo base")}</small></span></button>{:else}<p class="hint">{query.trim()||category!=='all'?ui.text("No hay coincidencias."):ui.text("No hay recursos de este tipo.")}</p>{/each}{/if}
 </div>
 </CatalogBrowser>
</section>
<style>
 .catalog{display:flex;flex-direction:column;min-width:0}.catalog.contained{height:100%;flex:1;min-height:0}.tools{display:grid;gap:8px}.resources{min-width:0;display:grid;gap:4px}.resources>button{display:flex;align-items:center;gap:8px;width:100%;padding:8px;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;text-align:left;cursor:pointer;min-width:0}.resources>button.selected{background:#edf2e4;border-color:#c7d8b4}.resources>button:hover:not(:disabled){background:#f1f5e9;border-color:#9eb687}.thumb{width:40px;height:36px;border-radius:5px;background:#e8eedf;flex:none;overflow:hidden}.name{display:grid;gap:5px;min-width:0}.name strong{font-size:11px;font-weight:550;overflow-wrap:anywhere}.name small{font-size:9px;color:#869176}.hint{font-size:11px;color:#7b8973;line-height:1.5}button:disabled{opacity:.45;cursor:default}button:focus-visible{outline:2px solid #74994e;outline-offset:2px}
</style>
