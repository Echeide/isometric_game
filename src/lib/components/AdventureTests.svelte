<script lang="ts">
 import type {Adventure} from '$lib/demo/adventure';
 import type {Task} from '$lib/demo/scenes';
 import {milestones,type Activity} from '$lib/demo/test-progress';
 let {adventure,tasks,completed,log,ontask,ongoal,onreset}:{adventure:Adventure;tasks:Task[];completed:string[];log:Activity[];ontask:(id:string)=>void;ongoal:(key:string)=>void;onreset:()=>void}=$props();
 let confirm=$state(false);
 const goals=$derived(milestones(adventure));
 const hasTasks=$derived(adventure.maps.some(m=>m.entities.some(e=>['tasks.open','project.open'].includes(e.interaction?.action??''))));
</script>
<h2>Pruebas de aventura</h2><p class="description">{adventure.name} · Gestiona los hitos de todos los mapas y consulta las últimas acciones de esta partida.</p>
<section><h3>Hitos</h3>{#each goals as goal}<div class="row"><div><strong>{goal.label}</strong><small>{goal.map} · {completed.includes(goal.key)?'Completado':'Pendiente'}</small></div><button onclick={()=>ongoal(goal.key)}>{completed.includes(goal.key)?'Reabrir':'Completar'}</button></div>{:else}<p>No hay objetivos en esta aventura.</p>{/each}
{#if hasTasks}{#each tasks as task}<div class="row"><div><strong>{task.title}</strong><small>Tarea · {task.status==='done'?'Completada':task.status==='active'?'En curso':'Pendiente'}</small></div><button onclick={()=>ontask(task.id)}>{task.status==='done'?'Reabrir':'Completar'}</button></div>{/each}{/if}</section>
<section><h3>Últimas acciones</h3><p class="hint">Se conservan las últimas 100 acciones. El registro comienza a partir de esta versión.</p><ol>{#each [...log].reverse() as entry}<li><time datetime={entry.at}>{new Date(entry.at).toLocaleString('es')}</time><span>{entry.message}</span></li>{:else}<li>Todavía no hay acciones registradas.</li>{/each}</ol></section>
<section class="reset"><h3>Reiniciar aventura</h3><p>Vuelve al mapa inicial y borra el progreso de tareas, hitos, conversaciones, objetos recogidos y salidas desbloqueadas. Los mapas y los recursos se conservan.</p>{#if confirm}<p><strong>¿Reiniciar el progreso de esta aventura?</strong></p><div class="buttons"><button class="danger" onclick={onreset}>Sí, reiniciar aventura</button><button onclick={()=>confirm=false}>Cancelar</button></div>{:else}<button class="danger" onclick={()=>confirm=true}>Reiniciar aventura…</button>{/if}</section>
<style>
.description,p{line-height:1.5;color:#607168}.row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #dce3d8}.row div{flex:1;min-width:0}.row strong{font-size:14px}.row small{display:block;color:#697768;margin-top:4px}button{padding:9px 12px;border:1px solid #ccd9c4;border-radius:8px;background:#f3f7ef;color:#35502f;font:inherit;cursor:pointer;min-height:44px}section{margin-top:24px}h3{font-size:16px}.hint{font-size:12px}ol{padding:0;list-style:none;max-height:240px;overflow:auto}li{padding:10px 0;border-bottom:1px solid #e5e9e1;font-size:13px}time{display:block;font-size:11px;color:#6d7c70;margin-bottom:4px}.reset{border-top:1px solid #dce3d8;padding-top:12px}.danger{background:#fff0e9;color:#993d2f;border-color:#e5bfb4}.buttons{display:flex;flex-wrap:wrap;gap:8px}
</style>
