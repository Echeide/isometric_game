<script lang="ts">
 import RoutingTalesChat from '$lib/components/RoutingTalesChat.svelte';
 import {chatProgressKey} from '$lib/chat/routingtales';
 import InfoBubble from '$lib/components/InfoBubble.svelte';
 let information=$state<WorldInteraction|null>(null);
 let obtained=$state<{name:string;quantity:number}|null>(null);

 import {collectedIds,collectItem,useExit,emptyInventory,readInventory,saveInventory} from '$lib/demo/inventory';
 let inventory=$state(emptyInventory());

 import {environments} from '@isometrico/world';
 let panMode=$state(false);
 import { graphics } from '$lib/demo/pixelart';
 import { tick,onMount } from 'svelte';
 import MapDissolve from '$lib/components/MapDissolve.svelte';
 import {objectiveKey} from '$lib/demo/playable-adventure';
 import {loadAdventureLibrary,selectAdventure} from '$lib/demo/adventure-library';
 let adventures=$state<Adventure[]>([]);
 import {createTraveler,type Adventure} from '$lib/demo/adventure';
 import {parseScene,type WorldScene,type Facing} from '@isometrico/world';
 import { World, type WorldController, type WorldInteraction } from '@isometrico/world';
 import { office,outdoors,makeAdapter,initialTasks,initialGoals,type Task } from '$lib/demo/scenes';
 import { LockKeyhole, Package, Backpack, Layers, LayoutGrid, Map, ChevronDown, ArrowUpRight, Plus, Minus, Scan, MousePointer2, X, Check, Play, MessageCircle, Flag, Armchair, CircleHelp, CheckCheck, Hand, LocateFixed } from 'lucide-svelte';
 let traveler:ReturnType<typeof createTraveler>|undefined;
 let adventure=$state<Adventure|null>(null),mapsReady=$state(false);
 let currentScene=$state<WorldScene>(office);
 let mode=$state('checkpoint');
 let worldKey=$state(0);
 let arrivalFacing=$state<Facing>('se');
 let arrivalCamera:ReturnType<WorldController['getCamera']>|undefined;
 let transitionImage=$state<string|null>(null),transitionReady=$state(false);
 let loadError=$state('');
 let completed=$state<string[]>([]);
 let resourceEntityId=$state('');
 onMount(()=>{try{
  const library=loadAdventureLibrary(localStorage,true);adventures=library.adventures;
  const requestedAdventure=new URLSearchParams(location.search).get('adventure');
  adventure=adventures.find(a=>a.id===(requestedAdventure??library.activeId))??adventures.find(a=>a.id===library.activeId)!;
  const query=new URLSearchParams(location.search),requested=query.get('map')??query.get('world');
  const initial=adventure.maps.find(m=>m.id===(requested??adventure!.startMap))??adventure.maps.find(m=>m.id===adventure!.startMap)!;
  inventory=readInventory(localStorage,adventure.id);traveler=createTraveler(adventure);currentScene=parseScene(initial);mode=currentScene.id;
 }catch(e){loadError=`No se pudo cargar la aventura: ${(e as Error).message}`;}finally{mapsReady=true;}});
 function ready(c:WorldController){c.setFacing(arrivalFacing);if(arrivalCamera)c.restoreCamera(arrivalCamera);controller=c;transitionReady=true;}
 function changeScene(next:WorldScene,facing:Facing){
  arrivalCamera=controller?.getCamera();transitionReady=false;transitionImage=controller?.captureFrame()??null;
  celebration=0;arrivalFacing=facing;currentScene=next;mode=next.id;panel=null;information=null;controller=undefined;worldKey++;status=`Has llegado a ${next.name}.`;
 }
 let tasks=$state<Task[]>(structuredClone(initialTasks));
 let panel=$state<'obtained'|'locked'|'inventory'|'tasks'|'project'|'chat'|'goal'|'space'|'help'|'object'|null>(null);
 let blockedExit=$state<{name:string;item:string;quantity:number;image?:string}|null>(null);
 const exitIndicators=$derived.by(()=>{
  const result:Record<string,import('../../packages/world/src/types').ExitIndicator>={};
  for(const exit of adventure?.exits??[]){const r=exit.requirement;if(exit.fromMap!==currentScene.id||!r||inventory.unlocked.includes(exit.id))continue;
   const item=adventure?.items?.find(i=>i.id===r.itemId)?.name??r.itemId,ready=(inventory.counts[r.itemId]??0)>=r.quantity;
   result[exit.entityId]={state:ready?'ready':'locked',label:ready?'Puedes abrir':'Necesitas '+r.quantity+' × '+item};
  }return result;
 });
 let resource=$state('');
 let controller=$state<WorldController>();
 let celebration=$state(0);
 let status=$state('Tu espacio, a tu ritmo.');
 const done=$derived(tasks.filter(t=>t.status==='done').length);
 const active=$derived(tasks.find(t=>t.status==='active'));
 const scene=$derived({...currentScene,entities:currentScene.entities.map(e=>({...e,completed:e.completed||completed.includes(objectiveKey(currentScene.id,e.id))}))});
 const informationEntity=$derived(scene.entities.find(e=>e.id===information?.entityId));
 const sceneGoals=$derived(scene.entities.filter(e=>!e.pickup&&e.kind==='goal'&&e.interaction?.action!=='adventure.exit'));
 const completedGoals=$derived(sceneGoals.filter(e=>e.completed).length);
 const hasTasks=$derived(scene.entities.some(e=>e.interaction?.action==='tasks.open'||e.interaction?.action==='project.open'));
 const selectedEntity=$derived(scene.entities.find(e=>e.id===resourceEntityId));
 const selectedGoal=$derived(selectedEntity?{
  title:initialGoals.find(g=>g.id===resource)?.title??selectedEntity.label,
  description:initialGoals.find(g=>g.id===resource)?.description??selectedEntity.interaction?.label??'Completa este objetivo a tu ritmo.',
  done:!!selectedEntity.completed
 }:null);
 const chatName=$derived(resource==='lucia'?'Lucía Martín':resource==='marcos'?'Marcos Ruiz':selectedEntity?.label??'Conversación');
 const adapter=$derived(makeAdapter(scene,openInteraction));
 let opener:HTMLElement|null=null;
 function openInteraction(event:WorldInteraction){
  if(transitionImage||panel)return;
  if(event.action==='adventure.exit'){information=null;executeInteraction(event);return;}
  information=event;
 }
 function executeInteraction(event:WorldInteraction){
   information=null;
   if(transitionImage)return;
   if(event.action==='inventory.collect'){
    if(!adventure)return;
    try{const next=collectItem(adventure,$state.snapshot(inventory),event.sceneId,event.entityId);saveInventory(localStorage,adventure.id,next);inventory=next;obtained={name:adventure.items?.find(i=>i.id===event.resourceId)?.name??'Objeto',quantity:scene.entities.find(e=>e.id===event.entityId)?.pickup?.quantity??1};panel='obtained';status='Has recogido '+(adventure.items?.find(i=>i.id===event.resourceId)?.name??'un objeto')+'.';}catch(e){status=(e as Error).message;}return;
   }
   if(event.action==='adventure.exit'){
    if(!adventure)return;
    const exit=adventure.exits.find(e=>e.fromMap===event.sceneId&&e.entityId===event.entityId),requirement=exit?.requirement;
    if(exit&&requirement&&!inventory.unlocked.includes(exit.id)&&(inventory.counts[requirement.itemId]??0)<requirement.quantity){
      blockedExit={name:adventure.maps.find(m=>m.id===exit.toMap)?.name??'Salida',item:adventure.items?.find(i=>i.id===requirement.itemId)?.name??requirement.itemId,quantity:requirement.quantity};
      const pickup=adventure.maps.flatMap(m=>m.entities).find(e=>e.pickup?.itemId===requirement.itemId);
      if(pickup?.visualId)blockedExit.image=graphics.objects[pickup.visualId]?.image;
      opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel='locked';return;
    }
    try{const next=traveler!(event.sceneId,event.entityId,controller?.getFacing());const progress=useExit(adventure,$state.snapshot(inventory),next.exit.id);saveInventory(localStorage,adventure.id,progress);inventory=progress;changeScene(next.scene,next.facing);}
    catch(e){status=(e as Error).message;}
    return;
   }
   opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
   resource=event.resourceId;resourceEntityId=event.entityId;
   if(event.action==='chat.open')controller?.setConversation(event.entityId);
   panel=event.action==='tasks.open'?'tasks':event.action==='project.open'?'project':event.action==='chat.open'?'chat':event.action==='space.open'?'space':event.action==='goal.open'||scene.entities.find(e=>e.id===event.entityId)?.kind==='goal'?'goal':'object';
 }
 function openDialog(dialog:HTMLDialogElement){dialog.showModal();return {destroy(){dialog.close();}};}
 function dismissBackdrop(event:MouseEvent){const dialog=event.currentTarget as HTMLDialogElement,rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))void closePanel();}

 async function closePanel(){information=null;panel=null;controller?.setConversation(null);await tick();if(opener?.isConnected)opener.focus();else document.querySelector<HTMLElement>('[role=application]')?.focus();}
 function shortcut(entityId:string){void closePanel().then(()=>controller?.goTo(entityId));}
 const adventureProgress=new globalThis.Map<string,{tasks:Task[];completed:string[]}>();
 function switchAdventure(value:string){
  if(!adventure||transitionImage||value===adventure.id)return;
  try{
   const next=selectAdventure(localStorage,value);
   adventureProgress.set(adventure.id,{tasks:structuredClone($state.snapshot(tasks)),completed:[...completed]});
   const progress=adventureProgress.get(value);tasks=progress?.tasks??structuredClone(initialTasks);completed=progress?.completed??[];
   inventory=readInventory(localStorage,next.id);traveler=createTraveler(next);adventure=next;changeScene(parseScene(next.maps.find(m=>m.id===next.startMap)!), 'se');
   const url=new URL(location.href);url.search='';url.searchParams.set('adventure',value);history.replaceState(null,'',url);
  }catch(e){status=(e as Error).message;}
 }

 function startTask(id:string){tasks=tasks.map(t=>({...t,status:t.id===id?'active':t.status==='active'?'todo':t.status}));status='En camino a tu puesto de trabajo.';void closePanel();}
 function finishTask(id:string){tasks=tasks.map(t=>t.id===id?{...t,status:'done'}:t);status='¡Un paso más! Tarea completada.';celebration++;void closePanel();}
 function pauseTask(){tasks=tasks.map(t=>t.status==='active'?{...t,status:'todo'}:t);status='Tarea en pausa.';void closePanel();}
 function finishGoal(){if(!selectedEntity)return;const key=objectiveKey(scene.id,selectedEntity.id);if(!completed.includes(key))completed=[...completed,key];status='¡Objetivo completado! Tu ruta sigue avanzando.';celebration++;void closePanel();}
 function showPanel(value:'space'|'help'|'inventory'){information=null;opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel=value;}
</script>
<svelte:head><title>Isométrico — Tu espacio de trabajo</title><meta name="description" content="Un espacio isométrico para trabajar, conversar y avanzar. Demo de un módulo reutilizable para SvelteKit."/></svelte:head>

<div class="app-shell immersive">
 <header class="topbar">
  <a class="immersive-brand" href="/" aria-label="Isométrico, inicio"><span class="brand-mark"><Layers size={22}/></span><span class="wordmark">isométrico</span></a>
  <div class="header-divider"></div>
  <div class="world-select"><label class="sr-only" for="world-select">Cambiar de aventura</label><div><Layers size={17}/><select id="world-select" value={adventure?.id} disabled={!!transitionImage} onchange={e=>switchAdventure(e.currentTarget.value)}>{#each adventures as item}<option value={item.id}>{item.name}</option>{/each}</select><ChevronDown size={15}/></div></div>
  <div class="topbar-right"><a class="editor-link" href="/sprites">Sprites</a><a class="editor-link" href={`/editor?adventure=${encodeURIComponent(adventure?.id??'')}&map=${encodeURIComponent(mode)}`}>Editar mapa</a><span class="demo-badge">DEMO LOCAL</span><button class="header-action" onclick={()=>showPanel('space')} aria-label="Abrir lugares y progreso" title="Lugares y progreso"><LayoutGrid size={19}/></button><button class="header-action" onclick={()=>showPanel('help')} aria-label="Ayuda" title="Ayuda"><CircleHelp size={19}/></button><span class="avatar-mini">E</span></div>
 </header>
 <main class="immersive-world" aria-label="Espacio virtual">
  <div class:outdoors={environments[scene.theme].outdoor} class="map-stage">
   {#if loadError}<p class="load-error" role="alert">{loadError}</p>{:else if mapsReady}<World followCamera paused={!!panel} {exitIndicators} hiddenIds={collectedIds(inventory,currentScene)} revision={worldKey} {panMode} {graphics} {adapter} {celebration} working={hasTasks&&!!active} onready={ready} onstatus={s=>status=s}/>{/if}<MapDissolve image={transitionImage} ready={transitionReady} ondone={()=>transitionImage=null}/>
   <div class="scene-heading"><div class="eyebrow">{adventure?.name??'MI AVENTURA'}</div><h1>{scene.name}</h1><span>{environments[scene.theme].label}</span></div>
   <div class="map-compass" aria-hidden="true"><span>N</span><ArrowUpRight size={22}/></div>
   <button class="map-inventory" onclick={()=>showPanel('inventory')} aria-label="Abrir inventario" title="Inventario"><Backpack size={22}/><span>{Object.values(inventory.counts).reduce((a,b)=>a+b,0)}</span></button>
   <div class="map-controls"><button aria-label="Volver al personaje" title="Centrar y seguir al personaje" onclick={()=>{panMode=false;controller?.focusPlayer();}}><LocateFixed size={18}/></button><button aria-label="Mover vista" aria-pressed={panMode} title="Mover vista: arrastra con ratón o dedo" onclick={()=>panMode=!panMode}><Hand size={18}/></button><button onclick={()=>controller?.zoom(-.15)} aria-label="Alejar mapa" title="Alejar"><Minus size={17}/></button><button onclick={()=>controller?.recenter()} aria-label="Centrar mapa" title="Centrar"><Scan size={17}/></button><button onclick={()=>controller?.zoom(.15)} aria-label="Acercar mapa" title="Acercar"><Plus size={17}/></button></div>
   <div class="player-hud"><div class="my-avatar">E</div><div><strong>Explorador <span>Tú</span></strong><small>{hasTasks&&active?'En foco · '+active.title:'Disponible para explorar'}</small></div></div>
   <div class="scene-instructions"><MousePointer2 size={14}/><span>Haz clic para caminar · Interactúa con objetos y compañeros</span></div>
   <p class="sr-only" role="status">{status}</p>
  </div>
 </main>
</div>
{#if panel}
 <!-- Native dialog keeps focus inside the floating interaction. -->
 <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
 <!-- svelte-ignore a11y_click_events_have_key_events -->
 <dialog class="drawer unified-modal" class:chat-panel={panel==='chat'} class:activity-panel={panel==='chat'||panel==='tasks'||panel==='project'} use:openDialog oncancel={()=>void closePanel()} onclick={dismissBackdrop} aria-label={panel==='obtained'?'Objeto obtenido':panel==='locked'?'Salida cerrada':panel==='inventory'?'Mochila':panel==='chat'?'Conversación':panel==='goal'?'Objetivo':panel==='space'?'Lugares y progreso':panel==='help'?'Ayuda':panel==='object'?'Interacción':'Tareas y proyecto'}>
  <div class="drawer-top"><span>{panel==='obtained'?'INVENTARIO':panel==='locked'?'SALIDA CERRADA':panel==='inventory'?'INVENTARIO':panel==='chat'?'CONVERSACIÓN':panel==='goal'?'TU SIGUIENTE PASO':panel==='space'?'TU ESPACIO':panel==='help'?'CÓMO JUGAR':panel==='object'?'INTERACCIÓN':'CHECKPOINT / ATLAS'}</span><button onclick={closePanel} aria-label="Cerrar panel"><X size={20}/></button></div>
  {#if panel==='obtained'&&obtained}<div class="drawer-icon"><Backpack size={28}/></div><h2>Objeto obtenido</h2><p class="drawer-description">{obtained.name} × {obtained.quantity}</p><button class="primary-button" onclick={closePanel}>Continuar</button>
  {:else if panel==='locked'&&blockedExit}<div class="drawer-icon"><LockKeyhole size={28}/></div><h2>{blockedExit.name}</h2><p class="drawer-description">Necesitas este artículo para abrir la salida:</p><section class="progress-card">{#if blockedExit.image}<img src={blockedExit.image} alt="" style="width:64px;height:64px;object-fit:contain;image-rendering:pixelated"/>{:else}<Package size={24}/>{/if}<h3>{blockedExit.item} × {blockedExit.quantity}</h3></section><button class="primary-button" onclick={closePanel}>Seguir explorando</button>
  {:else if panel==='inventory'}
   <h2>Mochila</h2><p class="drawer-description">Tus objetos te acompañan a lo largo de la aventura. Aquí puedes consultar lo que has recogido.</p>
   {#each (adventure?.items??[]).filter(i=>(inventory.counts[i.id]??0)>0) as item}<section class="progress-card"><h3>{item.name} × {inventory.counts[item.id]}</h3><p>{item.description}</p></section>{:else}<p>La mochila está vacía. Busca objetos que puedas recoger.</p>{/each}
  {:else if panel==='space'}
   <h2>{scene.name}</h2><p class="drawer-description">Un lugar para cada paso. Acércate a un objeto del escenario o abre su función desde aquí.</p>
   <section class="progress-card modal-progress"><div class="card-eyebrow">{hasTasks?'TU DÍA':'TU RECORRIDO'}</div><div class="progress-numbers"><strong>{hasTasks?done:completedGoals}<span> / {hasTasks?tasks.length:sceneGoals.length}</span></strong><span>{hasTasks?'tareas completadas':'objetivos alcanzados'}</span></div><div class="progress-track"><span style={`width:${(hasTasks?done/tasks.length:sceneGoals.length?completedGoals/sceneGoals.length:0)*100}%`}></span></div></section>
   <div class="modal-places">
    {#each scene.entities.filter(e=>e.interaction&&e.interaction.action!=='inventory.collect'&&e.interaction.action!=='space.open'&&e.interaction.action!=='adventure.exit') as entity}<button class="quick-row" onclick={()=>shortcut(entity.id)}><span class="quick-icon blue">{#if entity.kind==='person'}<MessageCircle size={20}/>{:else if entity.kind==='goal'}<Flag size={20}/>{:else}<LayoutGrid size={20}/>{/if}</span><span><strong>{entity.label}</strong><small>{entity.interaction?.label}</small></span><ArrowUpRight size={17}/></button>{/each}
   </div>
  {:else if panel==='help'}
   <div class="drawer-icon"><MousePointer2 size={27}/></div><h2>Muévete a tu ritmo.</h2><div class="help-content"><p>Pulsa en el suelo para caminar. Pulsa un objeto o un compañero para acercarte y abrir su ventana.</p><p>Tu escritorio abre las tareas; el panel, el proyecto; los compañeros, el chat. La mesa de encuentro muestra los lugares y tu progreso.</p><p>Visita los objetivos o el punto de información para ver tu recorrido. Las losetas con flechas conectan los mapas; al viajar se conservan el zoom, la orientación y el progreso de esta sesión.</p><p>Con el mapa enfocado: flechas o WASD para moverte y Enter para interactuar. Escape cierra las ventanas.</p><p>El botón de lugares en la cabecera permite acceder a las mismas funciones con teclado, sin caminar.</p></div>
  {:else if panel==='tasks'||panel==='project'}
   <div class="drawer-icon"><Armchair size={27}/></div><h2>{panel==='tasks'?'Tu espacio de foco.':'Proyecto Atlas'}</h2><p class="drawer-description">{panel==='tasks'?'Elige una tarea para empezar. Tu personaje mostrará que estás trabajando.':'Una experiencia de bienvenida más sencilla para nuestro próximo lanzamiento.'}</p>
   <div class="project-summary"><span>{done} de {tasks.length} completadas</span><strong>{Math.round(done/tasks.length*100)}%</strong></div><div class="progress-track"><span style={`width:${done/tasks.length*100}%`}></span></div>
   <div class="task-list">{#each tasks as task}<article class="task" class:task-done={task.status==='done'}><div class="task-meta"><span>{task.tag}</span><span>{task.status==='done'?'Completada':task.status==='active'?'En curso':'Pendiente'}</span></div><h3>{#if task.status==='done'}<CheckCheck size={18}/>{/if}{task.title}</h3><p>{task.description}</p>{#if task.status==='todo'}<button class="task-action" onclick={()=>startTask(task.id)}><Play size={14}/> Trabajar en esta tarea</button>{:else if task.status==='active'}<div class="task-buttons"><button class="task-action" onclick={()=>finishTask(task.id)}><Check size={15}/> Completar</button><button class="subtle-button" onclick={pauseTask}>Pausar</button></div>{/if}</article>{/each}</div>
  {:else if panel==='chat'}
   <div class="chat-heading"><span class="person-avatar" class:lucia={resource==='lucia'} class:marcos={resource==='marcos'}>{chatName.slice(0,1)}</span><div><h2>{chatName}</h2><p>Conversación</p></div></div>
   {#key [adventure?.id,scene.id,resourceEntityId,resource].join(':')}
    <RoutingTalesChat {resource} progressKey={chatProgressKey(adventure?.id??'',scene.id,resourceEntityId,resource)} onclose={()=>void closePanel()}/>
   {/key}
  {:else if panel==='goal'&&selectedGoal}
   <div class="drawer-icon"><Flag size={27}/></div><h2>{selectedGoal.title}</h2><p class="drawer-description">{selectedGoal.description}</p><div class="goal-callout"><Map size={28}/><p>Cada objetivo es un lugar al que volver. Explora a tu ritmo y marca este paso cuando lo hayas conseguido.</p></div><button class="primary-button" onclick={finishGoal} disabled={selectedGoal.done}>{#if selectedGoal.done}<Check size={18}/> Objetivo completado{:else}<Flag size={18}/> Marcar como completado{/if}</button>
  {:else if panel==='object'&&selectedEntity}
   <h2>{selectedEntity.label}</h2><p class="drawer-description">{selectedEntity.interaction?.label}</p><button class="primary-button" onclick={closePanel}>Volver al mapa</button>
  {/if}
  <p class="demo-footnote">Demo local · Sin conexión a los datos de tu proyecto</p>
 </dialog>
{/if}

{#if information&&informationEntity&&!panel}
 <InfoBubble {controller} description={informationEntity.description??adventure?.items?.find(i=>i.id===informationEntity.pickup?.itemId)?.description??'Selecciona la acción para continuar.'} action={informationEntity.interaction?.label} onaction={()=>{if(information)executeInteraction(information);}} onclose={()=>information=null}/>
{/if}

<style>
.unified-modal.chat-panel{display:flex;flex-direction:column;gap:18px;overflow:hidden}.chat-panel .chat-heading{flex-shrink:0}.chat-panel .demo-footnote{display:none}

.unified-modal.activity-panel{inset:0 0 0 auto;margin:0;height:100dvh;max-height:100dvh;width:min(460px,100vw);border-radius:18px 0 0 18px;animation:activity-enter .2s ease-out}.unified-modal.activity-panel::backdrop{backdrop-filter:none;-webkit-backdrop-filter:none;background:#18282120}@keyframes activity-enter{from{transform:translateX(100%)}to{transform:translateX(0)}}@media(prefers-reduced-motion:reduce){.unified-modal.activity-panel{animation:none}}

.map-inventory{position:absolute;right:28px;bottom:84px;z-index:3;display:flex;align-items:center;justify-content:center;gap:8px;min-width:52px;min-height:48px;padding:10px 13px;background:#fffef8;border:1px solid #d5dfce;border-radius:10px;color:#35502f;box-shadow:0 3px 12px #28433318}.map-inventory:hover{background:#e8efde}.map-inventory:focus-visible{outline:2px solid #577c35;outline-offset:3px}.map-inventory span{font-size:12px;font-variant-numeric:tabular-nums}@media(max-width:700px){.map-inventory{right:16px;bottom:80px}}

 .unified-modal{position:fixed;inset:0;margin:auto;transform:none;width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 48px);height:fit-content;border:1px solid #d5dfce;border-radius:20px;box-shadow:0 24px 80px #172b3840;animation:appear 180ms ease-out}.unified-modal::backdrop{background:rgb(24 40 33 / 28%);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.load-error{position:absolute;top:40%;left:10%;right:10%;color:#a34736;background:#fffef8;padding:20px;z-index:3}@keyframes appear{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.unified-modal{animation:none}}

@media(max-width:700px){.unified-modal.activity-panel{inset:0;margin:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0;box-sizing:border-box;padding:calc(20px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left))}}
</style>
