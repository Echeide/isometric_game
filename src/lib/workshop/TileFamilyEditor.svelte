<script lang="ts">
 import {Plus,Pencil,Unlink} from 'lucide-svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 import {detachTile,tileFamilyId,type TileFamilies} from '../../../packages/world/src/tile-families';
 import type {TileKind} from '@isometrico/world';
 type Choice={id:string;name:string;image:string;frame?:[number,number,number,number]};
 let {families,selected,choices,resolve,canAdd=false,busy=false,onchange,onselect,onadd}:{families:TileFamilies;selected:string;choices:Choice[];resolve:(url:string)=>string;canAdd?:boolean;busy?:boolean;onchange:(next:TileFamilies)=>void;onselect:(id:string)=>void;onadd:()=>void}=$props();
 const familyId=$derived(tileFamilyId(families,selected)),family=$derived(familyId?families[familyId]:undefined);
 const members=$derived(family?Object.entries(family.tiles).map(([id,weight])=>({...choices.find(c=>c.id===id)!,weight:weight??0})).filter(m=>m.id):[]);
 const total=$derived(members.reduce((sum,m)=>sum+m.weight,0));
 function join(id:string){
  if(id===(familyId??''))return;
  const next=detachTile(families,selected);
  if(id&&next[id])next[id].tiles[selected as TileKind]=100;
  onchange(next);
 }
 function create(){const next=detachTile(families,selected);next[`family.${crypto.randomUUID()}`]={name:choices.find(c=>c.id===selected)?.name??'Nueva familia',tiles:{[selected]:100}};onchange(next);}
 function rename(name:string){if(familyId)onchange({...families,[familyId]:{...families[familyId],name}});}
 function weight(id:string,value:number){if(familyId)onchange({...families,[familyId]:{...families[familyId],tiles:{...families[familyId].tiles,[id]:value}}});}
</script>
<section class="family-editor" aria-label="Familia de textura">
 <h3>Variantes de textura</h3>
 <label>Familia<select aria-label="Familia del suelo" value={familyId??''} onchange={e=>join(e.currentTarget.value)} disabled={busy}>
  <option value="">Sin familia</option>{#each Object.entries(families) as [id,f]}<option value={id}>{f.name}</option>{/each}
 </select></label>
 {#if family}
  <label>Nombre de familia<input aria-label="Nombre de la familia de suelos" maxlength="120" value={family.name} oninput={e=>rename(e.currentTarget.value)} disabled={busy}/></label>
  <div class="members">{#each members as member}
   <div class:current={member.id===selected} class="member">
    <button type="button" class="edit" aria-label={`Editar textura ${member.name}`} disabled={busy||member.id===selected} onclick={()=>onselect(member.id)}><span class="thumb"><SpriteThumbnail image={resolve(member.image)} frame={member.frame} width={64} height={32}/></span><span>{member.name}</span><Pencil size={12}/></button>
    <label class="weight"><span>Peso</span><input type="number" min="0" max="100" step="1" aria-label={`Peso de ${member.name}`} value={member.weight} oninput={e=>weight(member.id,e.currentTarget.valueAsNumber)} disabled={busy}/><small>{total>0?Math.round(member.weight/total*100):0}%</small></label>
    <button type="button" class="detach" aria-label={`Quitar ${member.name} de la familia`} title="Quitar de la familia; conserva el suelo" disabled={busy} onclick={()=>onchange(detachTile(families,member.id))}><Unlink size={13}/></button>
   </div>
  {/each}</div>
  {#if !total}<p class="warning">Asigna un peso mayor que cero a alguna textura.</p>{/if}
 {:else}
  <button type="button" disabled={busy} onclick={create}>Crear familia con este suelo</button>
 {/if}
 <button type="button" class="add" disabled={!canAdd||busy} onclick={onadd}><Plus size={14}/> Añadir variante de textura</button>
 {#if !canAdd}<p>Guarda el suelo antes de añadir otra variante.</p>{/if}
 <p>Los pesos controlan el mosaico de prueba. Quitar una variante de la familia conserva su baldosa en el catálogo.</p>
</section>
<style>
 .family-editor{border-top:1px solid #e4e8dd;padding-top:17px;margin-top:20px;min-width:0}h3{font-size:12px;font-weight:600;margin:0 0 12px}label{display:grid;gap:6px;font-size:11px;color:#627354;margin:0 0 10px}input,select{width:100%;min-width:0;box-sizing:border-box;font:inherit;border:1px solid #d8e0ce;border-radius:6px;padding:8px;color:#3e5334;background:white}button{display:flex;align-items:center;justify-content:center;gap:6px;font:inherit;font-size:11px;padding:8px;border:1px solid #d8e0ce;background:#fffef9;border-radius:6px;cursor:pointer;color:#3e5334}button:disabled{opacity:.45;cursor:default}.add{width:100%;margin-top:10px;background:#f1f5e9;border-style:dashed}.members{display:grid;gap:6px}.member{display:grid;grid-template-columns:minmax(0,1fr) 48px 26px;gap:5px;align-items:center;padding:6px 0;border-bottom:1px solid #e6eadf}.member.current{background:#f1f5e9}.edit{justify-content:flex-start;text-align:left;border:0;background:transparent;padding:2px;min-width:0}.edit>span:not(.thumb){overflow-wrap:anywhere;min-width:0}.edit>:global(svg){flex-shrink:0}.edit:disabled{opacity:1}.thumb{width:32px;height:20px;flex-shrink:0;display:grid;place-items:center}.thumb :global(canvas){width:32px;height:20px}.weight{margin:0;gap:2px;text-align:center;font-size:9px}.weight input{padding:4px;font-size:11px}.weight small{color:#80916f}.detach{padding:5px;background:transparent;border:0}p{font-size:10px;line-height:1.65;color:#7d8b71;margin:10px 0 0}.warning{color:#a44735}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #74994e;outline-offset:2px}
</style>
