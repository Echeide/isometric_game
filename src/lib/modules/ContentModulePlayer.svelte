<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {onMount} from 'svelte';
 import RoutingTalesChat from '../components/RoutingTalesChat.svelte';
 import RoutingModulePlayer from './RoutingModulePlayer.svelte';
 import ContextSlidesPlayer from './ContextSlidesPlayer.svelte';
 import {contextSlides} from './context-slides';
 import type {ModuleResult} from './routing';
 import {embeddedChat,type AdventureChat} from '../chat/editor';
 import type {ContentModule} from './types';
 import type {ModuleStatus} from '../story/types';
 let {module,currentLang='es',adventure,chats=[],storage,progressKey,onstate,oncontinue,onclose,onprogress,onbackground}:{module:ContentModule;currentLang?:string;adventure?:import('../demo/adventure').Adventure;chats?:AdventureChat[];storage:Pick<Storage,'getItem'|'setItem'>;progressKey:string;onstate:(status:ModuleStatus,result?:ModuleResult)=>boolean|void;oncontinue:()=>void;onclose:()=>void;onprogress?:(node:string)=>void;onbackground?:(result:ModuleResult)=>boolean|Promise<boolean>}=$props();
 onMount(()=>{if(module.type==='context')onstate('started');});
 function continueContext(){if(onstate('completed')===false)return false;oncontinue();return true;}
</script>
{#if module.type==='context'}<ContextSlidesPlayer slides={contextSlides(module)} onfinish={continueContext}/>
{:else if module.type!=='chat'}<RoutingModulePlayer {currentLang} controlledLanguage={!!adventure?.localization} {module} {storage} {progressKey} {onstate} {oncontinue} {onclose} {onbackground}/>{:else if module.resourceId}<RoutingTalesChat {currentLang} {adventure} config={embeddedChat(chats,module.resourceId)} resource={module.resourceId} {storage} {progressKey} {onstate} {onclose} {onprogress}/>
{:else}<p role="alert">{ui.text("Este módulo todavía no tiene una conversación configurada.")}</p>{/if}
