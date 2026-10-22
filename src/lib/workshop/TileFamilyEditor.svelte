<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {Plus,Pencil,Unlink} from 'lucide-svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 import {detachTile,tileFamilyId,terrainMasks,terrainMaskLabel,interiorMembers,type TileFamilies} from '../../../packages/world/src/tile-families';
 import type {TileKind} from '@isometrico/world';
 import {baseTileChoices} from './resources';
 import type {TerrainBorderStyle} from './terrain-template';
 type Choice={id:string;name:string;image:string;frame?:[number,number,number,number]};
 let {families,selected,choices,resolve,canAdd=false,busy=false,onchange,onselect,onadd,onprepare,showAdd=true}:{showAdd?:boolean;families:TileFamilies;selected:string;choices:Choice[];resolve:(url:string)=>string;canAdd?:boolean;busy?:boolean;onchange:(next:TileFamilies)=>void;onselect:(id:string)=>void;onadd:()=>void;onprepare:(style:TerrainBorderStyle)=>void}=$props();
 const familyId=$derived(tileFamilyId(families,selected)),family=$derived(familyId?families[familyId]:undefined);
 const members=$derived(family?Object.entries(family.tiles).map(([id,weight])=>({...choices.find(c=>c.id===id)!,weight:weight??0})).filter(m=>m.id):[]);
 const total=$derived(family?interiorMembers(family).reduce((sum,m)=>sum+m.weight,0):0);
 const borderIds=$derived(new Set(Object.values(family?.borders??{})));
 const slots=[9,1,3,8,0,2,12,4,6];
 const needsTemplates=$derived(!family||terrainMasks.some(mask=>!family.borders?.[mask])||interiorMembers(family).length<3);
 const sidewalk=$derived(selected==='sidewalk'||!!family&&Object.hasOwn(family.tiles,'sidewalk'));
 const adjacentChoices=$derived(baseTileChoices(choices,families).filter(c=>c.familyId!==familyId));
 const adjacentSelection=$derived(adjacentChoices.find(c=>c.id===family?.borderAgainst||c.familyId&&Object.hasOwn(families[c.familyId].tiles,family?.borderAgainst??''))?.id??family?.borderAgainst??'');
 function join(id:string){
  if(id===(familyId??''))return;
  const next=detachTile(families,selected);
  if(id&&next[id])next[id].tiles[selected as TileKind]=100;
  onchange(next);
 }
 function create(){const next=detachTile(families,selected);next[`family.${crypto.randomUUID()}`]={name:choices.find(c=>c.id===selected)?.name??'Nueva familia',tiles:{[selected]:100}};onchange(next);}
 function rename(name:string){if(familyId)onchange({...families,[familyId]:{...families[familyId],name}});}
 function weight(id:string,value:number){if(familyId)onchange({...families,[familyId]:{...families[familyId],tiles:{...families[familyId].tiles,[id]:value}}});}
 function assign(mask:number,id:string){if(!familyId||!family)return;const borders={...family.borders};if(id)borders[mask]=id as TileKind;else delete borders[mask];const tiles={...family.tiles};for(const old of Object.values(family.borders??{}))if(old&&!Object.values(borders).includes(old)&&tiles[old]===0)tiles[old]=10;if(id)tiles[id as TileKind]=0;if(!Object.values(tiles).some(w=>w!>0))return;onchange({...families,[familyId]:{...family,tiles,borders}});}
</script>
<section class="family-editor" aria-label={ui.text("Familia de textura")}>
 <h3>{ui.text("Variantes de textura")}</h3>
 <label>{ui.text("Familia")}<select aria-label={ui.text("Familia del suelo")} value={familyId??''} onchange={e=>join(e.currentTarget.value)} disabled={busy}>
  <option value="">{ui.text("Sin familia")}</option>{#each Object.entries(families) as [id,f]}<option value={id}>{f.name}</option>{/each}
 </select></label>
 {#if family}
  <label>{ui.text("Nombre de familia")}<input aria-label={ui.text("Nombre de la familia de suelos")} maxlength="120" value={family.name} oninput={e=>rename(e.currentTarget.value)} disabled={busy}/></label>
  <div class="members">{#each members.filter(m=>!borderIds.has(m.id as TileKind)) as member}
   <div class:current={member.id===selected} class="member">
    <button type="button" class="edit" aria-label={ui.text("Editar textura {arg0}",{arg0:member.name})} disabled={busy||member.id===selected} onclick={()=>onselect(member.id)}><span class="thumb"><SpriteThumbnail image={resolve(member.image)} frame={member.frame} width={64} height={32}/></span><span>{member.name}</span><Pencil size={12}/></button>
    <label class="weight"><span>{ui.text("Peso")}</span><input type="number" min="0" max="100" step="1" aria-label={ui.text("Peso de {arg0}",{arg0:member.name})} value={member.weight} oninput={e=>weight(member.id,e.currentTarget.valueAsNumber)} disabled={busy||borderIds.has(member.id as TileKind)}/><small>{borderIds.has(member.id as TileKind)?ui.text("Borde"):total>0?Math.round(member.weight/total*100):0}%</small></label>
    <button type="button" class="detach" aria-label={ui.text("Quitar {arg0} de la familia",{arg0:member.name})} title={ui.text("Quitar de la familia; conserva el suelo")} disabled={busy} onclick={()=>onchange(detachTile(families,member.id))}><Unlink size={13}/></button>
   </div>
  {/each}</div>
  <div class="terrain-settings"><h3>{ui.text("Bordes automáticos")}</h3><p>{ui.text("Asigna una pieza completa a cada borde. Las piezas de borde no se mezclan en el interior.")}</p>
  <label>{ui.text("Borde contra")}<select aria-label={ui.text("Borde contra")} value={adjacentSelection} onchange={e=>familyId&&onchange({...families,[familyId]:{...family!,borderAgainst:e.currentTarget.value as TileKind||undefined}})} disabled={busy}><option value="">{ui.text("Cualquier otro terreno")}</option>{#each adjacentChoices as c}<option value={c.id}>{c.familyId?families[c.familyId].name:c.name}</option>{/each}</select></label>
  <div class="border-grid" aria-label={ui.text("Esquema de bordes")}>{#each slots as mask}<div class="border-slot">{#if mask===0}<span>{ui.text("Interior")}</span><small>{ui.text("Según pesos")}</small>{:else}{@const entry=choices.find(c=>c.id===family!.borders?.[mask])}<button type="button" title={terrainMaskLabel(mask)} aria-label={ui.text("Editar borde {arg0}",{arg0:terrainMaskLabel(mask)})} disabled={busy||!canAdd||!entry||entry.id===selected} onclick={()=>entry&&onselect(entry.id)}>{#if entry}<SpriteThumbnail image={resolve(entry.image)} frame={entry.frame} width={48} height={24}/>{:else}<Plus size={16}/>{/if}<span>{terrainMaskLabel(mask)}</span></button><select aria-label={ui.text("Pieza de borde {arg0}",{arg0:terrainMaskLabel(mask)})} value={family.borders?.[mask]??''} onchange={e=>assign(mask,e.currentTarget.value)} disabled={busy}><option value="">{ui.text("Sin borde")}</option>{#each members as member}<option value={member.id}>{member.name}</option>{/each}</select>{/if}</div>{/each}</div>
  <details><summary>{ui.text("Franjas estrechas y piezas aisladas")}</summary>{#each terrainMasks.filter(mask=>!slots.includes(mask)) as mask}<label>{terrainMaskLabel(mask)}<select aria-label={ui.text("Pieza de borde {arg0}",{arg0:terrainMaskLabel(mask)})} value={family.borders?.[mask]??''} onchange={e=>assign(mask,e.currentTarget.value)} disabled={busy}><option value="">{ui.text("Sin borde")}</option>{#each members as member}<option value={member.id}>{member.name}</option>{/each}</select></label>{/each}</details>
  <button type="button" class="add" disabled={!canAdd||busy||!needsTemplates} onclick={()=>onprepare(sidewalk?'curb':'shade')}>{sidewalk?ui.text("Preparar bordillos y variaciones"):ui.text("Preparar plantillas y variaciones")}</button><p>{ui.text("Completa las piezas que faltan sobre tu textura y con la paleta de la aventura. Guarda y retócalas en Piskel.")}</p>
  </div>
  {#if !total}<p class="warning">{ui.text("Asigna un peso mayor que cero a alguna textura.")}</p>{/if}
 {:else}
  <button type="button" disabled={busy} onclick={create}>{ui.text("Crear familia con este suelo")}</button><button type="button" class="add" disabled={!canAdd||busy||!needsTemplates} onclick={()=>onprepare(sidewalk?'curb':'shade')}>{sidewalk?ui.text("Preparar bordillos y variaciones"):ui.text("Preparar plantillas y variaciones")}</button>
 {/if}
 {#if showAdd}<button type="button" class="add" disabled={!canAdd||busy} onclick={onadd}><Plus size={14}/> {ui.text("Añadir variante de textura")}</button>{/if}
 {#if !canAdd}<p>{ui.text("Guarda el suelo antes de añadir otra variante.")}</p>{/if}
 <p>{ui.text("Los pesos controlan las variaciones del mapa. Las piezas sin borde asignado usan una variante interior.")}</p>
</section>
<style>
 .family-editor{border-top:1px solid #e4e8dd;padding-top:17px;margin-top:20px;min-width:0}h3{font-size:12px;font-weight:600;margin:0 0 12px}label{display:grid;gap:6px;font-size:11px;color:#627354;margin:0 0 10px}input,select{width:100%;min-width:0;box-sizing:border-box;font:inherit;border:1px solid #d8e0ce;border-radius:6px;padding:8px;color:#3e5334;background:white}button{display:flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:11px;padding:8px;border:1px solid #d8e0ce;background:#fffef9;border-radius:6px;cursor:pointer;color:#3e5334}button:disabled{opacity:.45;cursor:default}.add{width:100%;margin-top:10px;background:#f1f5e9;border-style:dashed}.members{display:grid;gap:6px}.member{display:grid;grid-template-columns:minmax(0,1fr) 48px 26px;gap:5px;align-items:center;padding:6px 0;border-bottom:1px solid #e6eadf}.member.current{background:#f1f5e9}.edit{justify-content:flex-start;text-align:left;border:0;background:transparent;padding:2px;min-width:0}.edit>span:not(.thumb){overflow-wrap:anywhere;min-width:0}.edit>:global(svg){flex-shrink:0}.edit:disabled{opacity:1}.thumb{width:32px;height:20px;flex-shrink:0;display:grid;place-items:center}.thumb :global(canvas){width:32px;height:20px}.weight{margin:0;gap:2px;text-align:center;font-size:9px}.weight input{padding:4px;font-size:11px}.weight small{color:#80916f}.detach{padding:5px;background:transparent;border:0}p{font-size:10px;line-height:1.65;color:#7d8b71;margin:10px 0 0}.warning{color:#a44735}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #74994e;outline-offset:2px}
 .terrain-settings{border-top:1px solid #dce4d4;margin-top:16px;padding-top:14px}.border-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin:12px 0}.border-slot{display:grid;align-content:center;gap:4px;border:1px solid #dce4d4;border-radius:6px;padding:4px;text-align:center;min-width:0}.border-slot button{display:grid;justify-items:center;border:0;padding:4px;font-size:9px;min-width:0}.border-slot button span{font-size:9px}.border-slot select{font-size:10px;padding:4px}.border-slot>span{font-size:11px}.border-slot small{font-size:9px;color:#7d8b71}summary{font-size:11px;cursor:pointer;margin:12px 0}details label{font-size:10px}
</style>
