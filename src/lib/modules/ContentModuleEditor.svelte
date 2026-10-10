<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {onMount} from 'svelte';
 import {beforeNavigate} from '$app/navigation';
 import {Save} from 'lucide-svelte';
 import ChatEditor from '../chat/ChatEditor.svelte';
 import RoutingModuleEditor from './RoutingModuleEditor.svelte';
 import ModuleEditorHeader from '../components/ModuleEditorHeader.svelte';
 import type {AdventureChat} from '../chat/editor';
 import type {ContentModule} from './types';
 let {module,baseLocale='es',chat,title,uses=1,onapply,onclose,ondirty}:{module:ContentModule;baseLocale?:string;chat?:AdventureChat;title:string;uses?:number;onapply:(module:ContentModule,chat?:AdventureChat)=>void;onclose:()=>void;ondirty:(dirty:boolean)=>void}=$props();
 let heading=$state(''),text=$state(''),initial=$state(''),ready=$state(false),error=$state(''),discarding=$state(false);
 const dirty=$derived(ready&&JSON.stringify({heading,text})!==initial);
 onMount(()=>{if(module.type==='context'){heading=module.title;text=module.text;}initial=JSON.stringify({heading,text});ready=true;});
 $effect(()=>{if(module.type==='context')ondirty(dirty);});
 beforeNavigate(e=>{if(module.type==='context'&&dirty&&!confirm(ui.text("¿Descartar los cambios de este contexto?")))e.cancel();});
 function leave(){if(dirty)discarding=true;else onclose();}
 function apply(){if(!heading.trim()||!text.trim()){error='Escribe un título y un texto para el contexto.';return;}try{onapply({id:module.id,type:'context',title:heading.trim(),text});}catch(e){error=(e as Error).message;}}
 function keydown(e:KeyboardEvent){if(module.type==='context'&&e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();leave();}}
 function unload(e:BeforeUnloadEvent){if(module.type==='context'&&dirty){e.preventDefault();e.returnValue='';}}
</script>
<svelte:window onkeydown={keydown} onbeforeunload={unload}/>
{#if module.type==='chat'}<ChatEditor {chat} {title} {uses} {ondirty} {onclose} onapply={(name,config)=>{if(chat)onapply({...module,resourceId:'chat:'+chat.id},{...chat,name,config});}}/>
{:else if module.type!=='context'}<RoutingModuleEditor {baseLocale} {module} {title} {onclose} {ondirty} onapply={m=>onapply(m)}/>{:else}<section class="context-editor" aria-label={ui.text("Editor de contexto")}><ModuleEditorHeader title={ui.text("Contexto")} context={title} onclose={leave}/><div class="content"><label>{ui.text("Título")}<input aria-label={ui.text("Título del contexto")} bind:value={heading} maxlength="120"/></label><label>{ui.text("Texto")}<textarea aria-label={ui.text("Texto del contexto")} bind:value={text} maxlength="12000" rows="12" placeholder={ui.text("Explica qué ocurre en este punto de la historia…")}></textarea></label>{#if error}<p role="alert">{ui.text(error)}</p>{/if}{#if discarding}<div role="alert"><p>{ui.text("¿Descartar los cambios de este contexto?")}</p><button onclick={onclose}>{ui.text("Descartar")}</button><button onclick={()=>discarding=false}>{ui.text("Seguir editando")}</button></div>{/if}</div><footer><button class="apply" onclick={apply}><Save size={17}/> {ui.text("Aplicar al borrador")}</button></footer></section>{/if}
<style>.context-editor{display:flex;flex-direction:column;height:100%;min-height:0;color:#35502f;font-size:12px}.content{flex:1;overflow:auto;padding:18px}label{display:block;margin-bottom:18px}input,textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;padding:10px;border:1px solid #d5dfce;border-radius:7px;background:white;font:inherit;color:inherit}textarea{resize:vertical;min-height:220px}footer{padding:14px;border-top:1px solid #dce5d6;display:flex;justify-content:flex-end}button{display:inline-flex;align-items:center;gap:7px;padding:10px;border:1px solid #d5dfce;border-radius:7px;background:white;font:inherit;color:inherit;cursor:pointer}.apply{background:#dfeccd}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #789557;outline-offset:2px}</style>
