<script lang="ts">
 import {Plus,Pencil,Unlink} from 'lucide-svelte';
 import SpriteThumbnail from '../components/SpriteThumbnail.svelte';
 import {detachObject,objectFamilyId,type ObjectFamilies} from '../../../packages/world/src/object-families';
 import type {ResourceEntry} from './resources';
 let {families,selected,choices,resolve,canAdd=false,busy=false,onchange,onselect,onadd}:{families:ObjectFamilies;selected:string;choices:ResourceEntry[];resolve:(url:string)=>string;canAdd?:boolean;busy?:boolean;onchange:(next:ObjectFamilies)=>void;onselect:(id:string)=>void;onadd:()=>void}=$props();
 const id=$derived(objectFamilyId(families,selected)),family=$derived(id?families[id]:undefined);
 function join(nextId:string){if(nextId===(id??''))return;const next=detachObject(families,selected);if(nextId&&next[nextId])next[nextId].aspects[selected]=choices.find(c=>c.id===selected)?.name.slice(0,80)??'Aspecto';onchange(next);}
 function create(){const next=detachObject(families,selected);next[`family.${crypto.randomUUID()}`]={name:choices.find(c=>c.id===selected)?.name??'Nueva familia',aspects:{[selected]:'Original'}};onchange(next);}
 function patch(values:Partial<NonNullable<typeof family>>){if(id&&family)onchange({...families,[id]:{...family,...values}});}
</script>
<section aria-label="Familia de gráficos" class="object-family">
 <h3>Aspectos del objeto</h3>
 <label>Familia<select aria-label="Familia del objeto" value={id??''} onchange={e=>join(e.currentTarget.value)} disabled={busy}><option value="">Sin familia</option>{#each Object.entries(families) as [key,f]}<option value={key}>{f.name}</option>{/each}</select></label>
 {#if family}
  <label>Nombre de familia<input aria-label="Nombre de la familia de gráficos" maxlength="120" value={family.name} oninput={e=>patch({name:e.currentTarget.value})}/></label>
  <label>Este aspecto<input aria-label="Nombre del aspecto" maxlength="80" placeholder="Cerrado, abierto, roto…" value={family.aspects[selected]} oninput={e=>patch({aspects:{...family.aspects,[selected]:e.currentTarget.value}})}/></label>
  <div class="members">{#each Object.entries(family.aspects) as [visual,label]}{@const entry=choices.find(c=>c.id===visual)}{#if entry}<div class="member"><button type="button" class="edit" disabled={busy||visual===selected} aria-label={`Editar aspecto ${label}`} onclick={()=>onselect(visual)}><span class="thumb"><SpriteThumbnail image={resolve(entry.image)} frame={entry.frame} width={40} height={40}/></span><span>{label}</span><Pencil size={13}/></button><button type="button" class="unlink" aria-label={`Quitar aspecto ${label} de la familia`} title="Conservar gráfico fuera de la familia" onclick={()=>onchange(detachObject(families,visual))}><Unlink size={14}/></button></div>{/if}{/each}</div>
 {:else}<button type="button" onclick={create}>Crear familia con este objeto</button>{/if}
 <button type="button" class="add" disabled={busy||!canAdd} onclick={onadd}><Plus size={14}/> Añadir aspecto</button>
 <p>{!canAdd?'Guarda el objeto antes de añadir otro aspecto. ':'Cada aspecto se retoca por separado en Piskel. '}Selecciona sus gráficos en Condiciones → Estados del objeto.</p>
</section>
<style>
 .object-family{border-top:1px solid #e4e8dd;margin-top:20px;padding-top:17px}h3{font-size:12px;margin:0 0 12px}label{display:grid;gap:6px;margin:10px 0;font-size:11px;color:#627354}input,select{min-width:0;width:100%;box-sizing:border-box;padding:8px;border:1px solid #d8e0ce;border-radius:6px;background:white;color:#3e5334;font:inherit}button{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;border:1px solid #d8e0ce;border-radius:6px;background:#fffef9;color:#3e5334;font:inherit;font-size:11px;cursor:pointer}button:disabled{opacity:.45;cursor:default}.members{display:grid;gap:6px}.member{display:flex;align-items:center;gap:6px;border-bottom:1px solid #e6eadf}.edit{flex:1;min-width:0;text-align:left;justify-content:flex-start;border:0;background:transparent;padding:4px}.edit span:not(.thumb){flex:1;overflow-wrap:anywhere}.edit:disabled{opacity:1}.thumb{width:40px;height:40px;flex:none;background:#edf2e4;border-radius:5px}.unlink{border:0;background:transparent;padding:6px}.add{width:100%;margin-top:10px;background:#f1f5e9;border-style:dashed}p{font-size:10px;color:#7d8b71;line-height:1.6}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #74994e;outline-offset:2px}
</style>
