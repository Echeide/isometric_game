<script lang="ts">
 let panMode=$state(false);
 import { graphics } from '$lib/demo/pixelart';
 import { tick,onMount } from 'svelte';
 import MapDissolve from '$lib/components/MapDissolve.svelte';
 import {loadPlayableAdventure,objectiveKey} from '$lib/demo/playable-adventure';
 import {travel,type Adventure} from '$lib/demo/adventure';
 import {parseScene,type WorldScene,type Facing} from '@isometrico/world';
 import { World, type WorldController, type WorldInteraction } from '@isometrico/world';
 import { office,outdoors,makeAdapter,initialTasks,initialGoals,type Task } from '$lib/demo/scenes';
 import { Layers, LayoutGrid, Map, ChevronDown, ArrowUpRight, Plus, Minus, Scan, MousePointer2, X, Check, Play, MessageCircle, Send, Flag, Armchair, CircleHelp, CheckCheck, Hand } from 'lucide-svelte';
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
  adventure=loadPlayableAdventure(localStorage);
  const query=new URLSearchParams(location.search),requested=query.get('map')??query.get('world');
  const initial=adventure.maps.find(m=>m.id===(requested??adventure!.startMap))??adventure.maps.find(m=>m.id===adventure!.startMap)!;
  currentScene=parseScene(initial);mode=currentScene.id;
 }catch(e){loadError=`No se pudo cargar la aventura: ${(e as Error).message}`;}finally{mapsReady=true;}});
 function ready(c:WorldController){c.setFacing(arrivalFacing);if(arrivalCamera)c.restoreCamera(arrivalCamera);controller=c;transitionReady=true;}
 function changeScene(next:WorldScene,facing:Facing){
  arrivalCamera=controller?.getCamera();transitionReady=false;transitionImage=controller?.captureFrame()??null;
  celebration=0;arrivalFacing=facing;currentScene=next;mode=next.id;panel=null;controller=undefined;worldKey++;status=`Has llegado a ${next.name}.`;
 }
 let tasks=$state<Task[]>(structuredClone(initialTasks));
 let panel=$state<'tasks'|'project'|'chat'|'goal'|'space'|'help'|'object'|null>(null);
 let resource=$state('');
 let controller=$state<WorldController>();
 let celebration=$state(0);
 let status=$state('Tu espacio, a tu ritmo.');
 let draft=$state('');
 let messages=$state<Record<string,{text:string;me:boolean}[]>>({lucia:[{text:'¡Hola! He dejado el flujo de bienvenida listo para que lo revisemos.',me:false}],marcos:[{text:'Tengo preparados los componentes de Atlas. Los vemos cuando quieras.',me:false}]});
 const done=$derived(tasks.filter(t=>t.status==='done').length);
 const active=$derived(tasks.find(t=>t.status==='active'));
 const scene=$derived({...currentScene,entities:currentScene.entities.map(e=>({...e,completed:e.completed||completed.includes(objectiveKey(currentScene.id,e.id))}))});
 const sceneGoals=$derived(scene.entities.filter(e=>e.kind==='goal'&&e.interaction?.action!=='adventure.exit'));
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
   if(transitionImage)return;
   if(event.action==='adventure.exit'){
    if(!adventure)return;
    try{const next=travel(adventure,event.sceneId,event.entityId,controller?.getFacing());changeScene(next.scene,next.facing);}
    catch(e){status=(e as Error).message;}
    return;
   }
   opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
   resource=event.resourceId;resourceEntityId=event.entityId;draft='';
   if(event.action==='chat.open')controller?.setConversation(event.entityId);
   panel=event.action==='tasks.open'?'tasks':event.action==='project.open'?'project':event.action==='chat.open'?'chat':event.action==='space.open'?'space':event.action==='goal.open'||scene.entities.find(e=>e.id===event.entityId)?.kind==='goal'?'goal':'object';
 }
 function openDialog(dialog:HTMLDialogElement){dialog.showModal();return {destroy(){dialog.close();}};}
 function dismissBackdrop(event:MouseEvent){const dialog=event.currentTarget as HTMLDialogElement,rect=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))void closePanel();}

 async function closePanel(){panel=null;controller?.setConversation(null);await tick();if(opener?.isConnected)opener.focus();else document.querySelector<HTMLElement>('[role=application]')?.focus();}
 function shortcut(entityId:string){const e=scene.entities.find(e=>e.id===entityId);if(e?.interaction)void adapter.interact({sceneId:scene.id,entityId:e.id,action:e.interaction.action,resourceId:e.interaction.resourceId});}
 function switchMode(value:string){if(!adventure||transitionImage||value===mode)return;const next=adventure.maps.find(m=>m.id===value);if(next)changeScene(parseScene(next),controller?.getFacing()??'se');}
 function startTask(id:string){tasks=tasks.map(t=>({...t,status:t.id===id?'active':t.status==='active'?'todo':t.status}));status='En camino a tu puesto de trabajo.';void closePanel();}
 function finishTask(id:string){tasks=tasks.map(t=>t.id===id?{...t,status:'done'}:t);status='¡Un paso más! Tarea completada.';celebration++;void closePanel();}
 function pauseTask(){tasks=tasks.map(t=>t.status==='active'?{...t,status:'todo'}:t);status='Tarea en pausa.';void closePanel();}
 function send(){const text=draft.trim();if(!text)return;messages={...messages,[resource]:[...(messages[resource]??[]),{text,me:true}]};draft='';}
 function finishGoal(){if(!selectedEntity)return;const key=objectiveKey(scene.id,selectedEntity.id);if(!completed.includes(key))completed=[...completed,key];status='¡Objetivo completado! Tu ruta sigue avanzando.';celebration++;void closePanel();}
 function showPanel(value:'space'|'help'){opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel=value;}
</script>
<svelte:head><title>Isométrico — Tu espacio de trabajo</title><meta name="description" content="Un espacio isométrico para trabajar, conversar y avanzar. Demo de un módulo reutilizable para SvelteKit."/></svelte:head>

<div class="app-shell immersive">
 <header class="topbar">
  <a class="immersive-brand" href="/" aria-label="Isométrico, inicio"><span class="brand-mark"><Layers size={22}/></span><span class="wordmark">isométrico</span></a>
  <div class="header-divider"></div>
  <div class="world-select"><label class="sr-only" for="world-select">Cambiar de mundo</label><div><Layers size={17}/><select id="world-select" value={mode} disabled={!!transitionImage} onchange={e=>switchMode(e.currentTarget.value as typeof mode)}>{#each adventure?.maps??[] as map}<option value={map.id}>{map.name}</option>{/each}</select><ChevronDown size={15}/></div></div>
  <div class="topbar-right"><a class="editor-link" href="/sprites">Sprites</a><a class="editor-link" href={`/editor?map=${encodeURIComponent(mode)}`}>Editar mapa</a><span class="demo-badge">DEMO LOCAL</span><button class="header-action" onclick={()=>showPanel('space')} aria-label="Abrir lugares y progreso" title="Lugares y progreso"><LayoutGrid size={19}/></button><button class="header-action" onclick={()=>showPanel('help')} aria-label="Ayuda" title="Ayuda"><CircleHelp size={19}/></button><span class="avatar-mini">E</span></div>
 </header>
 <main class="immersive-world" aria-label="Espacio virtual">
  <div class:outdoors={scene.theme==='outdoors'} class="map-stage">
   {#if loadError}<p class="load-error" role="alert">{loadError}</p>{:else if mapsReady}{#key worldKey}<World {panMode} {graphics} {adapter} {celebration} working={hasTasks&&!!active} onready={ready} onstatus={s=>status=s}/>{/key}{/if}<MapDissolve image={transitionImage} ready={transitionReady} ondone={()=>transitionImage=null}/>
   <div class="scene-heading"><div class="eyebrow">{adventure?.name??'MI AVENTURA'}</div><h1>{scene.name}</h1><span>{scene.theme==='office'?'Interior · Tu espacio virtual':'Exterior · Explora a tu ritmo'}</span></div>
   <div class="map-compass" aria-hidden="true"><span>N</span><ArrowUpRight size={22}/></div>
   <div class="map-controls"><button aria-label="Mover vista" aria-pressed={panMode} title="Mover vista: arrastra con ratón o dedo" onclick={()=>panMode=!panMode}><Hand size={18}/></button><button onclick={()=>controller?.zoom(-.15)} aria-label="Alejar mapa" title="Alejar"><Minus size={17}/></button><button onclick={()=>controller?.recenter()} aria-label="Centrar mapa" title="Centrar"><Scan size={17}/></button><button onclick={()=>controller?.zoom(.15)} aria-label="Acercar mapa" title="Acercar"><Plus size={17}/></button></div>
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
 <dialog class="drawer unified-modal" use:openDialog oncancel={()=>void closePanel()} onclick={dismissBackdrop} aria-label={panel==='chat'?'Conversación de demostración':panel==='goal'?'Objetivo':panel==='space'?'Lugares y progreso':panel==='help'?'Ayuda':panel==='object'?'Interacción':'Tareas y proyecto'}>
  <div class="drawer-top"><span>{panel==='chat'?'CONVERSACIÓN':panel==='goal'?'TU SIGUIENTE PASO':panel==='space'?'TU ESPACIO':panel==='help'?'CÓMO JUGAR':panel==='object'?'INTERACCIÓN':'CHECKPOINT / ATLAS'}</span><button onclick={closePanel} aria-label="Cerrar panel"><X size={20}/></button></div>
  {#if panel==='space'}
   <h2>{scene.name}</h2><p class="drawer-description">Un lugar para cada paso. Acércate a un objeto del escenario o abre su función desde aquí.</p>
   <section class="progress-card modal-progress"><div class="card-eyebrow">{hasTasks?'TU DÍA':'TU RECORRIDO'}</div><div class="progress-numbers"><strong>{hasTasks?done:completedGoals}<span> / {hasTasks?tasks.length:sceneGoals.length}</span></strong><span>{hasTasks?'tareas completadas':'objetivos alcanzados'}</span></div><div class="progress-track"><span style={`width:${(hasTasks?done/tasks.length:sceneGoals.length?completedGoals/sceneGoals.length:0)*100}%`}></span></div></section>
   <div class="modal-places">
    {#each scene.entities.filter(e=>e.interaction&&e.interaction.action!=='space.open'&&e.interaction.action!=='adventure.exit') as entity}<button class="quick-row" onclick={()=>shortcut(entity.id)}><span class="quick-icon blue">{#if entity.kind==='person'}<MessageCircle size={20}/>{:else if entity.kind==='goal'}<Flag size={20}/>{:else}<LayoutGrid size={20}/>{/if}</span><span><strong>{entity.label}</strong><small>{entity.interaction?.label}</small></span><ArrowUpRight size={17}/></button>{/each}
   </div>
  {:else if panel==='help'}
   <div class="drawer-icon"><MousePointer2 size={27}/></div><h2>Muévete a tu ritmo.</h2><div class="help-content"><p>Pulsa en el suelo para caminar. Pulsa un objeto o un compañero para acercarte y abrir su ventana.</p><p>Tu escritorio abre las tareas; el panel, el proyecto; los compañeros, el chat. La mesa de encuentro muestra los lugares y tu progreso.</p><p>Visita los objetivos o el punto de información para ver tu recorrido. Las losetas con flechas conectan los mapas; al viajar se conservan el zoom, la orientación y el progreso de esta sesión.</p><p>Con el mapa enfocado: flechas o WASD para moverte y Enter para interactuar. Escape cierra las ventanas.</p><p>El botón de lugares en la cabecera permite acceder a las mismas funciones con teclado, sin caminar.</p></div>
  {:else if panel==='tasks'||panel==='project'}
   <div class="drawer-icon"><Armchair size={27}/></div><h2>{panel==='tasks'?'Tu espacio de foco.':'Proyecto Atlas'}</h2><p class="drawer-description">{panel==='tasks'?'Elige una tarea para empezar. Tu personaje mostrará que estás trabajando.':'Una experiencia de bienvenida más sencilla para nuestro próximo lanzamiento.'}</p>
   <div class="project-summary"><span>{done} de {tasks.length} completadas</span><strong>{Math.round(done/tasks.length*100)}%</strong></div><div class="progress-track"><span style={`width:${done/tasks.length*100}%`}></span></div>
   <div class="task-list">{#each tasks as task}<article class="task" class:task-done={task.status==='done'}><div class="task-meta"><span>{task.tag}</span><span>{task.status==='done'?'Completada':task.status==='active'?'En curso':'Pendiente'}</span></div><h3>{#if task.status==='done'}<CheckCheck size={18}/>{/if}{task.title}</h3><p>{task.description}</p>{#if task.status==='todo'}<button class="task-action" onclick={()=>startTask(task.id)}><Play size={14}/> Trabajar en esta tarea</button>{:else if task.status==='active'}<div class="task-buttons"><button class="task-action" onclick={()=>finishTask(task.id)}><Check size={15}/> Completar</button><button class="subtle-button" onclick={pauseTask}>Pausar</button></div>{/if}</article>{/each}</div>
  {:else if panel==='chat'}
   <div class="chat-heading"><span class="person-avatar" class:lucia={resource==='lucia'} class:marcos={resource==='marcos'}>{chatName.slice(0,1)}</span><div><h2>{chatName}</h2><p>Conversación de ejemplo</p></div></div>
   <div class="chat-notice">Este chat es local. Los mensajes no se envían a otras personas.</div><div class="chat-messages" aria-live="polite">{#each messages[resource]??[] as message}<div class="message" class:mine={message.me}><span>{message.me?'Tú':chatName}</span><p>{message.text}</p></div>{/each}</div><form class="chat-form" onsubmit={e=>{e.preventDefault();send();}}><label class="sr-only" for="message">Escribe un mensaje</label><input id="message" bind:value={draft} maxlength="2000" placeholder="Escribe un mensaje…" autocomplete="off"/><button disabled={!draft.trim()} aria-label="Enviar mensaje local"><Send size={19}/></button></form>
  {:else if panel==='goal'&&selectedGoal}
   <div class="drawer-icon"><Flag size={27}/></div><h2>{selectedGoal.title}</h2><p class="drawer-description">{selectedGoal.description}</p><div class="goal-callout"><Map size={28}/><p>Cada objetivo es un lugar al que volver. Explora a tu ritmo y marca este paso cuando lo hayas conseguido.</p></div><button class="primary-button" onclick={finishGoal} disabled={selectedGoal.done}>{#if selectedGoal.done}<Check size={18}/> Objetivo completado{:else}<Flag size={18}/> Marcar como completado{/if}</button>
  {:else if panel==='object'&&selectedEntity}
   <h2>{selectedEntity.label}</h2><p class="drawer-description">{selectedEntity.interaction?.label}</p><button class="primary-button" onclick={closePanel}>Volver al mapa</button>
  {/if}
  <p class="demo-footnote">Demo local · Sin conexión a los datos de tu proyecto</p>
 </dialog>
{/if}

<style>
 .unified-modal{position:fixed;inset:0;margin:auto;transform:none;width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 48px);height:fit-content;border:1px solid #d5dfce;border-radius:20px;box-shadow:0 24px 80px #172b3840;animation:appear 180ms ease-out}.unified-modal::backdrop{background:rgb(24 40 33 / 28%);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.load-error{position:absolute;top:40%;left:10%;right:10%;color:#a34736;background:#fffef8;padding:20px;z-index:3}@keyframes appear{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.unified-modal{animation:none}}
</style>
