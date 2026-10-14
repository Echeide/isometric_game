<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import ChatEditor from '../chat/ChatEditor.svelte';
 import RoutingModuleEditor from './RoutingModuleEditor.svelte';
 import ContextSlidesEditor from './ContextSlidesEditor.svelte';
 import type {AdventureChat} from '../chat/editor';
 import type {ContentModule} from './types';
 let {module,baseLocale='es',locales=[],chat,title,uses=1,onapply,onclose,ondirty}:{module:ContentModule;baseLocale?:string;locales?:string[];chat?:AdventureChat;title:string;uses?:number;onapply:(module:ContentModule,chat?:AdventureChat)=>void;onclose:()=>void;ondirty:(dirty:boolean)=>void}=$props();
</script>
{#if module.type==='chat'}<ChatEditor {chat} {title} {uses} {ondirty} {onclose} onapply={(name,config)=>{if(chat)onapply({...module,resourceId:'chat:'+chat.id},{...chat,name,config});}}/>
{:else if module.type!=='context'}<RoutingModuleEditor {baseLocale} {locales} {module} {title} {onclose} {ondirty} onapply={m=>onapply(m)}/>{:else}<ContextSlidesEditor {module} {title} {onclose} {ondirty} onapply={m=>onapply(m)}/>{/if}
