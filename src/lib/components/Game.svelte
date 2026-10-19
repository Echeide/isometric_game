<script lang="ts">
 import {adventureLocale,adventureLanguages,adventureText,localizeScene,localizeModule} from '$lib/i18n/adventure';import {languageName} from '$lib/i18n/locale';
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 let {published=null}:{published?:{adventure:Adventure;graphics:import("@isometrico/world").PixelArtPack;key?:string}|null}=$props();
 import {applyModuleResult,moduleScore} from '$lib/modules/module-results';
 import type {ModuleResult} from '$lib/modules/routing';
 import AudioDock from '$lib/modules/AudioDock.svelte';
 import {audioPlayer} from '$lib/modules/routingtales/audio/audioPlayer.js';
 import {narrativeEvent,narrativeStatus,scheduleNarratives,resumeNarratives,canBeginNarrative,beginNarrative,advanceNarrative,setNarrativeStatus,narrativeChatKey} from '$lib/story/narrative';
 import {statusLabels,emptyStory,type StoryProgress,type EntityRef,type ModuleStatus,type StoryEvent} from '$lib/story/types';
 import {saveStory} from '$lib/story/progress';
 import {availability,resolveStoryScene,react,setObjectState,setModuleStatus,moduleStatus} from '$lib/story/engine';
 let story=$state<StoryProgress>(emptyStory()),conditionMessage=$state('');
 function refreshStoryWorld(){arrivalCamera=controller?.getCamera()??arrivalCamera;arrivalFacing=controller?.getFacing()??arrivalFacing;const cell=controller?.getPlayerCell?.();if(cell)currentScene={...currentScene,spawn:cell};controller=undefined;worldKey++;}
 function commitStory(p:StoryProgress,i:typeof inventory,messages:string[]=[]){if(!adventure)return;if(!messages.length&&JSON.stringify(p)===JSON.stringify(story)&&JSON.stringify(i)===JSON.stringify(inventory))return;const before=JSON.stringify(resolveStoryScene(adventure,currentScene,story,inventory).entities),after=JSON.stringify(resolveStoryScene(adventure,currentScene,p,i).entities);try{session!.transaction(()=>saveStory(progressStorage,adventure!.id,p,i));testError='';}catch(e){testError=ui.text('No se pudo guardar el progreso en este navegador.');throw e;}story=p;inventory=i;if(before!==after)refreshStoryWorld();messages.forEach(record);}
 function storyEvent(ref:EntityRef,event:StoryEvent,moduleId?:string,p=$state.snapshot(story)){if(!adventure)return;const result=react(adventure,p,$state.snapshot(inventory),ref,event,moduleId);commitStory(result.progress,result.inventory,result.messages);}
 function testState(ref:EntityRef,stateId:string){if(!adventure)return;try{commitStory(setObjectState(adventure,$state.snapshot(story),ref,stateId),$state.snapshot(inventory));record('Estado de objeto simulado: '+(adventure.story?.entities.find(e=>e.mapId===ref.mapId&&e.entityId===ref.entityId)?.states.find(s=>s.id===stateId)?.name??stateId));}catch(e){testError=(e as Error).message;}}
 function testModule(ref:EntityRef,moduleId:string,value:ModuleStatus,reactions=false){if(!adventure)return;try{const p=setModuleStatus(adventure,$state.snapshot(story),ref,moduleId,value);if(reactions&&value!=='not-started')storyEvent(ref,('module.'+value) as StoryEvent,moduleId,p);else commitStory(p,$state.snapshot(inventory));record('Progreso de módulo simulado: '+statusLabels[value]);}catch(e){testError=(e as Error).message;}}
 function testItem(id:string,quantity:number){if(!adventure||!adventure.items?.some(i=>i.id===id)||!Number.isSafeInteger(quantity)||quantity<0)return;try{commitStory($state.snapshot(story),{...$state.snapshot(inventory),counts:{...inventory.counts,[id]:quantity}});record('Inventario simulado: '+id+' × '+quantity);}catch(e){testError=(e as Error).message;}}
 function objectModuleState(id:string,value:ModuleStatus,detail?:ModuleResult){if(!adventure||panel!=='chat'||currentObjectModule?.id!==id)return false;try{const ref={mapId:currentScene.id,entityId:resourceEntityId},result=reportObjectModule(adventure,$state.snapshot(story),$state.snapshot(inventory),ref,id,value),progress=detail?applyModuleResult(adventure,result.progress,{kind:'object',...ref},id,detail):result.progress;commitStory(progress,result.inventory,result.messages);objectModuleId=result.moduleId;objectModulesFinished=result.finished||objectModulesFinished;moduleError='';return true;}catch(e){moduleError=(e as Error).message;record('No se aplicó el resultado del módulo: '+moduleError);return false;}}
 function objectContinue(){if(!moduleError&&(objectModulesFinished||adventure&&currentObjectModule&&['completed','failed'].includes(moduleStatus(story,{mapId:currentScene.id,entityId:resourceEntityId},currentObjectModule.id))))void closePanel();}
 function objectBackground(ref:EntityRef,id:string,adventureId:string,generation:number,detail:ModuleResult){if(disposed||generation!==sessionGeneration||phase!=='playing'||!adventure||adventure.id!==adventureId)return false;try{const result=reportObjectModule(adventure,$state.snapshot(story),$state.snapshot(inventory),ref,id,detail.status);commitStory(applyModuleResult(adventure,result.progress,{kind:'object',...ref},id,detail),result.inventory,result.messages);return true;}catch{return false;}}
 function narrativeBackground(id:string,moduleId:string,run:number,adventureId:string,generation:number,detail:ModuleResult){if(disposed||generation!==sessionGeneration||phase!=='playing'||!adventure||adventure.id!==adventureId||story.narrative?.[id]?.run!==run||story.narrative[id].status!=='started'||story.narrative[id].moduleId!==moduleId)return false;try{const result=advanceNarrative(adventure,$state.snapshot(story),$state.snapshot(inventory),id,detail.status);commitStory(applyModuleResult(adventure,result.progress,{kind:'event',eventId:id},moduleId,detail,run),result.inventory,result.messages);return true;}catch{return false;}}
 function checkInteraction(event:WorldInteraction){if(!adventure)return true;const v=availability(adventure,story,inventory,{mapId:event.sceneId,entityId:event.entityId});if(v.visible&&v.interactive)return true;conditionMessage=adventureText(adventure,contentLanguage,['entity',event.sceneId,event.entityId,'blockedMessage'],v.message);information=null;panel='condition';record('Interacción bloqueada: '+v.message);return false;}
 import AdventureTests from '$lib/components/AdventureTests.svelte';
 import {writeProgress,appendActivity,milestones,type Activity} from '$lib/demo/test-progress';
 const progressPrefix=()=>published?'public:'+published.key:'preview:'+storageScope();
 import {scopedStorage} from '$lib/storage/scoped-storage';
 const legacyStorage=scopedStorage(()=>localStorage,progressPrefix);
 import {localGameSaves,createGameSession,newGameSave,restoreGame,gameSaveKey,type GameSave,type GameSaveRepository,type GameSession,type PlayerPosition} from '$lib/storage/game-save';
 import PlayerMenu from '$lib/components/PlayerMenu.svelte';
 let progressStorage=$state.raw<Storage>(legacyStorage);
 let session:GameSession|undefined,repository:GameSaveRepository|undefined,saveTimer:ReturnType<typeof setTimeout>|undefined;
 let sessionGeneration=$state(0);
 let playerPosition:PlayerPosition={mapId:'',cell:{x:0,y:0},facing:'se'};
 let phase=$state<'boot'|'menu'|'loading'|'playing'>('boot'),savedGame=$state.raw<GameSave|null>(null),menuError=$state(''),restoreNotice=$state('');
 function saveCheckpoint(){clearTimeout(saveTimer);saveTimer=undefined;if(!session||phase!=='playing')return true;try{session.transaction(()=>{writeProgress(progressStorage,adventure!.id,{tasks:$state.snapshot(tasks),completed:[...completed],log:$state.snapshot(activityLog)});saveStory(progressStorage,adventure!.id,$state.snapshot(story),$state.snapshot(inventory));});testError='';return true;}catch{testError=ui.text('No se pudo guardar el progreso en este navegador.');return false;}}
 function playerChanged(value:import('@isometrico/world').WorldPlayerState){if(phase!=='playing'||!controller||value.sceneId!==currentScene.id)return;playerPosition={mapId:value.sceneId,cell:{...value.cell},facing:value.facing};if(!value.moving)saveCheckpoint();else if(!saveTimer)saveTimer=setTimeout(saveCheckpoint,500);}
 function openGameMenu(){if(phase!=='playing'||assetsLoading||transitionImage||!saveCheckpoint())return false;audioPlayer.close();savedGame=session!.saved;session!.close();sessionGeneration++;session=undefined;progressStorage=legacyStorage;controller=undefined;panel=null;information=null;narrativeId=null;phase='menu';mapsReady=false;menuError='';graphicsAbort.abort();graphicsLoader?.release();graphicsLoader=undefined;return true;}
 let activityLog=$state<Activity[]>([]),testError=$state('');
 function record(message:string){if(!adventure)return;activityLog=appendActivity(activityLog,message);try{writeProgress(progressStorage,adventure.id,{tasks:$state.snapshot(tasks),completed:[...completed],log:$state.snapshot(activityLog)});testError='';}catch{testError=ui.text("No se pudo guardar el progreso en este navegador.");}}
 function toggleTestGoal(key:string){if(!adventure)return;const goal=milestones(adventure).find(g=>g.key===key);if(!goal)return;const wasDone=completed.includes(key);completed=wasDone?completed.filter(k=>k!==key):[...completed,key];record(`${wasDone?'Reabierto':'Completado'} desde pruebas: ${goal.label} (${goal.map}).`);}
 function toggleTestTask(id:string){const task=tasks.find(t=>t.id===id);if(!task)return;const wasDone=task.status==='done';tasks=tasks.map(t=>t.id===id?{...t,status:wasDone?'todo':'done'}:t);record(`${wasDone?'Reabierta':ui.text("Completada")} desde pruebas: ${task.title}.`);}
 function restartAdventure(){if(openGameMenu())void startGame('new');}

 import ContentModulePlayer from '$lib/modules/ContentModulePlayer.svelte';
 import {objectContentModules} from '$lib/modules/adventure-modules';
 import {contentProgressKey,contentModuleName} from '$lib/modules/content';
 import {beginObjectModules,reportObjectModule} from '$lib/modules/runtime';
 import InfoBubble from '$lib/components/InfoBubble.svelte';
 let information=$state<WorldInteraction|null>(null);
 let obtained=$state<{name:string;quantity:number}|null>(null);

 import {collectedIds,collectItem,useExit,emptyInventory} from '$lib/demo/inventory';
 let inventory=$state(emptyInventory());

 import {resolveEnvironment} from '@isometrico/world';
 let panMode=$state(false);
 import { graphics as defaultGraphics } from '$lib/demo/pixelart';
 import LoadProgress from '$lib/components/LoadProgress.svelte';
 import type {LoadProgress as Progress} from '$lib/storage/preload';
 import {resourceBlob,localAdventures,storageScope} from '$lib/storage/local-adventures';
 import {adventureEntry,createMapGraphicsLoader} from '$lib/storage/map-graphics';
 import {onDestroy} from 'svelte';
 let graphics=$state.raw(defaultGraphics);
 let graphicsLoader:ReturnType<typeof createMapGraphicsLoader>|undefined;
 let disposed=false,graphicsAbort=new AbortController(),sceneRequest=0;
 let loadProgress=$state<Progress|null>(null),assetsLoading=$state(false);
 async function loadGraphics(value:Adventure,initial:WorldScene){
  controller=undefined;assetsLoading=true;loadProgress=null;loadError='';
  graphicsAbort.abort();graphicsLoader?.release();graphicsAbort=new AbortController();
  const signal=graphicsAbort.signal;
  try{
   const pack=published?published.graphics:await localAdventures.pack(value.id);signal.throwIfAborted();
   graphicsLoader=createMapGraphicsLoader(pack,value,async url=>{
    if(!published)return resourceBlob(url,localAdventures,signal);
    const response=await fetch(url,{signal});if(!response.ok)throw new Error(ui.text("No se pudo descargar un gráfico."));return response.blob();
   },signal);
   graphics=await graphicsLoader.ensure(initial,{onProgress:p=>loadProgress=p});
  }finally{assetsLoading=false;}
 }

 onDestroy(()=>{saveCheckpoint();session?.close();clearTimeout(saveTimer);disposed=true;sceneRequest++;audioPlayer.close();graphicsAbort.abort();graphicsLoader?.release();});
 import { tick,onMount } from 'svelte';
 import MapDissolve from '$lib/components/MapDissolve.svelte';
 import {objectiveKey} from '$lib/demo/playable-adventure';
 import {loadAdventureLibrary,selectAdventure} from '$lib/storage/local-adventures';
 let adventures=$state<Adventure[]>([]);
 import {createTraveler,type Adventure} from '$lib/demo/adventure';
 import {type WorldScene,type Facing,type CameraAction} from '@isometrico/world';
 import { World, type WorldController, type WorldInteraction } from '@isometrico/world';
 import { office,outdoors,makeAdapter,initialTasks,initialGoals,type Task } from '$lib/demo/scenes';
 import { ClipboardList, LockKeyhole, Package, Backpack, Layers, LayoutGrid, Map, Menu, ChevronDown, ArrowUpRight, Plus, Minus, Scan, MousePointer2, X, Check, Play, MessageCircle, Flag, Armchair, CircleHelp, CheckCheck, Hand, LocateFixed } from 'lucide-svelte';
 let traveler:ReturnType<typeof createTraveler>|undefined;
 let adventure=$state<Adventure|null>(null),mapsReady=$state(false);let contentLanguage=$state('es');
 const contentLanguages=$derived(adventure?adventureLanguages(adventure):['es']);
 const savedMap=$derived(adventure?.maps.find(m=>m.id===savedGame?.position.mapId)??adventure?.maps.find(m=>m.id===adventure?.startMap));
 const savedMapName=$derived(savedMap?storyText(['map',savedMap.id,'name'],savedMap.name):'');
 function storyText(ids:string[],source:string){return adventureText(adventure,contentLanguage,ids,source);}
 function changeLanguage(locale:string){if(!adventure)return;contentLanguage=adventureLocale(adventure,locale);const url=new URL(location.href);url.searchParams.set('lang',contentLanguage);history.replaceState(history.state,'',url);}
 function moduleView(module:import('$lib/modules/types').ContentModule,association:string[]){return adventure?localizeModule(adventure,module,contentLanguage,association):module;}
 let currentScene=$state<WorldScene>(office);
 let mode=$state('checkpoint');
 let worldKey=$state(0);
 let arrivalFacing=$state<Facing>('se');
 let arrivalCamera:ReturnType<WorldController['getCamera']>|undefined;
 let transitionImage=$state<string|null>(null),transitionReady=$state(false);
 let loadError=$state('');
 let completed=$state<string[]>([]);
 let resourceEntityId=$state(''),objectModuleId=$state<string|null>(null),objectModulesFinished=$state(false),moduleError=$state('');
 const objectModules=$derived(adventure?objectContentModules(adventure,{mapId:currentScene.id,entityId:resourceEntityId}):[]);
 const currentObjectModule=$derived(objectModules.find(m=>m.id===objectModuleId));
 function prepareMenu(){
  if(!adventure)return;repository=localGameSaves(legacyStorage,adventure);menuError='';
  try{savedGame=repository.read();if(!savedGame&&legacyStorage.getItem(gameSaveKey(adventure.id))!==null)menuError=ui.text('La partida guardada no es compatible o está dañada. Puedes empezar un nuevo juego.');}
  catch{savedGame=null;menuError=ui.text('No se pudo leer la partida guardada en este navegador.');}
  const query=new URLSearchParams(location.search);mode=adventureEntry(adventure,{savedMapId:savedGame?.position.mapId,previewMapId:published?null:query.get('map')??query.get('world')}).id;
  phase='menu';
 }
 async function initialize(){phase='boot';narrativeQueue=[];narrativeId=null;panel=null;mapsReady=false;loadError='';loadProgress=null;try{
  const library=published?{activeId:published.adventure.id,adventures:[published.adventure]}:await loadAdventureLibrary();adventures=library.adventures;
  const requestedAdventure=new URLSearchParams(location.search).get('adventure');
  adventure=adventures.find(a=>a.id===(requestedAdventure??library.activeId))??adventures.find(a=>a.id===library.activeId)!;
  contentLanguage=adventureLocale(adventure,new URLSearchParams(location.search).get('lang'));prepareMenu();
 }catch(e){if(!disposed)loadError=`No se pudo cargar la aventura: ${(e as Error).message}`;}}
 async function startGame(choice:'new'|'continue'){
  if(!adventure||!repository||phase!=='menu')return;
  const request=++sceneRequest;phase='loading';menuError='';restoreNotice='';
  try{
   const query=new URLSearchParams(location.search),initial=adventureEntry(adventure,{previewMapId:published?null:query.get('map')??query.get('world')});
   const save=choice==='continue'?repository.read():newGameSave(adventure,initial.id);if(!save)throw Error(ui.text('No hay una partida disponible para continuar.'));
   const restored=restoreGame(adventure,save),nextTraveler=createTraveler(adventure);await loadGraphics(adventure,restored.scene);if(disposed||request!==sceneRequest)return;
   tasks=restored.progress.tasks;completed=restored.progress.completed;activityLog=restored.progress.log;story=restored.story;inventory=restored.inventory;
   currentScene=restored.scene;mode=currentScene.id;playerPosition=restored.position;arrivalFacing=playerPosition.facing;arrivalCamera=undefined;panMode=false;celebration=0;transitionImage=null;transitionReady=false;
   narrativeId=null;panel=null;information=null;obtained=null;blockedExit=null;resourceEntityId='';objectModuleId=null;objectModulesFinished=false;moduleError='';narrativeError='';testError='';
   const entry=scheduleNarratives(adventure,$state.snapshot(story),currentScene.id);story=entry.progress;
   narrativeQueue=choice==='new'?entry.ids:resumeNarratives(adventure,$state.snapshot(story),currentScene.id,save.narrativeQueue);
   sessionGeneration++;session=createGameSession(repository,save,()=>({position:structuredClone(playerPosition),narrativeQueue:[...narrativeQueue]}));progressStorage=session.storage;
   session.transaction(()=>{writeProgress(progressStorage,adventure!.id,{tasks:$state.snapshot(tasks),completed:[...completed],log:$state.snapshot(activityLog)});saveStory(progressStorage,adventure!.id,$state.snapshot(story),$state.snapshot(inventory));});
   traveler=nextTraveler;worldKey++;mapsReady=true;phase='playing';
   if(restored.adjusted&&choice==='continue')restoreNotice=ui.text('El mapa ha cambiado. Hemos ajustado tu posición a una casilla segura.');
  }catch(e){if(!disposed&&request===sceneRequest){session?.close();session=undefined;progressStorage=legacyStorage;phase='menu';mapsReady=false;graphicsLoader?.release();menuError=ui.text('No se pudo iniciar la partida: ')+(e as Error).message;}}
 }
 onMount(()=>{void initialize();const flush=()=>{saveCheckpoint();};const visibility=()=>{if(document.visibilityState==='hidden')flush();};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',visibility);};});
 function ready(c:WorldController){c.setFacing(arrivalFacing);if(arrivalCamera)c.restoreCamera(arrivalCamera);controller=c;playerPosition={mapId:currentScene.id,cell:c.getPlayerCell?.()??scene.spawn,facing:c.getFacing()};saveCheckpoint();if(panel==='chat')c.setConversation(resourceEntityId);primaryCameraAction=c.getCamera().action;transitionReady=true;graphicsLoader?.background(currentScene.id);runNarrativeQueue();}
 async function changeScene(next:WorldScene,facing:Facing,progress?:{story:StoryProgress;inventory:typeof inventory;messages:string[]}){
  const request=++sceneRequest;
  arrivalCamera=controller?.getCamera();transitionReady=false;transitionImage=controller?.captureFrame()??null;
  assetsLoading=true;loadProgress=null;
  try{const pack=await graphicsLoader!.ensure(next,{onProgress:p=>{if(request===sceneRequest)loadProgress=p;}});if(disposed||request!==sceneRequest)return;graphics=pack;}
  catch(e){if(!disposed&&request===sceneRequest){transitionImage=null;transitionReady=true;status=`No se pudo cargar el mapa: ${(e as Error).message}`;}return;}
  finally{if(request===sceneRequest)assetsLoading=false;}
  const nextInventory=progress?.inventory??$state.snapshot(inventory),entry=scheduleNarratives(adventure!,progress?.story??$state.snapshot(story),next.id);
  const nextLog=(progress?.messages??[]).reduce((log,message)=>appendActivity(log,message),$state.snapshot(activityLog));
  const previousPosition=playerPosition,previousQueue=narrativeQueue;playerPosition={mapId:next.id,cell:{...next.spawn},facing};narrativeQueue=entry.ids;
  try{session!.transaction(()=>{writeProgress(progressStorage,adventure!.id,{tasks:$state.snapshot(tasks),completed:[...completed],log:nextLog});saveStory(progressStorage,adventure!.id,entry.progress,nextInventory);});}
  catch(e){playerPosition=previousPosition;narrativeQueue=previousQueue;transitionImage=null;transitionReady=true;testError=ui.text('No se pudo guardar el progreso en este navegador.');throw e;}
  story=entry.progress;inventory=nextInventory;activityLog=nextLog;celebration=0;arrivalFacing=facing;controller=undefined;currentScene=next;mode=next.id;panel=null;information=null;worldKey++;status=`Has llegado a ${next.name}.`;narrativeId=null;
 }
 let tasks=$state<Task[]>(structuredClone(initialTasks));
 let panel=$state<'tests'|'obtained'|'locked'|'inventory'|'tasks'|'project'|'chat'|'goal'|'space'|'help'|'object'|'condition'|'narrative'|null>(null);
 let blockedExit=$state<{name:string;item:string;quantity:number;image?:string}|null>(null);
 const exitIndicators=$derived.by(()=>{
  const result:Record<string,import('../../../packages/world/src/types').ExitIndicator>={};
  for(const exit of adventure?.exits??[]){const r=exit.requirement;if(exit.fromMap!==currentScene.id)continue;const v=availability(adventure!,story,inventory,{mapId:exit.fromMap,entityId:exit.entityId});if(!v.visible)continue;if(!v.interactive){result[exit.entityId]={state:'locked',label:v.message};continue;}if(!r||inventory.unlocked.includes(exit.id))continue;
   const item=adventure?.items?.find(i=>i.id===r.itemId)?.name??r.itemId,ready=(inventory.counts[r.itemId]??0)>=r.quantity;
   result[exit.entityId]={state:ready?'ready':'locked',label:ready?ui.text("Puedes abrir"):ui.text("Necesitas ")+r.quantity+' × '+item};
  }return result;
 });
 let resource=$state('');
 let controller=$state<WorldController>();
 let primaryCameraAction=$state<CameraAction>('fit');
 function usePrimaryCamera(){if(!controller)return;panMode=false;controller.setPanMode(false);if(primaryCameraAction==='player')controller.focusPlayer();else controller.recenter();}
 let celebration=$state(0);
 let status=$state("Tu espacio, a tu ritmo.");
 const done=$derived(tasks.filter(t=>t.status==='done').length);
 const active=$derived(tasks.find(t=>t.status==='active'));
 const resolvedScene=$derived(adventure?resolveStoryScene(adventure,{...currentScene,entities:currentScene.entities.map(e=>({...e,completed:completed.includes(objectiveKey(currentScene.id,e.id))}))},story,inventory):currentScene);
 const scene=$derived(adventure?localizeScene(adventure,resolvedScene,contentLanguage,story):resolvedScene);
 const informationEntity=$derived(scene.entities.find(e=>e.id===information?.entityId));
 const sceneGoals=$derived(scene.entities.filter(e=>!e.pickup&&e.kind==='goal'&&e.interaction?.action!=='adventure.exit'));
 const completedGoals=$derived(sceneGoals.filter(e=>e.completed).length);
 const hasTasks=$derived(scene.entities.some(e=>e.interaction?.action==='tasks.open'||e.interaction?.action==='project.open'));
 const selectedEntity=$derived(scene.entities.find(e=>e.id===resourceEntityId)??currentScene.entities.find(e=>e.id===resourceEntityId));
 const selectedGoal=$derived(selectedEntity?{
  title:initialGoals.find(g=>g.id===resource)?.title??selectedEntity.label,
  description:initialGoals.find(g=>g.id===resource)?.description??selectedEntity.interaction?.label??ui.text("Completa este objetivo a tu ritmo."),
  done:!!selectedEntity.completed
 }:null);
 const chatName=$derived(resource==='lucia'?'Lucía Martín':resource==='marcos'?'Marcos Ruiz':selectedEntity?.label??ui.text("Conversación"));
 let narrativeQueue=$state<string[]>([]),narrativeId=$state<string|null>(null),narrativeError=$state(''),narrativeRunning=false;
 const currentNarrative=$derived(adventure&&narrativeId?narrativeEvent(adventure,narrativeId):undefined);
 const currentNarrativeRun=$derived(narrativeId?story.narrative?.[narrativeId]:undefined);
 const currentNarrativeModule=$derived(currentNarrative?.modules[currentNarrativeRun?.module??0]);

 function runNarrativeQueue(){
  if(!adventure||!controller||panel||transitionImage||narrativeRunning)return;narrativeRunning=true;
  try{while(narrativeQueue.length&&!panel){const id=narrativeQueue[0];narrativeQueue=narrativeQueue.slice(1);const event=narrativeEvent(adventure,id);if(!event||!canBeginNarrative(adventure,story,inventory,event))continue;
   const progress=beginNarrative(adventure,$state.snapshot(story),$state.snapshot(inventory),id);commitStory(progress,$state.snapshot(inventory));
   if(!event.modules.length){const result=advanceNarrative(adventure,$state.snapshot(story),$state.snapshot(inventory),id);commitStory(result.progress,result.inventory,result.messages);continue;}
   narrativeId=id;narrativeError='';information=null;opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel='narrative';record('Evento '+event.name+' · iniciado');
  }}catch(e){conditionMessage=(e as Error).message;panel='condition';record('Evento no aplicado: '+conditionMessage);}finally{narrativeRunning=false;}
 }
 function progressNarrative(outcome:'completed'|'failed'='completed',detail?:ModuleResult){
  if(!adventure||!narrativeId)return false;try{const run=story.narrative?.[narrativeId],moduleId=currentNarrativeModule?.id,result=advanceNarrative(adventure,$state.snapshot(story),$state.snapshot(inventory),narrativeId,outcome),progress=detail&&moduleId&&run?applyModuleResult(adventure,result.progress,{kind:'event',eventId:narrativeId},moduleId,detail,run.run):result.progress;commitStory(progress,result.inventory,result.messages);narrativeError='';return narrativeStatus(story,narrativeId)!=='started';}catch(e){narrativeError=(e as Error).message;record('Evento no aplicado: '+narrativeError);return false;}
 }
 function contextContinue(){if(narrativeId&&narrativeStatus(story,narrativeId)!=='started'&&!narrativeError)void closePanel();}
 function narrativeChatState(id:string,moduleId:string,value:ModuleStatus,detail?:ModuleResult){if(narrativeId!==id||currentNarrativeModule?.id!==moduleId)return false;if(value==='started'||value==='not-started')return true;if(narrativeStatus(story,id)!=='started')return true;progressNarrative(value,detail);return !narrativeError;}
 function testNarrative(id:string,status:ModuleStatus){if(!adventure)return;try{commitStory(setNarrativeStatus(adventure,$state.snapshot(story),id,status),$state.snapshot(inventory));record('Evento simulado: '+(narrativeEvent(adventure,id)?.name??id)+' · '+statusLabels[status]);}catch(e){testError=(e as Error).message;}}
 const adapter=$derived(makeAdapter(scene,openInteraction));
 let opener:HTMLElement|null=null;
 function openInteraction(event:WorldInteraction){
  if(transitionImage||panel)return;
  if(!checkInteraction(event))return;
  if(event.action==='adventure.exit'){information=null;executeInteraction(event);return;}
  information=event;
 }
 async function executeInteraction(event:WorldInteraction){
   information=null;
   if(transitionImage)return;
   if(!checkInteraction(event))return;
   if(event.action==='inventory.collect'){
    if(!adventure)return;
    try{const next=collectItem(adventure,$state.snapshot(inventory),event.sceneId,event.entityId);const reaction=react(adventure,$state.snapshot(story),next,{mapId:event.sceneId,entityId:event.entityId},'interact');commitStory(reaction.progress,reaction.inventory,reaction.messages);obtained={name:adventure.items?.find(i=>i.id===event.resourceId)?.name??ui.text("Objeto"),quantity:scene.entities.find(e=>e.id===event.entityId)?.pickup?.quantity??1};panel='obtained';record(`Objeto recogido: ${obtained.name} × ${obtained.quantity}.`);status='Has recogido '+(adventure.items?.find(i=>i.id===event.resourceId)?.name??ui.text("un objeto"))+'.';}catch(e){status=(e as Error).message;}return;
   }
   if(event.action==='adventure.exit'){
    if(!adventure)return;
    const exit=adventure.exits.find(e=>e.fromMap===event.sceneId&&e.entityId===event.entityId),requirement=exit?.requirement;
    if(exit&&requirement&&!inventory.unlocked.includes(exit.id)&&(inventory.counts[requirement.itemId]??0)<requirement.quantity){
      blockedExit={name:adventure.maps.find(m=>m.id===exit.toMap)?.name??ui.text("Salida"),item:adventure.items?.find(i=>i.id===requirement.itemId)?.name??requirement.itemId,quantity:requirement.quantity};
      const pickup=adventure.maps.flatMap(m=>m.entities).find(e=>e.pickup?.itemId===requirement.itemId);
      if(pickup?.visualId)blockedExit.image=graphics.objects[pickup.visualId]?.image;
      opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel='locked';record(`Salida cerrada: ${blockedExit.name}. Falta ${blockedExit.item}.`);return;
    }
    try{const next=traveler!(event.sceneId,event.entityId,controller?.getFacing());const progress=useExit(adventure,$state.snapshot(inventory),next.exit.id);const reaction=react(adventure,$state.snapshot(story),progress,{mapId:event.sceneId,entityId:event.entityId},'interact');await changeScene(next.scene,next.facing,{story:reaction.progress,inventory:reaction.inventory,messages:[...reaction.messages,`Viaje: ${currentScene.name} → ${next.scene.name}.`]});}
    catch(e){status=(e as Error).message;}
    return;
   }
   if(event.action!=='info.open'){try{storyEvent({mapId:event.sceneId,entityId:event.entityId},'interact');}catch(e){conditionMessage=(e as Error).message;panel='condition';return;}}
   if(event.action==='story.interact')return;
   opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
   resource=event.resourceId;resourceEntityId=event.entityId;
   if((event.action==='chat.open'||event.action==='modules.open')&&adventure){try{const result=beginObjectModules(adventure,$state.snapshot(story),$state.snapshot(inventory),{mapId:event.sceneId,entityId:event.entityId});commitStory(result.progress,result.inventory,result.messages);objectModuleId=result.moduleId;objectModulesFinished=false;moduleError='';controller?.setConversation(event.entityId);panel='chat';return;}catch(e){conditionMessage=(e as Error).message;panel='condition';return;}}
   panel=event.action==='tasks.open'?'tasks':event.action==='project.open'?'project':event.action==='chat.open'?'chat':event.action==='space.open'?'space':event.action==='goal.open'||scene.entities.find(e=>e.id===event.entityId)?.kind==='goal'?'goal':'object';
 }
 function openDialog(dialog:HTMLDialogElement){dialog.showModal();return {destroy(){dialog.close();}};}
 function dismissBackdrop(event:MouseEvent){const dialog=event.currentTarget as HTMLDialogElement,rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))void closePanel();}

 async function closePanel(){information=null;panel=null;narrativeId=null;narrativeError='';objectModuleId=null;objectModulesFinished=false;moduleError='';controller?.setConversation(null);await tick();if(opener?.isConnected)opener.focus();else document.querySelector<HTMLElement>('[role=application]')?.focus();runNarrativeQueue();}
 function shortcut(entityId:string){void closePanel().then(()=>controller?.goTo(entityId));}

 async function switchAdventure(value:string){
  if(!adventure||assetsLoading||transitionImage||value===adventure.id)return;if(phase==='playing'&&!openGameMenu())return;audioPlayer.close();
  try{
   const next=await selectAdventure(value);adventure=next;contentLanguage=adventureLocale(next);narrativeQueue=[];prepareMenu();
   const url=new URL(location.href);url.search='';url.searchParams.set('adventure',value);history.replaceState(null,'',url);
  }catch(e){menuError=(e as Error).message;}
 }

 function startTask(id:string){tasks=tasks.map(t=>({...t,status:t.id===id?'active':t.status==='active'?'todo':t.status}));status="En camino a tu puesto de trabajo.";record(`Tarea iniciada: ${tasks.find(t=>t.id===id)?.title}.`);void closePanel();}
 function finishTask(id:string){tasks=tasks.map(t=>t.id===id?{...t,status:'done'}:t);status="¡Un paso más! Tarea completada.";record(`Tarea completada: ${tasks.find(t=>t.id===id)?.title}.`);celebration++;void closePanel();}
 function pauseTask(){tasks=tasks.map(t=>t.status==='active'?{...t,status:'todo'}:t);status="Tarea en pausa.";record('Tarea pausada.');void closePanel();}
 function finishGoal(){if(!selectedEntity)return;const key=objectiveKey(scene.id,selectedEntity.id);if(!completed.includes(key))completed=[...completed,key];status="¡Objetivo completado! Tu ruta sigue avanzando.";record(`Objetivo completado: ${selectedEntity.label} (${scene.name}).`);celebration++;void closePanel();}
 function showPanel(value:'tests'|'space'|'help'|'inventory'){information=null;opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel=value;}
</script>
<AudioDock/>
<svelte:head><title>{ui.text("Isométrico — Tu espacio de trabajo")}</title><meta name="description" content={ui.text("Un espacio isométrico para trabajar, conversar y avanzar. Demo de un módulo reutilizable para SvelteKit.")}/></svelte:head>

<div class="app-shell immersive">
 <header class="topbar">
  <a class="immersive-brand" href="/" aria-label={ui.text("Isométrico, inicio")}><span class="brand-mark"><Layers size={22}/></span><span class="wordmark">isométrico</span></a>
  <div class="header-divider"></div>
  <div class="world-select"><label class="sr-only" for="world-select">{ui.text("Cambiar de aventura")}</label><div><Layers size={17}/><select id="world-select" value={adventure?.id} disabled={phase==='boot'||phase==='loading'||!!transitionImage} onchange={e=>switchAdventure(e.currentTarget.value)}>{#each adventures as item}<option value={item.id}>{storyText(['adventure','name'],item.name)}</option>{/each}</select><ChevronDown size={15}/></div></div>
  <div class="topbar-right">{#if contentLanguages.length>1}<label class="story-language" title={ui.text('Idioma de la aventura')}><span class="sr-only">{ui.text('Idioma de la aventura')}</span><select aria-label={ui.text('Idioma de la aventura')} disabled={panel==='chat'&&currentObjectModule?.type==='chat'||panel==='narrative'&&currentNarrativeModule?.type==='chat'} value={contentLanguage} onchange={event=>changeLanguage(event.currentTarget.value)}>{#each contentLanguages as language}<option value={language}>{languageName(language)}</option>{/each}</select></label>{/if}{#if !published}<a class="editor-link" href={`/sprites?adventure=${encodeURIComponent(adventure?.id??'')}`}>Sprites</a><a class="editor-link" href={`/editor?adventure=${encodeURIComponent(adventure?.id??'')}&map=${encodeURIComponent(mode)}`}>{ui.text("Editar mapa")}</a><span class="demo-badge">{ui.text("VISTA PREVIA")}</span>{/if}{#if phase==='playing'}<button class="header-action" disabled={assetsLoading||!!transitionImage} onclick={openGameMenu} aria-label={ui.text("Volver al menú")} title={ui.text("Menú de la aventura")}><Menu size={19}/></button><button class="header-action" onclick={()=>showPanel('space')} aria-label={ui.text("Abrir lugares y progreso")} title={ui.text("Lugares y progreso")}><LayoutGrid size={19}/></button><button class="header-action" onclick={()=>showPanel('help')} aria-label={ui.text("Ayuda")} title={ui.text("Ayuda")}><CircleHelp size={19}/></button>{#if Object.keys(story.moduleResults??{}).length}<span class="module-score" role="status" aria-label={ui.text("Puntos de la aventura")}>{moduleScore(story)} pts</span>{/if}<span class="avatar-mini">E</span>{/if}</div>
 </header>
 <main class="immersive-world" aria-label={ui.text("Espacio virtual")}>
  <div class:outdoors={resolveEnvironment(scene).outdoor} class="map-stage">
   {#if phase==='menu'&&adventure}{#key adventure.id}<PlayerMenu name={storyText(['adventure','name'],adventure.name)} hasSave={!!savedGame} savedAt={savedGame?.savedAt} mapName={savedMapName} error={menuError} onnew={()=>void startGame('new')} oncontinue={()=>void startGame('continue')}/>{/key}{:else if loadError}<div class="load-error"><p role="alert">{ui.text(loadError)}</p><button onclick={initialize}>{ui.text("Reintentar carga")}</button></div>{:else if !mapsReady}<div class="preload-stage"><LoadProgress progress={loadProgress}/></div>{:else if mapsReady}<World translate={ui.text} followCamera paused={!!panel||assetsLoading} {exitIndicators} hiddenIds={collectedIds(inventory,currentScene)} revision={worldKey} {panMode} {graphics} {adapter} {celebration} working={hasTasks&&!!active} onready={ready} onplayer={playerChanged} oncamera={camera=>primaryCameraAction=camera.action} onstatus={s=>status=s}/>{#if assetsLoading}<div class="preload-stage"><LoadProgress progress={loadProgress}/></div>{/if}{/if}<MapDissolve image={transitionImage} ready={transitionReady} ondone={()=>{transitionImage=null;runNarrativeQueue();}}/>
   {#if phase==='playing'}
   {#if testError||restoreNotice}<div class="save-feedback" class:save-error={!!testError} role={testError?'alert':'status'}><span>{testError||restoreNotice}</span>{#if !testError}<button onclick={()=>restoreNotice=''} aria-label={ui.text("Cerrar aviso")}><X size={16}/></button>{/if}</div>{/if}
   <div class="scene-heading"><div class="eyebrow">{adventure?storyText(['adventure','name'],adventure.name):ui.text('MI AVENTURA')}</div><h1>{scene.name}</h1><span>{ui.text(resolveEnvironment(scene).label)}</span></div>
   <div class="map-compass" aria-hidden="true"><span>N</span><ArrowUpRight size={22}/></div>
   <button class="map-inventory" onclick={()=>showPanel('inventory')} aria-label={ui.text("Abrir inventario")} title={ui.text("Inventario")}><Backpack size={22}/><span>{Object.values(inventory.counts).reduce((a,b)=>a+b,0)}</span></button>
   {#if !published}<button class="map-inventory map-tests" disabled={!adventure||!!transitionImage} onclick={()=>showPanel('tests')} aria-label={ui.text("Abrir pruebas de aventura")} title={ui.text("Pruebas de aventura")}><ClipboardList size={22}/></button>{/if}
   <div class="map-controls"><button aria-label={ui.text("Mover vista")} aria-pressed={panMode} title={ui.text("Mover vista: arrastra con ratón o dedo")} onclick={()=>panMode=!panMode}><Hand size={18}/></button><button onclick={()=>controller?.zoom(-.15)} aria-label={ui.text("Alejar mapa")} title={ui.text("Alejar")}><Minus size={17}/></button><button onclick={usePrimaryCamera} aria-label={primaryCameraAction==='player'?ui.text("Centrar personaje"):ui.text("Encajar mapa")} title={primaryCameraAction==='player'?ui.text("Centrar y seguir al personaje"):ui.text("Encajar el mapa completo")}>{#if primaryCameraAction==='player'}<LocateFixed size={18}/>{:else}<Scan size={17}/>{/if}</button><button onclick={()=>controller?.zoom(.15)} aria-label={ui.text("Acercar mapa")} title={ui.text("Acercar")}><Plus size={17}/></button></div>
   <div class="player-hud"><div class="my-avatar">E</div><div><strong>{ui.text("Explorador")} <span>{ui.text("Tú")}</span></strong><small>{hasTasks&&active?ui.text("En foco · ")+active.title:ui.text("Disponible para explorar")}</small></div></div>
   <div class="scene-instructions"><MousePointer2 size={14}/><span>{ui.text("Haz clic para caminar · Interactúa con objetos y compañeros")}</span></div>
   <p class="sr-only" role="status">{ui.text(status)}</p>
   {/if}
  </div>
 </main>
</div>
{#if panel}
 <!-- Native dialog keeps focus inside the floating interaction. -->
 <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
 <!-- svelte-ignore a11y_click_events_have_key_events -->
 <dialog class="drawer unified-modal" class:context-panel={panel==='narrative'&&currentNarrativeModule?.type==='context'||panel==='chat'&&currentObjectModule?.type==='context'} class:chat-panel={panel==='chat'&&currentObjectModule?.type==='chat'||panel==='narrative'&&currentNarrativeModule?.type==='chat'} class:activity-panel={panel==='chat'||panel==='tasks'||panel==='project'} use:openDialog oncancel={()=>void closePanel()} onclick={dismissBackdrop} aria-label={panel==='narrative'?ui.text("Evento narrativo: ")+currentNarrative?.name:panel==='condition'?ui.text("Interacción bloqueada"):panel==='tests'?ui.text("Pruebas de aventura"):panel==='obtained'?ui.text("Objeto obtenido"):panel==='locked'?ui.text("Salida cerrada"):panel==='inventory'?ui.text("Mochila"):panel==='chat'?ui.text("Módulos del objeto"):panel==='goal'?ui.text("Objetivo"):panel==='space'?ui.text("Lugares y progreso"):panel==='help'?ui.text("Ayuda"):panel==='object'?ui.text("Interacción"):ui.text("Tareas y proyecto")}>
  <div class="drawer-top"><span>{panel==='narrative'?ui.text("EVENTO NARRATIVO"):panel==='condition'?ui.text("INTERACCIÓN BLOQUEADA"):panel==='tests'?ui.text("PROGRESO Y PRUEBAS"):panel==='obtained'?ui.text("INVENTARIO"):panel==='locked'?ui.text("SALIDA CERRADA"):panel==='inventory'?ui.text("INVENTARIO"):panel==='chat'?ui.text("MÓDULOS DEL OBJETO"):panel==='goal'?ui.text("TU SIGUIENTE PASO"):panel==='space'?ui.text("TU ESPACIO"):panel==='help'?ui.text("CÓMO JUGAR"):panel==='object'?ui.text("INTERACCIÓN"):'CHECKPOINT / ATLAS'}</span><button onclick={closePanel} aria-label={ui.text("Cerrar panel")}><X size={20}/></button></div>
  {#if panel==='narrative'&&adventure&&currentNarrative&&currentNarrativeRun&&currentNarrativeModule}
   {#if narrativeError}<p role="alert">{narrativeError}</p>{/if}
   <small class="narrative-progress">{storyText(['event',currentNarrative.id,'name'],currentNarrative.name)} · {(currentNarrativeRun.module??0)+1}/{currentNarrative.modules.length}</small>
   {@const module=currentNarrativeModule}{@const event=currentNarrative}
   {#if module.type==='chat'}<h2>{contentModuleName(module,adventure.chats?.map(c=>({...c,name:storyText(['chat','chat:'+c.id,'name'],c.name)})),ui.text('Conversación'))}</h2>{/if}
   {#key [event.id,module.id,currentNarrativeRun.run].join(':')}<ContentModulePlayer module={moduleView(module,['event',event.id])} currentLang={contentLanguage} adventure={adventure} chats={adventure.chats} storage={progressStorage} progressKey={narrativeChatKey(adventure.id,event,module,currentNarrativeRun.run)} onstate={narrativeChatState.bind(null,event.id,module.id)} onbackground={narrativeBackground.bind(null,event.id,module.id,currentNarrativeRun.run,adventure.id,sessionGeneration)} oncontinue={contextContinue} onprogress={node=>record('Evento '+event.name+' · conversación: '+node)} onclose={()=>void closePanel()}/>{/key}
  {:else if panel==='tests'&&adventure}
   {#if testError}<p role="alert">{testError}</p>{/if}<AdventureTests {adventure} {tasks} {completed} log={activityLog} {story} {inventory} onstate={testState} onmodule={testModule} onitem={testItem} onnarrative={testNarrative} ontask={toggleTestTask} ongoal={toggleTestGoal} onreset={restartAdventure}/>
  {:else if panel==='condition'}<h2>{ui.text("Acción bloqueada")}</h2><p class="drawer-description" role="status">{conditionMessage}</p><button class="primary-button" onclick={closePanel}>{ui.text("Seguir explorando")}</button>
  {:else if panel==='obtained'&&obtained}<div class="drawer-icon"><Backpack size={28}/></div><h2>{ui.text("Objeto obtenido")}</h2><p class="drawer-description">{obtained.name} × {obtained.quantity}</p><button class="primary-button" onclick={closePanel}>{ui.text("Continuar")}</button>
  {:else if panel==='locked'&&blockedExit}<div class="drawer-icon"><LockKeyhole size={28}/></div><h2>{blockedExit.name}</h2><p class="drawer-description">{ui.text("Necesitas este artículo para abrir la salida:")}</p><section class="progress-card">{#if blockedExit.image}<img src={blockedExit.image} alt="" style="width:64px;height:64px;object-fit:contain;image-rendering:pixelated"/>{:else}<Package size={24}/>{/if}<h3>{blockedExit.item} × {blockedExit.quantity}</h3></section><button class="primary-button" onclick={closePanel}>{ui.text("Seguir explorando")}</button>
  {:else if panel==='inventory'}
   <h2>{ui.text("Mochila")}</h2><p class="drawer-description">{ui.text("Tus objetos te acompañan a lo largo de la aventura. Aquí puedes consultar lo que has recogido.")}</p>
   {#each (adventure?.items??[]).filter(i=>(inventory.counts[i.id]??0)>0) as item}<section class="progress-card"><h3>{storyText(['item',item.id,'name'],item.name)} × {inventory.counts[item.id]}</h3><p>{storyText(['item',item.id,'description'],item.description)}</p></section>{:else}<p>{ui.text("La mochila está vacía. Busca objetos que puedas recoger.")}</p>{/each}
  {:else if panel==='space'}
   <h2>{scene.name}</h2><p class="drawer-description">{ui.text("Un lugar para cada paso. Acércate a un objeto del escenario o abre su función desde aquí.")}</p>
   <section class="progress-card modal-progress"><div class="card-eyebrow">{hasTasks?ui.text("TU DÍA"):ui.text("TU RECORRIDO")}</div><div class="progress-numbers"><strong>{hasTasks?done:completedGoals}<span> / {hasTasks?tasks.length:sceneGoals.length}</span></strong><span>{hasTasks?ui.text("tareas completadas"):ui.text("objetivos alcanzados")}</span></div><div class="progress-track"><span style={`width:${(hasTasks?done/tasks.length:sceneGoals.length?completedGoals/sceneGoals.length:0)*100}%`}></span></div></section>
   <div class="modal-places">
    {#each scene.entities.filter(e=>e.interaction&&e.interaction.action!=='inventory.collect'&&e.interaction.action!=='space.open'&&e.interaction.action!=='adventure.exit') as entity}<button class="quick-row" onclick={()=>shortcut(entity.id)}><span class="quick-icon blue">{#if entity.kind==='person'}<MessageCircle size={20}/>{:else if entity.kind==='goal'}<Flag size={20}/>{:else}<LayoutGrid size={20}/>{/if}</span><span><strong>{entity.label}</strong><small>{entity.interaction?.label}</small></span><ArrowUpRight size={17}/></button>{/each}
   </div>
  {:else if panel==='help'}
   <div class="drawer-icon"><MousePointer2 size={27}/></div><h2>{ui.text("Muévete a tu ritmo.")}</h2><div class="help-content"><p>{ui.text("Pulsa en el suelo para caminar. Pulsa un objeto o un compañero para acercarte y abrir su ventana.")}</p><p>{ui.text("Tu escritorio abre las tareas; el panel, el proyecto; los compañeros, el chat. La mesa de encuentro muestra los lugares y tu progreso.")}</p><p>{ui.text("Visita los objetivos o el punto de información para ver tu recorrido. Las losetas con flechas conectan los mapas; al viajar se conservan el zoom, la orientación y el progreso de esta sesión.")}</p><p>{ui.text("Con el mapa enfocado: flechas o WASD para moverte y Enter para interactuar. Escape cierra las ventanas.")}</p><p>{ui.text("El botón de lugares en la cabecera permite acceder a las mismas funciones con teclado, sin caminar.")}</p></div>
  {:else if panel==='tasks'||panel==='project'}
   <div class="drawer-icon"><Armchair size={27}/></div><h2>{panel==='tasks'?ui.text("Tu espacio de foco."):ui.text("Proyecto Atlas")}</h2><p class="drawer-description">{panel==='tasks'?ui.text("Elige una tarea para empezar. Tu personaje mostrará que estás trabajando."):ui.text("Una experiencia de bienvenida más sencilla para nuestro próximo lanzamiento.")}</p>
   <div class="project-summary"><span>{ui.locale==='en'?`${done} of ${tasks.length} completed`:`${done} de ${tasks.length} completadas`}</span><strong>{Math.round(done/tasks.length*100)}%</strong></div><div class="progress-track"><span style={`width:${done/tasks.length*100}%`}></span></div>
   <div class="task-list">{#each tasks as task}<article class="task" class:task-done={task.status==='done'}><div class="task-meta"><span>{task.tag}</span><span>{task.status==='done'?ui.text("Completada"):task.status==='active'?ui.text("En curso"):ui.text("Pendiente")}</span></div><h3>{#if task.status==='done'}<CheckCheck size={18}/>{/if}{task.title}</h3><p>{task.description}</p>{#if task.status==='todo'}<button class="task-action" onclick={()=>startTask(task.id)}><Play size={14}/> {ui.text("Trabajar en esta tarea")}</button>{:else if task.status==='active'}<div class="task-buttons"><button class="task-action" onclick={()=>finishTask(task.id)}><Check size={15}/> {ui.text("Completar")}</button><button class="subtle-button" onclick={pauseTask}>{ui.text("Pausar")}</button></div>{/if}</article>{/each}</div>
  {:else if panel==='chat'&&adventure&&currentObjectModule}
   {#if moduleError}<p role="alert">{moduleError}</p>{/if}<small class="narrative-progress">{selectedEntity?.label} · {objectModules.findIndex(m=>m.id===currentObjectModule.id)+1}/{objectModules.length}</small>
   {#if currentObjectModule.type==='chat'}<div class="chat-heading"><span class="person-avatar">{chatName.slice(0,1)}</span><div><h2>{contentModuleName(currentObjectModule,adventure.chats?.map(c=>({...c,name:storyText(['chat','chat:'+c.id,'name'],c.name)})),ui.text('Conversación'))}</h2><p>{selectedEntity?.label}</p></div></div>{/if}
   {@const module=currentObjectModule}{@const moduleRef={mapId:currentScene.id,entityId:resourceEntityId}}
   {#key [adventure.id,currentScene.id,resourceEntityId,module.id].join(':')}<ContentModulePlayer module={moduleView(module,['object',currentScene.id,resourceEntityId])} currentLang={contentLanguage} adventure={adventure} chats={adventure.chats} storage={progressStorage} progressKey={contentProgressKey(adventure.id,{kind:'object',mapId:currentScene.id,entityId:resourceEntityId},module)} onstate={objectModuleState.bind(null,module.id)} onbackground={objectBackground.bind(null,moduleRef,module.id,adventure.id,sessionGeneration)} oncontinue={objectContinue} onprogress={node=>record(`Módulo de ${selectedEntity?.label}: ${node==='success'?'completado':'paso '+node}.`)} onclose={()=>void closePanel()}/>{/key}
  {:else if panel==='goal'&&selectedGoal}
   <div class="drawer-icon"><Flag size={27}/></div><h2>{selectedGoal.title}</h2><p class="drawer-description">{selectedGoal.description}</p><div class="goal-callout"><Map size={28}/><p>{ui.text("Cada objetivo es un lugar al que volver. Explora a tu ritmo y marca este paso cuando lo hayas conseguido.")}</p></div><button class="primary-button" onclick={finishGoal} disabled={selectedGoal.done}>{#if selectedGoal.done}<Check size={18}/> {ui.text("Objetivo completado")}{:else}<Flag size={18}/> {ui.text("Marcar como completado")}{/if}</button>
  {:else if panel==='object'&&selectedEntity}
   <h2>{selectedEntity.label}</h2><p class="drawer-description">{selectedEntity.interaction?.label}</p><button class="primary-button" onclick={closePanel}>{ui.text("Volver al mapa")}</button>
  {/if}
  {#if !published}<p class="demo-footnote">{ui.text("Demo local · Sin conexión a los datos de tu proyecto")}</p>{/if}
 </dialog>
{/if}

{#if information&&informationEntity&&!panel}
 <InfoBubble {controller} description={informationEntity.description??adventure?.items?.find(i=>i.id===informationEntity.pickup?.itemId)?.description??ui.text("Selecciona la acción para continuar.")} action={informationEntity.interaction?.label} onaction={()=>{if(information)executeInteraction(information);}} onclose={()=>information=null}/>
{/if}

<style>
.save-feedback{position:absolute;top:18px;left:50%;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:15px;max-width:calc(100% - 30px);padding:12px 16px;border:1px solid #cedbbe;border-radius:10px;background:#fbfff5;color:#496237;font-size:12px;box-shadow:0 4px 15px #29413612}.save-feedback.save-error{color:#8a4336;background:#fff0eb;border-color:#ebd0c5}.save-feedback button{display:grid;place-items:center;flex-shrink:0}
.story-language select{max-width:110px;padding:5px;border:1px solid #d6dfce;border-radius:7px;background:#fffef8;color:#35502f;font:12px system-ui}

.module-score{padding:6px 9px;border:1px solid #d6dfce;border-radius:8px;background:#edf3e5;color:#35502f;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}.narrative-progress{color:#73836a;font-size:12px}

.preload-stage{position:absolute;inset:0;display:grid;place-content:center;z-index:5;background:#f4f7f0}.preload-stage :global(.preload){width:min(420px,85vw)}

.map-inventory.map-tests{right:108px}@media(max-width:700px){.map-inventory.map-tests{right:96px}}
.unified-modal.chat-panel{display:flex;flex-direction:column;gap:18px;overflow:hidden}.chat-panel .chat-heading{flex-shrink:0}.chat-panel .demo-footnote{display:none}

.unified-modal.activity-panel{inset:0 0 0 auto;margin:0;height:100dvh;max-height:100dvh;width:min(460px,100vw);border-radius:18px 0 0 18px;animation:activity-enter .2s ease-out}.unified-modal.activity-panel::backdrop{backdrop-filter:none;-webkit-backdrop-filter:none;background:#18282120}@keyframes activity-enter{from{transform:translateX(100%)}to{transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.unified-modal.activity-panel{animation:none}}

.map-inventory{position:absolute;right:28px;bottom:84px;z-index:3;display:flex;align-items:center;justify-content:center;gap:8px;min-width:52px;min-height:48px;padding:10px 13px;background:#fffef8;border:1px solid #d5dfce;border-radius:10px;color:#35502f;box-shadow:0 3px 12px #28433318}.map-inventory:hover{background:#e8efde}.map-inventory:focus-visible{outline:2px solid #577c35;outline-offset:3px}.map-inventory span{font-size:12px;font-variant-numeric:tabular-nums}@media(max-width:700px){.map-inventory{right:16px;bottom:80px}}

 .unified-modal{position:fixed;inset:0;margin:auto;transform:none;width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 48px);height:fit-content;border:1px solid #d5dfce;border-radius:20px;box-shadow:0 24px 80px #172b3840;animation:appear 180ms ease-out}.unified-modal::backdrop{background:rgb(24 40 33 / 28%);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.load-error{position:absolute;top:40%;left:10%;right:10%;color:#a34736;background:#fffef8;padding:20px;z-index:3}@keyframes appear{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.unified-modal{animation:none}}

@media(max-width:700px){.unified-modal.activity-panel{inset:0;margin:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0;box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))}}

 .unified-modal.context-panel{display:flex;flex-direction:column;inset:0;margin:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;padding:0;box-sizing:border-box;border:0;border-radius:0;overflow:hidden;background:#17211e;color:#f4f3e9}.context-panel .drawer-top{flex:none;padding:12px 20px;margin:0;border:0;min-height:44px;box-sizing:border-box}.context-panel .drawer-top>span{color:#c2d0c4}.context-panel .drawer-top>button{color:#f4f3e9}.context-panel .narrative-progress{display:none}
</style>
