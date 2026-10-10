<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {onMount} from 'svelte';
 import RoutingTalesChat from '../components/RoutingTalesChat.svelte';
 import RoutingModulePlayer from './RoutingModulePlayer.svelte';
 import type {ModuleResult} from './routing';
 import {embeddedChat,type AdventureChat} from '../chat/editor';
 import type {ContentModule} from './types';
 import type {ModuleStatus} from '../story/types';
 let {module,currentLang='es',adventure,chats=[],storage,progressKey,onstate,oncontinue,onclose,onprogress,onbackground}:{module:ContentModule;currentLang?:string;adventure?:import('../demo/adventure').Adventure;chats?:AdventureChat[];storage:Pick<Storage,'getItem'|'setItem'>;progressKey:string;onstate:(status:ModuleStatus,result?:ModuleResult)=>boolean|void;oncontinue:()=>void;onclose:()=>void;onprogress?:(node:string)=>void;onbackground?:(result:ModuleResult)=>boolean|Promise<boolean>}=$props();
 onMount(()=>{if(module.type==='context')onstate('started');});
 function continueContext(){onstate('completed');oncontinue();}
</script>
{#if module.type==='context'}<h2>{module.title}</h2><div class="context-text">{#each module.text.split(/\n\s*\n/) as paragraph}<p>{paragraph}</p>{/each}</div><button class="continue" onclick={continueContext}>{ui.text("Continuar")}</button>
{:else if module.type!=='chat'}<RoutingModulePlayer {currentLang} controlledLanguage={!!adventure?.localization} {module} {storage} {progressKey} {onstate} {oncontinue} {onclose} {onbackground}/>{:else if module.resourceId}<RoutingTalesChat {currentLang} {adventure} config={embeddedChat(chats,module.resourceId)} resource={module.resourceId} {storage} {progressKey} {onstate} {onclose} {onprogress}/>
{:else}<p role="alert">{ui.text("Este módulo todavía no tiene una conversación configurada.")}</p>{/if}
<style>.context-text{line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}h2{font-size:24px;margin:12px 0}.continue{padding:12px 18px;border:0;border-radius:10px;background:#385d43;color:white;font:inherit;cursor:pointer}.continue:focus-visible{outline:2px solid #789557;outline-offset:3px}</style>
