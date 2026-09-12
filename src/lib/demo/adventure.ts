import {entranceFacing} from '../../../packages/world/src/exits';
import { parseScene, type Cell, type Facing, type WorldScene } from '@isometrico/world';
import { findPath, interactionCells, walkable } from '../../../packages/world/src/navigation';
import { insertEntity } from './editor';

export interface MapExit { id:string; fromMap:string; entityId:string; toMap:string; arrival:Cell; destinationEntityId?:string }
export interface Adventure { kind:'isometric-adventure'; version:1; id:string; name:string; startMap:string; maps:WorldScene[]; exits:MapExit[] }
export const ADVENTURE_KEY='isometrico.adventure.v1';
export function createAdventure(maps:WorldScene[]):Adventure {
 return parseAdventure({kind:'isometric-adventure',version:1,id:'my-adventure',name:'Mi aventura',startMap:maps[0]?.id,maps,exits:[]});
}
export function parseAdventure(value:unknown,options:{allowUnreachable?:boolean}={}):Adventure {
 const a=value as Adventure;
 if(!a||a.kind!=='isometric-adventure'||a.version!==1)throw new Error('Formato de aventura no compatible.');
 if(typeof a.id!=='string'||!a.id.trim()||typeof a.name!=='string'||!a.name.trim())throw new Error('La aventura necesita identificador y nombre.');
 if(!Array.isArray(a.maps)||!a.maps.length||a.maps.length>64||!Array.isArray(a.exits)||a.exits.length>1024)throw new Error('La aventura admite entre 1 y 64 mapas y hasta 1024 salidas.');
 const maps=a.maps.map(m=>parseScene(m,options)), byId=new Map(maps.map(m=>[m.id,m]));
 if(byId.size!==maps.length)throw new Error('Hay mapas con identificadores repetidos.');
 if(!byId.has(a.startMap))throw new Error('El mapa inicial no existe.');
 const ids=new Set<string>(),sources=new Set<string>();
 for(const exit of a.exits){
  if(!exit||typeof exit.id!=='string'||!exit.id.trim()||ids.has(exit.id))throw new Error('Las salidas necesitan identificadores únicos.');
  ids.add(exit.id);
  const from=byId.get(exit.fromMap),to=byId.get(exit.toMap),entity=from?.entities.find(e=>e.id===exit.entityId);
  if(!from||!to||!entity)throw new Error('Una salida referencia un mapa u objeto inexistente.');
  const key=JSON.stringify([from.id,entity.id]);if(sources.has(key))throw new Error('Un objeto solo puede tener una salida.');sources.add(key);
  if(entity.interaction?.action!=='adventure.exit'||entity.interaction.resourceId!==exit.id)throw new Error(`La salida ${entity.label} no tiene la interacción correcta.`);
  if(exit.destinationEntityId!==undefined&&!to.entities.some(e=>e.id===exit.destinationEntityId))throw new Error('La entrada de destino no existe.');
  if(!exit.arrival||!walkable(to,exit.arrival))throw new Error(`La llegada a ${to.name} está fuera del mapa o bloqueada.`);
  if(!options.allowUnreachable&&findPath(to,exit.arrival,[to.spawn])===null)throw new Error(`La llegada a ${to.name} está aislada de su entrada.`);
  if(!options.allowUnreachable&&findPath(from,from.spawn,interactionCells(from,entity))===null)throw new Error(`No se puede llegar a la salida ${entity.label}.`);
 }
 for(const m of maps)for(const e of m.entities)if(e.interaction?.action==='adventure.exit'&&!a.exits.some(x=>x.fromMap===m.id&&x.entityId===e.id))throw new Error(`Falta el destino de ${e.label}.`);
 return JSON.parse(JSON.stringify({...a,maps})) as Adventure;
}
export function saveAdventure(storage:Pick<Storage,'setItem'>,value:unknown){const a=parseAdventure(value);storage.setItem(ADVENTURE_KEY,JSON.stringify(a));return a;}
export function readAdventure(storage:Pick<Storage,'getItem'>):Adventure|null {const raw=storage.getItem(ADVENTURE_KEY);return raw?parseAdventure(JSON.parse(raw)):null;}
export function connectMaps(value:Adventure,fromMap:string,toMap:string,id:string,arrival?:Cell,position?:Cell):Adventure {
 const a=parseAdventure(value),from=a.maps.find(m=>m.id===fromMap),to=a.maps.find(m=>m.id===toMap);
 if(!from||!to)throw new Error('Selecciona un mapa de origen y destino.');
 const scene=insertEntity(from,'goal',id,'pixel.goal',position);
 const entity=scene.entities.find(e=>e.id===id)!;entity.label=`Salida a ${to.name}`;entity.interaction={label:`Viajar a ${to.name}`,action:'adventure.exit',resourceId:id};
 const reverse=a.exits.filter(e=>e.fromMap===toMap&&e.toMap===fromMap&&!e.destinationEntityId);
 const paired=reverse.length===1?reverse[0]:undefined;
 return parseAdventure({...a,maps:a.maps.map(m=>m.id===fromMap?scene:m),exits:[...a.exits.map(e=>e===paired?{...e,destinationEntityId:id}:e),{id,fromMap,toMap,entityId:id,arrival:arrival??to.spawn,...(paired?{destinationEntityId:paired.entityId}:{})}]});
}
export function travel(value:Adventure,fromMap:string,entityId:string,facing:Facing='se'):{scene:WorldScene;exit:MapExit;facing:Facing} {
 return travelParsed(parseAdventure(value),fromMap,entityId,facing);
}
/** Private validated snapshot prevents both repeated validation and caller mutations. */
export function createTraveler(value:Adventure){
 const snapshot=parseAdventure(value);
 return (fromMap:string,entityId:string,facing:Facing='se')=>{const result=travelParsed(snapshot,fromMap,entityId,facing);return {...result,exit:structuredClone(result.exit),scene:structuredClone(result.scene)};};
}
function travelParsed(a:Adventure,fromMap:string,entityId:string,facing:Facing){
 const exit=a.exits.find(e=>e.fromMap===fromMap&&e.entityId===entityId);
 if(!exit)throw new Error('No se encuentra el destino de esta salida.');
 const target=a.maps.find(m=>m.id===exit.toMap)!;
 // Old adventures have no explicit pairing: infer only an unambiguous return exit.
 const reverse=a.exits.filter(e=>e.fromMap===exit.toMap&&e.toMap===fromMap);
 const destinationId=exit.destinationEntityId??(reverse.length===1?reverse[0].entityId:undefined);
 const entrance=target.entities.find(e=>e.id===destinationId);
 let spawn={...exit.arrival};
 if(entrance){
  spawn={...entrance.position};
  if(!walkable(target,spawn))throw new Error('La baldosa de entrada está bloqueada.');
  facing=entranceFacing(target,entrance);
 }

 return {exit,facing,scene:{...target,spawn}};
}
