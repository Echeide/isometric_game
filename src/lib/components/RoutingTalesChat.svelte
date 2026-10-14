<script lang="ts">
 import {localizeChat} from '$lib/i18n/adventure';
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import type {ModuleStatus} from '$lib/story/types';
 import {onMount} from 'svelte';
 import {chatUrl,parseChat,openingNode,type ChatConfig} from '$lib/chat/routingtales';
 let {currentLang='es',adventure,storage,resource,config:embedded,progressKey,onclose,onprogress,onstate}:{currentLang?:string;adventure?:import('../demo/adventure').Adventure;storage?:Pick<Storage,'getItem'|'setItem'>;resource:string;config?:ChatConfig;progressKey:string;onclose:()=>void;onprogress?:(node:string)=>void;onstate?:(status:ModuleStatus)=>void}=$props();
 let frame=$state<HTMLIFrameElement>();
 function sendInterface(){frame?.contentWindow?.postMessage({channel:'routingtales-chat-v1',type:'interface',locale:ui.locale,labels:{input:ui.locale==='en'?'Type a message…':'Escribe algo…',send:ui.locale==='en'?'Send message':'Enviar mensaje',clear:ui.locale==='en'?'Clear input':'Limpiar entrada'}},'*');}
 $effect(()=>{ui.locale;if(!loading)sendInterface();});
 let error=$state(''),loading=$state(true),completed=$state(false);
 onMount(()=>{
  const abort=new AbortController();let config:ChatConfig|undefined,ready=false,sent=false,startNode='';
  const report=(node:string)=>onstate?.(node==='success'?'completed':node==='fail'?'failed':'started');
  const timeout=setTimeout(()=>{if(loading)error="La conversación está tardando demasiado. Puedes volver a intentarlo.";},15000);
  function configure(){if(!config||!ready||sent)return;sent=true;let saved:string|null=null;try{saved=(storage??localStorage).getItem(progressKey);}catch{/* Storage can be unavailable. */}
   startNode=openingNode(config,saved);frame?.contentWindow?.postMessage({channel:'routingtales-chat-v1',type:'configure',config,startNode},'*');
  }
  function receive(event:MessageEvent){
   if(event.source!==frame?.contentWindow||event.data?.channel!=='routingtales-chat-v1')return;
   if(event.data.type==='ready'){ready=true;configure();}
   if(event.data.type==='configured'){loading=false;clearTimeout(timeout);sendInterface();report(startNode);}
   if(event.data.type==='error'){loading=false;error="No se ha podido mostrar esta conversación.";clearTimeout(timeout);}
   if(event.data.type==='close')onclose();
   if(event.data.type==='node'&&config?.chatNodes.some(n=>n.id===event.data.id)){
    completed=event.data.id==='success';report(event.data.id);
    try{const previous=(storage??localStorage).getItem(progressKey);(storage??localStorage).setItem(progressKey,event.data.id);if(previous!==event.data.id)onprogress?.(event.data.id);}catch{/* Continue playing without persistence. */}
   }
  }
  window.addEventListener('message',receive);
  void (async()=>{try{
   const url=embedded?location.href:chatUrl(resource);
   if(embedded)config=parseChat(JSON.parse(JSON.stringify(embedded)));
   else {const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw new Error(ui.text("No se pudo cargar el archivo de conversación."));config=parseChat(await response.json());}
   // Substitute in text only; never alter ids, targets or URLs.
   const localizedConfig=localizeChat(adventure,config,resource,currentLang);
   config={...localizedConfig,avatar:localizedConfig.avatar?new URL(localizedConfig.avatar,new URL(url,location.href)).href:new URL('/modules/routingtales-chat/avatar.svg',location.href).href,chatNodes:localizedConfig.chatNodes.map(node=>({...node,messages:node.messages?.map(m=>Array.isArray(m)?m.map(t=>t.replaceAll('{playerName}',ui.text("Explorador"))):m.replaceAll('{playerName}',ui.text("Explorador"))) as typeof node.messages}))};
   configure();
  }catch(e){if(!abort.signal.aborted){error=(e as Error).message;loading=false;clearTimeout(timeout);}}})();
  return()=>{abort.abort();clearTimeout(timeout);window.removeEventListener('message',receive);};
 });
</script>
<div class="routing-chat">
 {#if error}<div role="alert"><p>{ui.text(error)}</p><button onclick={onclose}>{ui.text("Volver al mapa")}</button></div>{:else}
 {#if loading}<p role="status">{ui.text("Cargando conversación…")}</p>{/if}
 <iframe bind:this={frame} src="/modules/routingtales-chat/index.html" title={ui.text("Conversación RoutingTales")} sandbox="allow-scripts" class:loading></iframe>
 {#if completed}<p class="completed" role="status">{ui.text("Conversación completada")}</p>{/if}
 {/if}
</div>
<style>
 .routing-chat{display:flex;flex-direction:column;flex:1;min-height:280px;height:100%;overflow:hidden}.routing-chat iframe{border:0;width:100%;flex:1;min-height:280px;border-radius:12px}.loading{visibility:hidden}.completed{font-size:12px;text-align:center;color:#566379;margin:8px 0}button{padding:10px 16px;border:1px solid #dce1ec;background:white;border-radius:9px;cursor:pointer}
</style>
