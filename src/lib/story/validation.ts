import type {Adventure} from '../demo/adventure';
import {resolveVisualCatalog} from '@isometrico/world';
import {behavior,entityModules,resolveStoryScene} from './engine';
import {emptyInventory} from '../demo/inventory';
import {emptyStory,moduleStatuses,storyEvents,entityKey,type EntityRef,type ConditionGroup} from './types';
export function validateStory(a:Adventure){
 const s=a.story;if(s===undefined)return;
 const fail=(message:string):never=>{throw Error('Condiciones: '+message);};
 const list=(v:unknown,max:number,label:string):unknown[]=>{if(!Array.isArray(v)||v.length>max)fail(label+' no válido.');return v as unknown[];};
 const text=(v:unknown,max:number,label:string)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(label+' no válido.');};
 const id=(v:unknown)=>{if(typeof v!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(v))fail('Identificador no válido.');};
 const target=(ref:EntityRef)=>{const e=a.maps.find(m=>m.id===ref?.mapId)?.entities.find(e=>e.id===ref.entityId);if(!e)fail('Un objeto referenciado ya no existe. Revisa las reglas antes de eliminarlo.');return e!;};
 const state=(ref:EntityRef,stateId:string)=>{target(ref);if(!behavior(a,ref)?.states?.some(s=>s.id===stateId))fail('Un estado referenciado ya no existe.');};
 const module=(ref:EntityRef,moduleId:string)=>{target(ref);if(!entityModules(a,ref).some(m=>m.id===moduleId))fail('Un módulo referenciado ya no existe. Revisa sus reglas antes de quitarlo.');};
 const item=(itemId:string,quantity:number)=>{if(!a.items?.some(i=>i.id===itemId)||!Number.isSafeInteger(quantity)||quantity<1||quantity>999999)fail('Artículo o cantidad no válido.');};
 if(!s||s.version!==1)fail('Versión no compatible.');list(s.entities,4096,'Lista de objetos');
 const seen=new Set<string>(),catalog=resolveVisualCatalog(a.catalog,a.catalogOverrides);
 // Validate every definition first, before resolving cross-object state references.
 for(const b of s.entities){if(!b||typeof b!=='object')fail('Objeto no válido.');const e=target(b),key=entityKey(b);if(seen.has(key))fail('Objeto repetido.');seen.add(key);list(b.states,16,'Estados');list(b.reactions,32,'Reacciones');const ids=new Set<string>();
  for(const v of b.states){if(!v)fail('Estado no válido.');id(v.id);text(v.name,80,'Nombre de estado');if(ids.has(v.id))fail('Estado repetido.');ids.add(v.id);for(const k of ['solid','visible','interactive'] as const)if(v[k]!==undefined&&typeof v[k]!=='boolean')fail('Propiedad de estado no válida.');if(v.description!==undefined&&(typeof v.description!=='string'||v.description.length>2000))fail('Descripción de estado no válida.');if(v.visualId!==undefined&&!catalog.some(c=>c.id===v.visualId&&c.kind===e.kind))fail('El gráfico de un estado no es compatible con el objeto.');}
  if(b.states.length&&!ids.has(b.initialState!))fail('Selecciona un estado inicial.');if(!b.states.length&&b.initialState!==undefined)fail('El estado inicial ya no existe.');if(b.blockedMessage!==undefined&&(typeof b.blockedMessage!=='string'||b.blockedMessage.length>500))fail('Mensaje de bloqueo no válido.');
 }
 const group=(g?:ConditionGroup)=>{if(g===undefined)return;if(!g||!['all','any'].includes(g.mode))fail('Combinación de condiciones no válida.');list(g.conditions,32,'Requisitos');for(const c of g.conditions){if(!c)fail('Requisito no válido.');if(c.not!==undefined&&typeof c.not!=='boolean')fail('Negación no válida.');if(c.kind==='object')state(c,c.stateId);else if(c.kind==='module'){module(c,c.moduleId);if(!moduleStatuses.includes(c.status))fail('Progreso de módulo no válido.');}else if(c.kind==='item')item(c.itemId,c.quantity);else fail('Tipo de requisito no válido.');}};
 for(const b of s.entities){group(b.visibility);group(b.interaction);const ids=new Set<string>();for(const r of b.reactions){if(!r)fail('Reacción no válida.');id(r.id);if(ids.has(r.id))fail('Reacción repetida.');ids.add(r.id);if(!storyEvents.includes(r.event)||typeof r.once!=='boolean')fail('Evento no válido.');if(r.event!=='interact')module(b,r.moduleId!);else if(r.moduleId!==undefined)fail('La interacción no tiene módulo de origen.');group(r.when);list(r.effects,16,'Consecuencias');if(!r.effects.length)fail('Añade al menos una consecuencia.');for(const e of r.effects){if(!e)fail('Consecuencia no válida.');if(e.kind==='state')state(e,e.stateId);else if(e.kind==='give'||e.kind==='consume')item(e.itemId,e.quantity);else fail('Tipo de consecuencia no válido.');}}}
 for(const map of a.maps)resolveStoryScene(a,map,emptyStory(),emptyInventory());
}
export function storyUsesItem(a:Adventure,id:string){return a.story?.entities.some(b=>[b.visibility,b.interaction,...b.reactions.map(r=>r.when)].some(g=>g?.conditions.some(c=>c.kind==='item'&&c.itemId===id))||b.reactions.some(r=>r.effects.some(e=>e.kind!=='state'&&e.itemId===id)))??false;}
