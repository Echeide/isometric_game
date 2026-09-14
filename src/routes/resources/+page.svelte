<script lang="ts">
 import {onMount,onDestroy} from 'svelte';
 import {ArrowLeft,Upload,Download,Image as ImageIcon} from 'lucide-svelte';
 import type {Adventure} from '$lib/demo/adventure';
 import {visualCatalog,type PixelArtPack} from '@isometrico/world';
 const actions:Record<string,string>={idle:'En reposo',walk:'Caminar',work:'Trabajar',talk:'Conversar',celebrate:'Celebrar',sit:'Sentarse'};
 const variants:Record<string,string>={'ce936a':'Lucía','819582':'Marcos','728da5':'Explorador gris'};
 import {localAdventures,resolveGraphics,imageUrls,mapImages,resourceBlob} from '$lib/storage/local-adventures';
 import {downloadBlob,exportAdventure,pngSize} from '$lib/storage/adventure-package';
 let adventure=$state<Adventure>(),pack=$state.raw<PixelArtPack>(),resolved=$state.raw<PixelArtPack>();
 let selected=$state(''),busy=$state(false),error=$state(''),notice=$state(''),dimensions=$state('');
 let upload=$state<HTMLInputElement>();
 let release=()=>{},disposed=false;
 const urls=$derived(pack?imageUrls(pack):[]);
 const visibleUrls=$derived(resolved?imageUrls(resolved):[]);
 const index=$derived(urls.indexOf(selected));
 function label(url:string){
  if(!pack)return '';
  const objects=Object.entries(pack.objects).filter(([,o])=>o.image===url).map(([id])=>visualCatalog.find(item=>item.id===id)?.label??id);
  const tiles=Object.entries(pack.tiles).filter(([,image])=>image===url).map(([id])=>'Suelo · '+id);
  const clips=Object.entries(pack.character.animations).flatMap(([id,a])=>[...(a.image===url?['Explorador · '+(actions[id]??id)]:[]),...Object.entries(a.variants??{}).filter(([,image])=>image===url).map(([variant])=>`${variants[variant]??variant} · ${actions[id]??id}`)]);
  return [...objects,...tiles,...clips].join(' / ')||'Personaje · hoja base';
 }
 async function reload(){if(!adventure)return;const nextPack=await localAdventures.pack(adventure.id),next=await resolveGraphics(adventure.id);if(disposed){next.release();return;}release();release=next.release;pack=nextPack;resolved=next.pack;if(!imageUrls(nextPack).includes(selected))selected=imageUrls(nextPack)[0];}
 async function select(url:string){selected=url;dimensions='';try{const size=pngSize(new Uint8Array(await (await resourceBlob(url)).arrayBuffer()));if(selected===url)dimensions=`${size.width} × ${size.height} px`;}catch(e){error=(e as Error).message;}}
 onMount(()=>{void (async()=>{try{const library=await localAdventures.load(),id=new URLSearchParams(location.search).get('adventure')??library.activeId;adventure=library.adventures.find(a=>a.id===id);if(!adventure)throw new Error('No se encuentra la aventura.');await reload();await select(selected);}catch(e){error=(e as Error).message;}})();});
 onDestroy(()=>{disposed=true;release();});
 async function replace(event:Event){
  const input=event.currentTarget as HTMLInputElement,file=input.files?.[0];if(!file||!pack||!adventure||busy)return;
  busy=true;error='';notice='';
  try{
   if(file.size>10_000_000)throw new Error('El PNG no puede superar 10 MB.');
   const bytes=new Uint8Array(await file.arrayBuffer()),size=pngSize(bytes),original=pngSize(new Uint8Array(await (await resourceBlob(selected)).arrayBuffer()));
   if(size.width!==original.width||size.height!==original.height)throw new Error(`Esta hoja necesita ${original.width} × ${original.height} px. Conserva la cuadrícula y el orden de sus fotogramas.`);
   const bitmap=await createImageBitmap(file);bitmap.close();
   const id=crypto.randomUUID(),url=`asset:${id}`,next=mapImages(pack,image=>image===selected?url:image);
   const current=(await localAdventures.load()).adventures.find(a=>a.id===adventure!.id);if(!current)throw new Error('La aventura ya no está disponible.');
   await localAdventures.save(current,{pack:next,blobs:{[id]:new Blob([bytes],{type:'image/png'})}});
   selected=url;await reload();await select(url);notice='Recurso guardado. Se aplicará al abrir el editor o jugar esta aventura.';
  }catch(e){error=(e as Error).message;}finally{input.value='';busy=false;}
 }
 async function downloadImage(){try{downloadBlob(await resourceBlob(selected),`recurso-${index+1}.png`);}catch(e){error=(e as Error).message;}}
 async function exportPackage(){if(!adventure||busy)return;busy=true;try{const current=(await localAdventures.load()).adventures.find(a=>a.id===adventure!.id)!;downloadBlob(await exportAdventure(current),`${current.id}.zip`);notice='Paquete exportado con todos sus recursos.';}catch(e){error=(e as Error).message;}finally{busy=false;}}
</script>
<svelte:head><title>Recursos de la aventura — Isométrico</title></svelte:head>
<div class="workshop">
 <header><a href={adventure?`/editor?adventure=${encodeURIComponent(adventure.id)}`:'/editor'}><ArrowLeft size={18}/> Editor</a><div><h1>Recursos de la aventura</h1><p>{adventure?.name??'Cargando biblioteca…'}</p></div><button disabled={busy||!adventure} onclick={exportPackage}><Download size={17}/> Exportar ZIP</button></header>
 <p class="intro">Una biblioteca propia para cada aventura. Descarga una imagen como plantilla, edítala y sustituye el PNG. El paquete ZIP incluye los mapas y todas sus imágenes.</p>
 {#if error}<p class="error" role="alert">{error}</p>{/if}
 {#if notice}<p class="notice" role="status">{notice}</p>{/if}
 {#if pack&&resolved}<div class="layout"><section aria-label="Biblioteca de recursos"><h2>{urls.length} imágenes · {adventure?.maps.length} mapas · {adventure?.maps.reduce((sum,m)=>sum+m.entities.length,0)} elementos</h2><div class="grid">{#each urls as url,i}<button class:active={url===selected} disabled={busy} onclick={()=>select(url)} aria-pressed={url===selected}><div class="thumbnail"><img src={visibleUrls[i]} alt="" loading="lazy"/></div><span>{label(url)}</span>{#if url.startsWith('asset:')}<small>Personalizado</small>{/if}</button>{/each}</div></section>
 <aside><h2><ImageIcon size={20}/> {label(selected)}</h2><div class="preview"><img src={visibleUrls[index]} alt={label(selected)}/></div><strong>{dimensions}</strong><p>Conserva el tamaño, la transparencia y la posición del dibujo. En los personajes, mantén las filas de direcciones y las columnas de animación. Puedes descargar la hoja actual como plantilla.</p><button disabled={busy} onclick={downloadImage}><Download size={16}/> Descargar PNG</button><button class="primary" disabled={busy} onclick={()=>upload?.click()}><Upload size={16}/> {busy?'Procesando…':'Sustituir PNG'}</button><input class="hidden" type="file" accept="image/png,.png" aria-label="Sustituir recurso PNG" bind:this={upload} onchange={replace}/><a class="play" href={`/?adventure=${encodeURIComponent(adventure!.id)}`}>Jugar esta aventura →</a><p class="local">Guardado local en este navegador. Exporta un ZIP para llevarte la aventura a otro dispositivo. El progreso de las partidas se guarda aparte.</p></aside></div>{/if}
</div>
<style>
 .workshop{max-width:1400px;margin:auto;padding:24px;color:#253e3a}header{display:flex;align-items:center;gap:20px;border-bottom:1px solid #dbe3df;padding-bottom:20px}header div{flex:1}h1{font-size:24px;margin:0}header p{margin:4px 0 0}a{color:inherit;text-decoration:none}header a,button,h2{display:flex;align-items:center;gap:8px}button{font:inherit;border:1px solid #d4dfd9;border-radius:10px;background:white;padding:10px 14px;color:inherit;cursor:pointer}button:disabled{opacity:.55;cursor:wait}.intro{max-width:850px;line-height:1.6}.layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:24px}h2{font-size:15px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:12px}.grid button{display:flex;flex-direction:column;text-align:center;font-size:12px;overflow:hidden}.grid button.active{border-color:#467d66;box-shadow:0 0 0 2px #467d6633;background:#f3f8f1}.thumbnail{height:100px;width:100%;display:grid;place-items:center}.thumbnail img{max-width:100%;max-height:100px;image-rendering:pixelated}small{color:#537650}aside{background:#f3f6f2;border:1px solid #dbe3df;border-radius:16px;padding:20px;align-self:start;position:sticky;top:16px}aside p{font-size:13px;line-height:1.6}aside button{width:100%;justify-content:center;margin:10px 0}.preview{padding:12px;background:repeating-conic-gradient(#e0e5df 0% 25%,#f5f7f2 0% 50%) 0/20px 20px;border-radius:8px;margin:15px 0;overflow:auto}.preview img{display:block;max-width:100%;max-height:300px;margin:auto;image-rendering:pixelated}.primary{background:#315c4c;color:white}.play{display:block;text-align:center;margin:20px 0}.local{color:#63756e}.error,.notice{padding:12px;border-radius:8px;background:#ffebe5}.notice{background:#e5f2de}.hidden{display:none}@media(max-width:750px){.workshop{padding:16px}.layout{grid-template-columns:1fr}aside{position:static;grid-row:1}header{display:grid;grid-template-columns:1fr auto}header div{grid-row:2;grid-column:1/-1}header>button{grid-row:1;grid-column:2}h1{font-size:20px}.preview img{max-height:180px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
