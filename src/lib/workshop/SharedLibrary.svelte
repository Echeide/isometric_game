<script lang="ts">
 import {onMount} from 'svelte';
 import SpriteThumbnail from '$lib/components/SpriteThumbnail.svelte';
 import {downloadBlob} from '$lib/storage/adventure-package';
 import {unpackResource,type SharedSummary} from './shared-resource';
 import type {ResourceKind} from './resources';
 let {kind,onincorporate,busy=false}:{kind:ResourceKind;onincorporate:(entry:SharedSummary)=>void;busy?:boolean}=$props();
 let entries=$state<SharedSummary[]>([]),search=$state(''),working=$state(false),error=$state(''),notice=$state(''),input:HTMLInputElement;
 const filtered=$derived(entries.filter(e=>e.kind===kind&&e.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
 const labels={object:'Objeto',npc:'PNJ',player:'Personaje',tile:'Suelo'};
 async function checked(response:Response){if(!response.ok){let text='No se pudo acceder a la biblioteca.';if(response.status===401)text='Accede al taller privado y pulsa Actualizar.';else try{text=(await response.json()).message??text;}catch{}throw Error(text);}return response;}
 async function run(task:()=>Promise<void>){if(working)return;working=true;error='';try{await task();}catch(e){error=(e as Error).message;}finally{working=false;}}
 async function refresh(){await run(async()=>{entries=await (await checked(await fetch('/api/characters/library'))).json();});}
 async function exportAll(){await run(async()=>{const response=await checked(await fetch('/api/characters/library/archive'));downloadBlob(await response.blob(),'biblioteca-sprites.zip');});}
 async function importAll(event:Event){const target=event.currentTarget as HTMLInputElement,file=target.files?.[0];target.value='';if(!file)return;await run(async()=>{if(file.size>200_000_000)throw Error('El ZIP supera 200 MB.');const bytes=new Uint8Array(await file.arrayBuffer());let single=false;try{unpackResource(bytes);single=true;}catch{}const response=await checked(await fetch(single?'/api/characters/library':'/api/characters/library/archive',{method:'POST',headers:{'Content-Type':'application/zip'},body:new Uint8Array(bytes)}));const result=await response.json();entries=await(await checked(await fetch('/api/characters/library'))).json();notice=`Biblioteca importada: ${single?1:result.count} recursos procesados. Los duplicados se conservan una sola vez.`;});}
 onMount(()=>{void refresh();});
</script>
<section class="shared" aria-label="Biblioteca general">
 <header><div><h2>Biblioteca general</h2><p>Recursos guardados en este servidor. Incorporarlos crea una copia independiente en la aventura seleccionada.</p></div><div class="tools"><button disabled={working||busy} onclick={refresh}>Actualizar</button><button disabled={working||busy} onclick={()=>input.click()}>Importar ZIP</button><button disabled={working||busy||!entries.length} onclick={exportAll}>Exportar biblioteca ZIP</button></div></header>
 <input class="search" aria-label="Buscar en biblioteca general" placeholder="Buscar en biblioteca…" bind:value={search}/>
 <input hidden type="file" accept=".zip,application/zip" bind:this={input} onchange={importAll}/>
 {#if working}<p role="status">Procesando biblioteca…</p>{/if}
 {#if error}<p role="alert">{error} <a href="/characters" target="_blank" rel="noreferrer">Abrir taller privado</a></p>{/if}
 {#if notice}<p role="status">{notice}</p>{/if}
 <div class="cards">{#each filtered as entry}<article><div class="thumbnail"><SpriteThumbnail image={`/api/characters/library/${entry.id}?image=${encodeURIComponent(entry.image)}`} frame={entry.frame} width={160} height={140}/></div><h3>{entry.name}</h3><p>{labels[entry.kind]} · v{entry.version}</p><button disabled={working||busy} onclick={()=>onincorporate(entry)}>Incorporar a esta aventura</button><a href={`/api/characters/library/${entry.id}`} download={`${entry.name}.sprite.zip`}>Descargar recurso ZIP</a></article>{:else}{#if !working&&!error}<p>No hay recursos de este tipo. Guarda uno en tu aventura y pulsa «Añadir a biblioteca general».</p>{/if}{/each}</div>
</section>
<style>
 .shared{padding:20px;border:1px solid #dce3d5;border-radius:12px;background:#fafbf7}header{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}h2{font-size:22px;margin:0}p{font-size:12px;line-height:1.6;color:#627354;max-width:650px}.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}button,a{font-size:12px}button{background:#edf3e6;border:1px solid #cbd8bf;border-radius:7px;padding:10px;color:#304535;cursor:pointer}button:disabled{opacity:.5;cursor:default}.search{box-sizing:border-box;width:100%;max-width:420px;padding:10px;border:1px solid #cbd8bf;border-radius:7px;margin:14px 0}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}article{padding:16px;border:1px solid #dce3d5;border-radius:10px;background:white;min-width:0}h3{font-size:15px;overflow-wrap:anywhere}.thumbnail{height:140px;width:160px;margin:auto;background:#eff3e9}a{display:block;color:#476238;margin-top:12px}article button{width:100%}[role=alert]{color:#943d31}
</style>
