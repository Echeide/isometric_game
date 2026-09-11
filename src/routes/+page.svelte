<script lang="ts">
 let panMode=$state(false);
 import { graphics } from '$lib/demo/pixelart';
 import { tick,onMount } from 'svelte';
 import {readMaps} from '$lib/demo/saved-maps';
 import { World, type WorldController, type WorldInteraction } from '@isometrico/world';
 import { office,outdoors,makeAdapter,initialTasks,initialGoals,type Task } from '$lib/demo/scenes';
 import { Layers, LayoutGrid, Map, ChevronDown, ArrowUpRight, Plus, Minus, Scan, MousePointer2, X, Check, Play, MessageCircle, Send, Flag, Armchair, CircleHelp, CheckCheck, Hand } from 'lucide-svelte';
 let localOffice=$state(office),localOutdoors=$state(outdoors),mapsReady=$state(false);
 onMount(()=>{try{const saved=readMaps(localStorage);localOffice=saved.maps.checkpoint??office;localOutdoors=saved.maps.routingtales??outdoors;const requested=new URLSearchParams(location.search).get('world');mode=requested==='checkpoint'||requested==='routingtales'?requested:saved.active;}catch{status='No se pudieron leer los mapas guardados.';}finally{mapsReady=true;}});
 let mode=$state<'checkpoint'|'routingtales'>('checkpoint');
 let tasks=$state<Task[]>(structuredClone(initialTasks));
 let goals=$state(structuredClone(initialGoals));
 let panel=$state<'tasks'|'project'|'chat'|'goal'|'space'|'help'|null>(null);
 let resource=$state('');
 let controller=$state<WorldController>();
 let celebration=$state(0);
 let status=$state('Tu espacio, a tu ritmo.');
 let draft=$state('');
 let messages=$state<Record<string,{text:string;me:boolean}[]>>({lucia:[{text:'¡Hola! He dejado el flujo de bienvenida listo para que lo revisemos.',me:false}],marcos:[{text:'Tengo preparados los componentes de Atlas. Los vemos cuando quieras.',me:false}]});
 const done=$derived(tasks.filter(t=>t.status==='done').length);
 const active=$derived(tasks.find(t=>t.status==='active'));
 const completedGoals=$derived(goals.filter(g=>g.done).length);
 const selectedGoal=$derived(goals.find(g=>g.id===resource));
 const scene=$derived(mode==='checkpoint'?localOffice:{...localOutdoors,entities:localOutdoors.entities.map(e=>({...e,completed:goals.find(g=>g.id===e.interaction?.resourceId)?.done??e.completed}))});
 // Scene geometry is mounted per world; completed flags refresh through a deliberate key.
 const worldKey=$derived(mode==='checkpoint'?'checkpoint':`routingtales-${completedGoals}`);
 const adapter=$derived(makeAdapter(scene,openInteraction));
 let opener:HTMLElement|null=null;
 let panelElement:HTMLElement | undefined = $state();
 function openInteraction(event:WorldInteraction){
   opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
   resource=event.resourceId;draft='';
   if(event.action==='chat.open')controller?.setConversation(event.entityId);
   panel=event.action==='tasks.open'?'tasks':event.action==='project.open'?'project':event.action==='chat.open'?'chat':event.action==='space.open'?'space':'goal';
 }
 $effect(()=>{if(panel&&panelElement)panelElement.focus();});
 async function closePanel(){panel=null;controller?.setConversation(null);await tick();if(opener?.isConnected)opener.focus();else document.querySelector<HTMLElement>('[role=application]')?.focus();}
 function shortcut(entityId:string){const e=scene.entities.find(e=>e.id===entityId);if(e?.interaction)void adapter.interact({sceneId:scene.id,entityId:e.id,action:e.interaction.action,resourceId:e.interaction.resourceId});}
 function switchMode(value:typeof mode){mode=value;celebration=0;panel=null;controller=undefined;status='Tu espacio, a tu ritmo.';}
 function startTask(id:string){tasks=tasks.map(t=>({...t,status:t.id===id?'active':t.status==='active'?'todo':t.status}));status='En camino a tu puesto de trabajo.';void closePanel();}
 function finishTask(id:string){tasks=tasks.map(t=>t.id===id?{...t,status:'done'}:t);status='¡Un paso más! Tarea completada.';celebration++;void closePanel();}
 function pauseTask(){tasks=tasks.map(t=>t.status==='active'?{...t,status:'todo'}:t);status='Tarea en pausa.';void closePanel();}
 function send(){const text=draft.trim();if(!text)return;messages={...messages,[resource]:[...(messages[resource]??[]),{text,me:true}]};draft='';}
 function finishGoal(){goals=goals.map(g=>g.id===resource?{...g,done:true}:g);status='¡Objetivo completado! Tu ruta sigue avanzando.';celebration++;void closePanel();}
 function showPanel(value:'space'|'help'){opener=document.activeElement instanceof HTMLElement?document.activeElement:null;panel=value;}
 function escape(event:KeyboardEvent){if(event.key==='Escape'&&panel)void closePanel();}
</script>
<svelte:head><title>Isométrico — Tu espacio de trabajo</title><meta name="description" content="Un espacio isométrico para trabajar, conversar y avanzar. Demo de un módulo reutilizable para SvelteKit."/></svelte:head>
<svelte:window onkeydown={escape}/>
<div class="app-shell immersive" inert={panel !== null}>
 <header class="topbar">
  <a class="immersive-brand" href="/" aria-label="Isométrico, inicio"><span class="brand-mark"><Layers size={22}/></span><span class="wordmark">isométrico</span></a>
  <div class="header-divider"></div>
  <div class="world-select"><label class="sr-only" for="world-select">Cambiar de mundo</label><div><Layers size={17}/><select id="world-select" value={mode} onchange={e=>switchMode(e.currentTarget.value as typeof mode)}><option value="checkpoint">Checkpoint</option><option value="routingtales">RoutingTales</option></select><ChevronDown size={15}/></div></div>
  <div class="topbar-right"><a class="editor-link" href="/sprites">Sprites</a><a class="editor-link" href={`/editor?world=${mode}`}>Editar mapa</a><span class="demo-badge">DEMO LOCAL</span><button class="header-action" onclick={()=>showPanel('space')} aria-label="Abrir lugares y progreso" title="Lugares y progreso"><LayoutGrid size={19}/></button><button class="header-action" onclick={()=>showPanel('help')} aria-label="Ayuda" title="Ayuda"><CircleHelp size={19}/></button><span class="avatar-mini">E</span></div>
 </header>
 <main class="immersive-world" aria-label="Espacio virtual">
  <div class:outdoors={mode==='routingtales'} class="map-stage">
   {#if mapsReady}{#key worldKey}<World {panMode} {graphics} {adapter} {celebration} working={mode==='checkpoint'&&!!active} onready={c=>controller=c} onstatus={s=>status=s}/>{/key}{/if}
   <div class="scene-heading"><div class="eyebrow">{mode==='checkpoint'?'CHECKPOINT / EQUIPO ATLAS':'ROUTINGTALES / EXPLORACIÓN'}</div><h1>{scene.name}</h1><span>{mode==='checkpoint'?'Planta 01 · Tu oficina virtual':'Capítulo 01 · Explora a tu ritmo'}</span></div>
   <div class="map-compass" aria-hidden="true"><span>N</span><ArrowUpRight size={22}/></div>
   <div class="map-controls"><button aria-label="Mover vista" aria-pressed={panMode} title="Mover vista: arrastra con ratón o dedo" onclick={()=>panMode=!panMode}><Hand size={18}/></button><button onclick={()=>controller?.zoom(-.15)} aria-label="Alejar mapa" title="Alejar"><Minus size={17}/></button><button onclick={()=>controller?.recenter()} aria-label="Centrar mapa" title="Centrar"><Scan size={17}/></button><button onclick={()=>controller?.zoom(.15)} aria-label="Acercar mapa" title="Acercar"><Plus size={17}/></button></div>
   <div class="player-hud"><div class="my-avatar">E</div><div><strong>Explorador <span>Tú</span></strong><small>{mode==='checkpoint'&&active?'En foco · '+active.title:'Disponible para explorar'}</small></div></div>
   <div class="scene-instructions"><MousePointer2 size={14}/><span>Haz clic para caminar · Interactúa con objetos y compañeros</span></div>
   <p class="sr-only" role="status">{status}</p>
  </div>
 </main>
</div>
{#if panel}
 <div class="drawer-backdrop" role="presentation" onclick={closePanel}></div>
 <div class="drawer" bind:this={panelElement} tabindex="-1" role="dialog" aria-modal="true" aria-label={panel==='chat'?'Conversación de demostración':panel==='goal'?'Objetivo':panel==='space'?'Lugares y progreso':panel==='help'?'Ayuda':'Tareas y proyecto'}>
  <div class="drawer-top"><span>{panel==='chat'?'CONVERSACIÓN':panel==='goal'?'TU SIGUIENTE PASO':panel==='space'?'TU ESPACIO':panel==='help'?'CÓMO JUGAR':'CHECKPOINT / ATLAS'}</span><button onclick={closePanel} aria-label="Cerrar panel"><X size={20}/></button></div>
  {#if panel==='space'}
   <h2>{scene.name}</h2><p class="drawer-description">Un lugar para cada paso. Acércate a un objeto del escenario o abre su función desde aquí.</p>
   <section class="progress-card modal-progress"><div class="card-eyebrow">{mode==='checkpoint'?'TU DÍA':'TU RECORRIDO'}</div><div class="progress-numbers"><strong>{mode==='checkpoint'?done:completedGoals}<span> / 3</span></strong><span>{mode==='checkpoint'?'tareas completadas':'objetivos alcanzados'}</span></div><div class="progress-track"><span style={`width:${(mode==='checkpoint'?done:completedGoals)/3*100}%`}></span></div></section>
   <div class="modal-places">
    {#each scene.entities.filter(e=>e.interaction&&e.interaction.action!=='space.open') as entity}<button class="quick-row" onclick={()=>shortcut(entity.id)}><span class="quick-icon blue">{#if entity.kind==='person'}<MessageCircle size={20}/>{:else if entity.kind==='goal'}<Flag size={20}/>{:else}<LayoutGrid size={20}/>{/if}</span><span><strong>{entity.label}</strong><small>{entity.interaction?.label}</small></span><ArrowUpRight size={17}/></button>{/each}
   </div>
  {:else if panel==='help'}
   <div class="drawer-icon"><MousePointer2 size={27}/></div><h2>Muévete a tu ritmo.</h2><div class="help-content"><p>Pulsa en el suelo para caminar. Pulsa un objeto o un compañero para acercarte y abrir su ventana.</p><p>Tu escritorio abre las tareas; el panel, el proyecto; los compañeros, el chat. La mesa de encuentro muestra los lugares y tu progreso.</p><p>En RoutingTales, visita las banderas para abrir objetivos o el punto de información para ver tu recorrido.</p><p>Con el mapa enfocado: flechas o WASD para moverte y Enter para interactuar. Escape cierra las ventanas.</p><p>El botón de lugares en la cabecera permite acceder a las mismas funciones con teclado, sin caminar.</p></div>
  {:else if panel==='tasks'||panel==='project'}
   <div class="drawer-icon"><Armchair size={27}/></div><h2>{panel==='tasks'?'Tu espacio de foco.':'Proyecto Atlas'}</h2><p class="drawer-description">{panel==='tasks'?'Elige una tarea para empezar. Tu personaje mostrará que estás trabajando.':'Una experiencia de bienvenida más sencilla para nuestro próximo lanzamiento.'}</p>
   <div class="project-summary"><span>{done} de {tasks.length} completadas</span><strong>{Math.round(done/tasks.length*100)}%</strong></div><div class="progress-track"><span style={`width:${done/tasks.length*100}%`}></span></div>
   <div class="task-list">{#each tasks as task}<article class="task" class:task-done={task.status==='done'}><div class="task-meta"><span>{task.tag}</span><span>{task.status==='done'?'Completada':task.status==='active'?'En curso':'Pendiente'}</span></div><h3>{#if task.status==='done'}<CheckCheck size={18}/>{/if}{task.title}</h3><p>{task.description}</p>{#if task.status==='todo'}<button class="task-action" onclick={()=>startTask(task.id)}><Play size={14}/> Trabajar en esta tarea</button>{:else if task.status==='active'}<div class="task-buttons"><button class="task-action" onclick={()=>finishTask(task.id)}><Check size={15}/> Completar</button><button class="subtle-button" onclick={pauseTask}>Pausar</button></div>{/if}</article>{/each}</div>
  {:else if panel==='chat'}
   <div class="chat-heading"><span class="person-avatar" class:lucia={resource==='lucia'} class:marcos={resource==='marcos'}>{resource==='lucia'?'L':'M'}</span><div><h2>{resource==='lucia'?'Lucía Martín':'Marcos Ruiz'}</h2><p>Conversación de ejemplo</p></div></div>
   <div class="chat-notice">Este chat es local. Los mensajes no se envían a otras personas.</div><div class="chat-messages" aria-live="polite">{#each messages[resource]??[] as message}<div class="message" class:mine={message.me}><span>{message.me?'Tú':resource==='lucia'?'Lucía':'Marcos'}</span><p>{message.text}</p></div>{/each}</div><form class="chat-form" onsubmit={e=>{e.preventDefault();send();}}><label class="sr-only" for="message">Escribe un mensaje</label><input id="message" bind:value={draft} maxlength="2000" placeholder="Escribe un mensaje…" autocomplete="off"/><button disabled={!draft.trim()} aria-label="Enviar mensaje local"><Send size={19}/></button></form>
  {:else if panel==='goal'&&selectedGoal}
   <div class="drawer-icon"><Flag size={27}/></div><h2>{selectedGoal.title}</h2><p class="drawer-description">{selectedGoal.description}</p><div class="goal-callout"><Map size={28}/><p>Cada objetivo es un lugar al que volver. Explora a tu ritmo y marca este paso cuando lo hayas conseguido.</p></div><button class="primary-button" onclick={finishGoal} disabled={selectedGoal.done}>{#if selectedGoal.done}<Check size={18}/> Objetivo completado{:else}<Flag size={18}/> Marcar como completado{/if}</button>
  {/if}
  <p class="demo-footnote">Demo local · Sin conexión a los datos de tu proyecto</p>
 </div>
{/if}
