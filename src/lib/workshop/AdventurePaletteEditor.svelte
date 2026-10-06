<script lang="ts">
 import {Palette,Settings2,Download,Upload,Save} from 'lucide-svelte';
 import {defaultAdventurePalette,validateAdventurePalette,importPalette,type AdventurePalette} from '$lib/demo/adventure-palette';
 import {downloadBlob} from '$lib/storage/adventure-package';
 let {palette,disabled=false,onsave,onextract,onediting}:{palette?:AdventurePalette;disabled?:boolean;onsave:(palette:AdventurePalette)=>Promise<void>;onextract?:()=>Promise<AdventurePalette>;onediting:(open:boolean)=>void}=$props();
 let draft=$state<AdventurePalette>(defaultAdventurePalette()),working=$state(false),error=$state('');
 let dialog:HTMLDialogElement,input:HTMLInputElement;
 function open(){draft=JSON.parse(JSON.stringify(palette??defaultAdventurePalette()));error='';dialog.showModal();onediting(true);}
 function close(){dialog.close();onediting(false);}
 async function save(){working=true;error='';try{await onsave(validateAdventurePalette(draft));close();}catch(e){error=(e as Error).message;}finally{working=false;}}
 async function importFile(event:Event){const file=(event.currentTarget as HTMLInputElement).files?.[0];input.value='';if(!file)return;try{if(file.size>16_000)throw Error('La paleta no puede superar 16 KB.');draft=importPalette(await file.text());error='';}catch(e){error=(e as Error).message;}}
 async function extract(){working=true;error='';try{if(onextract)draft=await onextract();}catch(e){error=(e as Error).message;}finally{working=false;}}
</script>
<section class="palette-bar" aria-label="Paleta de la aventura">
 <div class="title"><Palette size={19}/><div><strong>{palette?.name??'Paleta de aventura'}</strong><small>{palette?'64 colores compartidos':'Define 64 colores para unificar tus recursos'}</small></div></div>
 <div class="mini" aria-hidden="true">{#each (palette??defaultAdventurePalette()).colors.slice(0,16) as color}<span style:background={color}></span>{/each}</div>
 <button disabled={disabled} onclick={open}><Settings2 size={15}/>{palette?'Configurar':'Definir paleta'}</button>
</section>
<dialog bind:this={dialog} oncancel={e=>{e.preventDefault();if(!working)close();}} aria-labelledby="palette-title">
 <h2 id="palette-title">Paleta de aventura · 64 colores</h2><p>Se comparte entre objetos, suelos y personajes. Los recursos existentes se adaptan cuando tú lo elijas.</p>
 <fieldset disabled={working}><label>Nombre<input maxlength="80" bind:value={draft.name}/></label>
 <div class="swatches">{#each draft.colors as color,i}<input type="color" aria-label={`Color de aventura ${i+1}`} title={`${i+1} · ${color}`} value={color} onchange={e=>draft.colors[i]=e.currentTarget.value}/>{/each}</div>
 <div class="tools"><button onclick={()=>draft=defaultAdventurePalette()}>Aventura 64</button><button onclick={()=>input.click()}><Upload size={14}/> Importar</button><button onclick={()=>downloadBlob(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}),'aventura-64.palette.json')}><Download size={14}/> Exportar</button>{#if onextract}<button onclick={extract}>Extraer del recurso seleccionado</button>{/if}</div>
 <input hidden type="file" accept=".json,.txt,.hex" bind:this={input} onchange={importFile}/>
 <p class="hint">Importa una paleta JSON o una lista de 64 códigos HEX distintos. Editar la paleta no recolorea recursos automáticamente.</p>
 {#if error}<p role="alert" class="error">{error}</p>{/if}
 <footer><button onclick={close}>Cancelar</button><button class="primary" onclick={save}><Save size={15}/>{working?'Guardando…':'Guardar paleta'}</button></footer></fieldset>
</dialog>
<style>
 .palette-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;margin:0 0 20px;background:#f4f7ee;border:1px solid #d6dfcc;border-radius:12px}.title{display:flex;align-items:center;gap:10px;color:#435a36}.title strong,.title small{display:block}.title strong{font-size:13px}.title small{font-size:11px;margin-top:4px;color:#68795c}.mini{display:grid;grid-template-columns:repeat(16,12px);gap:2px}.mini span{height:16px;border-radius:2px}button{display:inline-flex;gap:6px;align-items:center;padding:9px 12px;border:1px solid #cbd8bf;border-radius:7px;background:white;color:#3f5634;font:12px system-ui;cursor:pointer}button:disabled{opacity:.5;cursor:default}dialog{max-width:560px;width:calc(100% - 52px);border:1px solid #cbd8bf;border-radius:16px;padding:24px;color:#304535;background:#fafbf7}dialog::backdrop{background:#16231780}h2{font-size:20px;margin:0 0 12px}p{font:12px/1.6 system-ui;color:#627354}fieldset{padding:0;margin:0;border:0;min-width:0}label{display:grid;gap:6px;font:12px system-ui}label input{padding:9px;border:1px solid #cbd8bf;border-radius:7px;font:inherit}.swatches{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin:18px 0}.swatches input{width:100%;height:34px;cursor:pointer;padding:2px;border:1px solid #cbd8bf;border-radius:4px;background:white}.tools{display:flex;gap:6px;flex-wrap:wrap}footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.primary{background:#476238;color:white}.error{color:#963f31}@media(max-width:700px){.mini{display:none}.palette-bar{padding:12px;gap:8px}}
</style>
