<script lang="ts">
 import {onMount} from 'svelte';
 import {chatUrl,parseChat,resumeNode,type ChatConfig} from '$lib/chat/routingtales';
 let {resource,progressKey,onclose}:{resource:string;progressKey:string;onclose:()=>void}=$props();
 let frame=$state<HTMLIFrameElement>();
 let error=$state(''),loading=$state(true),completed=$state(false);
 onMount(()=>{
  const abort=new AbortController();let config:ChatConfig|undefined,ready=false,sent=false;
  const timeout=setTimeout(()=>{if(loading)error='La conversación está tardando demasiado. Puedes volver a intentarlo.';},15000);
  function configure(){if(!config||!ready||sent)return;sent=true;let saved:string|null=null;try{saved=localStorage.getItem(progressKey);}catch{/* Storage can be unavailable. */}
   frame?.contentWindow?.postMessage({channel:'routingtales-chat-v1',type:'configure',config,startNode:resumeNode(config,saved)},'*');
  }
  function receive(event:MessageEvent){
   if(event.source!==frame?.contentWindow||event.data?.channel!=='routingtales-chat-v1')return;
   if(event.data.type==='ready'){ready=true;configure();}
   if(event.data.type==='configured'){loading=false;clearTimeout(timeout);}
   if(event.data.type==='error'){loading=false;error='No se ha podido mostrar esta conversación.';clearTimeout(timeout);}
   if(event.data.type==='close')onclose();
   if(event.data.type==='node'&&config?.chatNodes.some(n=>n.id===event.data.id)){
    completed=event.data.id==='success';
    try{localStorage.setItem(progressKey,event.data.id);}catch{/* Continue playing without persistence. */}
   }
  }
  window.addEventListener('message',receive);
  void (async()=>{try{
   const url=chatUrl(resource),response=await fetch(url,{signal:abort.signal});
   if(!response.ok)throw new Error('No se pudo cargar el archivo de conversación.');
   config=parseChat(await response.json());
   // Substitute in text only; never alter ids, targets or URLs.
   config={...config,avatar:config.avatar?new URL(config.avatar,new URL(url,location.href)).href:new URL('/modules/routingtales-chat/avatar.svg',location.href).href,chatNodes:config.chatNodes.map(node=>({...node,messages:node.messages?.map(m=>Array.isArray(m)?m.map(t=>t.replaceAll('{playerName}','Explorador')):m.replaceAll('{playerName}','Explorador')) as typeof node.messages}))};
   configure();
  }catch(e){if(!abort.signal.aborted){error=(e as Error).message;loading=false;clearTimeout(timeout);}}})();
  return()=>{abort.abort();clearTimeout(timeout);window.removeEventListener('message',receive);};
 });
</script>
<div class="routing-chat">
 {#if error}<div role="alert"><p>{error}</p><button onclick={onclose}>Volver al mapa</button></div>{:else}
 {#if loading}<p role="status">Cargando conversación…</p>{/if}
 <iframe bind:this={frame} src="/modules/routingtales-chat/index.html" title="Conversación RoutingTales" sandbox="allow-scripts" class:loading></iframe>
 {#if completed}<p class="completed" role="status">Conversación completada</p>{/if}
 {/if}
</div>
<style>
 .routing-chat{display:flex;flex-direction:column;flex:1;min-height:280px;height:100%;overflow:hidden}.routing-chat iframe{border:0;width:100%;flex:1;min-height:280px;border-radius:12px}.loading{visibility:hidden}.completed{font-size:12px;text-align:center;color:#566379;margin:8px 0}button{padding:10px 16px;border:1px solid #dce1ec;background:white;border-radius:9px;cursor:pointer}
</style>
