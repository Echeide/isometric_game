<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import type {Snippet} from 'svelte';
 import {Search,Box,Users,UserRound,Layers} from 'lucide-svelte';
 import type {ObjectFamilies,TileFamilies} from '@isometrico/world';
 import type {ResourceEntry,ResourceKind} from './resources';
 import {catalogCategories,catalogKinds,resourceCatalog,type CatalogCategory} from './catalog';
 import TileCatalog from './TileCatalog.svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 let {entries,kind,kinds=['object','npc','player','tile'],query=$bindable(''),category=$bindable('all'),objectFamilies={},tileFamilies={},selected='',dirty=false,busy=false,activePlayer='default',resolve,tools,onkindchange,onselect}:{entries:ResourceEntry[];kind:ResourceKind;kinds?:ResourceKind[];query?:string;category?:CatalogCategory;objectFamilies?:ObjectFamilies;tileFamilies?:TileFamilies;selected?:string;dirty?:boolean;busy?:boolean;activePlayer?:string;resolve:(url:string)=>string;tools?:Snippet;onkindchange?:(kind:ResourceKind)=>void;onselect:(id:string)=>void}=$props();
 const icons={object:Box,npc:Users,player:UserRound,tile:Layers};
 const catalog=$derived(resourceCatalog(entries,{kind,query,category,objectFamilies,tileFamilies}));
</script>
<section class="catalog" aria-label={ui.text("Catálogo de recursos de la aventura")}>
 {#if onkindchange&&kinds.length>1}<div class="types" role="group" aria-label={ui.text("Tipos del catálogo")}>{#each catalogKinds.filter(item=>kinds.includes(item.id)) as item}{@const Icon=icons[item.id]}<button disabled={busy} aria-pressed={kind===item.id} onclick={()=>onkindchange?.(item.id)}><Icon size={15}/>{ui.text(item.label??'')}</button>{/each}</div>{/if}
 <div class="heading"><strong>{ui.text(catalogKinds.find(item=>item.id===kind)?.label??'')}</strong><span aria-label={ui.text("{arg0} recursos encontrados",{arg0:catalog.count})}>{catalog.count}</span></div>
 <label class="search"><Search size={16}/><input aria-label={ui.text("Buscar recurso")} placeholder={ui.text("Recurso, familia o aspecto…")} disabled={busy} bind:value={query}/></label>
 {#if kind==='object'||kind==='npc'}<select aria-label={ui.text("Categoría del catálogo")} disabled={busy} bind:value={category}>{#each catalogCategories as item}<option value={item.id}>{ui.text(item.label??'')}</option>{/each}</select>{/if}
 {#if tools}<div class="tools">{@render tools()}</div>{/if}
 <div class="resources">
 {#if kind==='object'||kind==='tile'}<TileCatalog groups={catalog.groups} ungrouped={catalog.ungrouped} {selected} {dirty} {busy} search={query} filtered={category!=='all'} resourceType={kind} {resolve} {onselect}/>
 {:else}{#each catalog.ungrouped as entry (entry.id)}<button class:selected={selected===entry.id} aria-pressed={selected===entry.id} disabled={busy} onclick={()=>onselect(entry.id)}><span class="thumb"><SpriteThumbnail image={resolve(entry.image)} frame={entry.frame}/></span><span class="name"><strong>{entry.name}</strong><small>{dirty&&selected===entry.id?ui.text("Sin guardar"):kind==='player'&&activePlayer===entry.id?ui.text("Jugador activo"):entry.custom?ui.text("Personalizado"):ui.text("Catálogo base")}</small></span></button>{:else}<p class="hint">{query.trim()||category!=='all'?ui.text("No hay coincidencias."):ui.text("No hay recursos de este tipo.")}</p>{/each}{/if}
 </div>
</section>
<style>
 .catalog{display:flex;flex-direction:column;gap:10px;min-width:0}.types{display:flex;gap:4px;flex-wrap:wrap}.types button{display:flex;align-items:center;gap:5px;font-size:11px;padding:7px 8px;min-height:32px;border:1px solid transparent;border-radius:6px;background:transparent;color:#677a5c;cursor:pointer}.types button[aria-pressed=true]{background:#e5edda;color:#38552c;border-color:#d4e0c8}.heading{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#486238}.heading span{font-size:11px;color:#7b8973}.search{display:flex;align-items:center;gap:8px;margin:0;color:#7b8973}.search input,select{width:100%;box-sizing:border-box;min-width:0;border:1px solid #d8e0ce;border-radius:7px;background:#fff;padding:8px 9px;font:inherit;font-size:12px;color:#3e5334}.tools{display:grid;gap:8px}.resources{min-width:0;display:grid;gap:4px}.resources>button{display:flex;align-items:center;gap:8px;width:100%;padding:8px;border:1px solid transparent;border-radius:7px;background:transparent;color:inherit;text-align:left;cursor:pointer;min-width:0}.resources>button.selected{background:#edf2e4;border-color:#c7d8b4}.resources>button:hover:not(:disabled){background:#f1f5e9;border-color:#9eb687}.thumb{width:40px;height:36px;border-radius:5px;background:#e8eedf;flex:none;overflow:hidden}.name{display:grid;gap:5px;min-width:0}.name strong{font-size:11px;font-weight:550;overflow-wrap:anywhere}.name small{font-size:9px;color:#869176}.hint{font-size:11px;color:#7b8973;line-height:1.5}button:disabled,input:disabled,select:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #74994e;outline-offset:2px}
</style>
