<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {onMount,onDestroy,untrack} from 'svelte';
 import {get} from 'svelte/store';
 import {safeModuleHtml} from './rich-text';
 import {readAttempt,resultPoints,validateQuestionAnswer,localized,emptyAttempt,type RoutingContentModule,type ModuleResult,type ModuleAttempt} from './routing';
 import type {ModuleStatus} from '../story/types';
 import {audioPlayer} from './routingtales/audio/audioPlayer.js';
 import {notices,toast} from './routingtales/shared/toast.js';
 import './routingtales/utilities.css';
 let {module:inputModule,storage,progressKey:inputProgressKey,currentLang='es',controlledLanguage=false,preview=false,onstate,oncontinue,onclose,onbackground}:{module:RoutingContentModule;storage:Pick<Storage,'getItem'|'setItem'>;progressKey:string;currentLang?:string;controlledLanguage?:boolean;preview?:boolean;onstate:(status:ModuleStatus,result?:ModuleResult)=>boolean|void;oncontinue:()=>void;onclose:()=>void;onbackground?:(result:ModuleResult)=>boolean|Promise<boolean>}=$props();
 const module=untrack(()=>JSON.parse(JSON.stringify(inputModule)) as RoutingContentModule),progressKey=untrack(()=>inputProgressKey),backgroundCompletion=untrack(()=>onbackground);
 let Player=$state<any>(),prepared=$state<any>(),instance=$state<any>(),attempt=$state<ModuleAttempt>(emptyAttempt()),ready=$state(false),error=$state(''),submitting=$state(false),persisted=$state(false),previewDone=$state(false);
 let disposed=false;
 const done=$derived(attempt.status==='completed'||attempt.status==='failed');
 let language=$state(untrack(()=>currentLang));
 const runtimeModule=$derived(prepared?{...prepared,language,points:resultPoints(module,{status:attempt.status==='failed'?'failed':'completed',failures:attempt.failures,hintsUsed:attempt.hintsUsed})}:null);
 const availableLanguages=Object.keys(typeof module.content.body==='object'?module.content.body:{es:module.content.body});
 $effect(()=>{if(controlledLanguage)language=currentLang;});
 const feedback=$derived(done?inputModule.points.context?.[attempt.status==='completed'?'win':'fail']:undefined);
 function save(){storage.setItem(progressKey,JSON.stringify(attempt));}
 function checkpoint(value:Partial<ModuleAttempt>){attempt={...attempt,...value};try{save();error='';}catch{error="No se pudo guardar el progreso del módulo en este navegador.";}}
 function finish(outcome:'completed'|'failed',answer:string){const result:ModuleResult={status:outcome,points:resultPoints(module,{status:outcome,failures:attempt.failures,hintsUsed:attempt.hintsUsed}),failures:attempt.failures,hintsUsed:[...attempt.hintsUsed],answer};
  if(onstate(outcome,result)===false){error="No se pudo aplicar el resultado. Revisa las condiciones y vuelve a intentarlo.";return false;}checkpoint({status:outcome,answer});if(preview)previewDone=true;return true;
 }
 function complete(event:CustomEvent<{answer?:string;failures?:number;hintsUsed?:string[]}>){if(submitting||done)return;submitting=true;try{const detail=event.detail,answer=String(detail.answer??'');if(module.type==='question'){
    const known=(detail.hintsUsed??attempt.hintsUsed).filter(id=>module.content.hints?.some(h=>h.id===id));checkpoint({hintsUsed:known});
    if(!validateQuestionAnswer(inputModule,answer)){instance?.setWrongAnswer();const failures=attempt.failures+1;checkpoint({failures,answer,status:'started'});if(module.content.maxAttempts&&failures>=module.content.maxAttempts)finish('failed',answer);return;}
   }finish('completed',answer);
  }catch(e){error=(e as Error).message;}finally{submitting=false;}}
 async function completeBackground(){if(disposed&&module.content.backgroundAudio!==true)return false;const result:ModuleResult={status:'completed',points:resultPoints(module,{status:'completed',failures:attempt.failures,hintsUsed:attempt.hintsUsed}),failures:attempt.failures,hintsUsed:attempt.hintsUsed,answer:'__info_read__'};const saved=await backgroundCompletion?.(result);if(saved){attempt={...attempt,status:'completed',answer:result.answer};try{save();}catch{}return true;}return false;}
 function prepare(value:RoutingContentModule,locale:string){
    const content=JSON.parse(JSON.stringify(value.content)),sanitize=(value:any)=>typeof value==='string'?safeModuleHtml(value):Object.fromEntries(Object.entries(value??{}).map(([l,v])=>[l,safeModuleHtml(String(v))]));
    let body=sanitize(content.body);if(value.type==='info'&&content.blocks?.length){const extra=content.blocks.map((b:any)=>{if(b.type==='text')return safeModuleHtml(b.value);const figure=document.createElement('figure'),image=document.createElement('img');image.src=b.value;image.alt=b.caption??'';figure.append(image);if(b.caption){const caption=document.createElement('figcaption');caption.textContent=b.caption;figure.append(caption);}return safeModuleHtml(figure.outerHTML);}).join('');body=typeof body==='string'?body+extra:Object.fromEntries(Object.entries(body).map(([lang,value])=>[lang,String(value)+extra]));}content.content=body;content.title=sanitize(content.title||{[locale]:value.title});Object.assign(content,typeof body==='string'?{[locale]:body}:body);content.title=content.title||{[locale]:value.title};
    if(content.blocks)content.blocks=content.blocks.map((b:any)=>({...b,value:b.type==='text'?safeModuleHtml(b.value):b.value}));
    return {id:progressKey,type:value.type.toUpperCase(),points:value.points.win,content};
 }
 $effect(()=>{if(ready)prepared=prepare(inputModule,currentLang);});
 onMount(()=>{let mounted=true;void(async()=>{try{attempt=readAttempt(storage,progressKey,module);if(!done)onstate('started');else onstate(attempt.status,{status:attempt.status as 'completed'|'failed',points:resultPoints(module,{status:attempt.status as 'completed'|'failed',failures:attempt.failures,hintsUsed:attempt.hintsUsed}),failures:attempt.failures,hintsUsed:attempt.hintsUsed,answer:attempt.answer??''});
    prepared=prepare(inputModule,currentLang);
    const component=module.type==='info'?await import('./routingtales/info/ModuleInfo.svelte'):module.type==='video'?await import('./routingtales/video/ModuleVideo.svelte'):await import('./routingtales/question/ModuleQuestion.svelte');if(!mounted)return;Player=component.default;ready=true;
   }catch(e){error=(e as Error).message;}})();return()=>{mounted=false;};});
 onDestroy(()=>{disposed=true;if(module.type==='info'&&module.content.backgroundAudio!==true&&get(audioPlayer).trackKey?.includes(progressKey))audioPlayer.close();});
</script>
<div class="routing-module" data-routing-module={module.type}>{#if availableLanguages.length>1&&!controlledLanguage}<label class="language-control">{ui.text("Idioma")}<select aria-label={ui.text("Idioma del módulo")} bind:value={language}>{#each availableLanguages as lang}<option value={lang}>{lang}</option>{/each}</select></label>{/if}{#if error}<p role="alert" class="module-error">{ui.text(error)}</p>{/if}{#each $notices as message}<p role="alert" class="module-error">{ui.text(message)}</p>{/each}
 {#if ready&&Player&&prepared}<Player bind:this={instance} module={runtimeModule} completed={done} reviewMode={attempt.status==='failed'} submitting={submitting} interfaceLocale={ui.locale} currentLang={language} playerAlias="Explorador" failures={attempt.failures} persistedHintIds={attempt.hintsUsed} savedResponse={attempt.answer??null} persistedPercent={attempt.watchPercent??0} persistedMediaTime={attempt.mediaTime??0} audioCompletionContext={module.type==='info'&&module.content.backgroundAudio===true?{complete:completeBackground}:null} checkpointAttempt={(value:Partial<ModuleAttempt>)=>checkpoint(value)} on:complete={complete}/>

 {#if done}<div class="result" role="status"><strong>{attempt.status==='completed'?ui.text("Módulo completado"):ui.text("Módulo fallado")} · {resultPoints(module,{status:attempt.status==='completed'?'completed':'failed',failures:attempt.failures,hintsUsed:attempt.hintsUsed})} {ui.text("puntos")}</strong>{#if feedback}<p>{feedback}</p>{/if}<button onclick={oncontinue}>{ui.text("Continuar")}</button></div>{/if}
 {:else if !error}<p role="status">{ui.text("Preparando módulo…")}</p>{/if}</div>
<style>.routing-module{--rt-text-primary:#293d32;--rt-text-secondary:#53685b;--rt-text-muted:#738579;--rt-surface:#fff;--rt-surface-soft:#eff4eb;--rt-surface-hover:#e4ecd9;--rt-border-subtle:#d6dfce;--rt-primary:#517146;color:#293d32;min-width:0;font-family:inherit}.language-control{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:8px 12px;font-size:12px}.language-control select{border:1px solid #d6dfce;border-radius:6px;padding:5px;background:#fff;color:#35502f}.module-error{color:#9c493a;padding:10px}.result{padding:18px;border-top:1px solid #d6dfce;line-height:1.5}.result button{display:block;margin-top:14px;padding:10px 18px;border:1px solid #d6dfce;border-radius:8px;background:#dfeccd;color:#35502f;cursor:pointer}.routing-module :global(.rt-rich-text){line-height:1.7;overflow-wrap:anywhere}.routing-module :global(.rt-rich-text img){max-width:100%;height:auto}.routing-module :global(button){font-family:inherit}.routing-module :global(svg){flex-shrink:0}.routing-module :global(input){color:#293d32}.routing-module :global(h2),.routing-module :global(h3){color:#293d32}.routing-module :global(.module-info-content){color:#53685b}</style>
