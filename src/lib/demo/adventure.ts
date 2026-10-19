import {validateLocalization,type AdventureLocalization} from '../i18n/adventure';
import type {StoryDefinition} from '../story/types';
import {validateStory} from '../story/validation';
import type {InventoryItem} from './inventory';
import {entranceFacing} from '../../../packages/world/src/exits';
import { parseScene, isCustomVisual, compatibleVisualKind, validateCustomCatalog, validateCatalogOverrides, type VisualCatalogOverrides, type VisualAsset, type Cell, type Facing, type WorldScene } from '@isometrico/world';
import { findPath, interactionCells, walkable } from '../../../packages/world/src/navigation';
import { insertEntity } from './editor';
import {defaultAdventurePalette,validateAdventurePalette,type AdventurePalette} from './adventure-palette';
import {validateChats,embeddedChat,type AdventureChat,CHAT_PREFIX} from '../chat/editor';

export interface MapExit { id:string; fromMap:string; entityId:string; toMap:string; arrival:Cell; arrivalMode?:'spawn'|'position'; destinationEntityId?:string; requirement?:{itemId:string;quantity:number;consume:boolean} }
export interface Adventure { kind:'isometric-adventure'; version:1; id:string; name:string; startMap:string; maps:WorldScene[]; exits:MapExit[]; items?:InventoryItem[]; inventoryExampleVersion?:1; catalog?:VisualAsset[]; catalogOverrides?:VisualCatalogOverrides; palette?:AdventurePalette; chats?:AdventureChat[]; story?:StoryDefinition; localization?:AdventureLocalization }
/** Resolve the destination once for validation, the inspector and gameplay. */
export function exitArrival(a:Pick<Adventure,'maps'|'exits'>,exit:MapExit){
 const map=a.maps.find(m=>m.id===exit.toMap);if(!map)throw new Error('El mapa de destino no existe.');
 const reverse=a.exits.filter(e=>e.fromMap===exit.toMap&&e.toMap===exit.fromMap);
 const id=exit.destinationEntityId??(exit.arrivalMode===undefined&&reverse.length===1?reverse[0].entityId:undefined);
 const entity=id===undefined?undefined:map.entities.find(e=>e.id===id);
 if(id!==undefined&&!entity)throw new Error('La entrada de destino no existe.');
 const mode=entity?'entity':exit.arrivalMode==='spawn'?'spawn':'position';
 const cell={...(entity?.position??(mode==='spawn'?map.spawn:exit.arrival))};
 return {map,cell,entity,mode};
}
/** Keep old one-way links that used the map entry attached to that entry after an edit. */
export function changeMapSpawn(value:Adventure,mapId:string,spawn:Cell):Adventure{
 const previous=value.maps.find(m=>m.id===mapId);if(!previous)throw new Error('El mapa no existe.');
 const exits=value.exits.map(exit=>{
  if(exit.toMap!==mapId||exit.destinationEntityId||exit.arrivalMode==='position')return exit;
  const old=exitArrival(value,exit);
  const follows=old.mode==='spawn'||old.mode==='position'&&exit.arrival.x===previous.spawn.x&&exit.arrival.y===previous.spawn.y;
  return follows?{...exit,arrivalMode:'spawn' as const,arrival:{...spawn}}:exit;
 });
 return parseAdventure({...value,maps:value.maps.map(m=>m.id===mapId?{...m,spawn:{...spawn}}:m),exits},{allowUnreachable:true});
}
export const ADVENTURE_KEY='isometrico.adventure.v1';
export function createAdventure(maps:WorldScene[]):Adventure {
 return parseAdventure({kind:'isometric-adventure',version:1,id:'my-adventure',name:'Mi aventura',startMap:maps[0]?.id,maps,exits:[],palette:defaultAdventurePalette()});
}
export function parseAdventure(value:unknown,options:{allowUnreachable?:boolean}={}):Adventure {
 const a=value as Adventure;
 if(!a||a.kind!=='isometric-adventure'||a.version!==1)throw new Error('Formato de aventura no compatible.');
 if(typeof a.id!=='string'||!a.id.trim()||typeof a.name!=='string'||!a.name.trim())throw new Error('La aventura necesita identificador y nombre.');
 if(!Array.isArray(a.maps)||!a.maps.length||a.maps.length>64||!Array.isArray(a.exits)||a.exits.length>1024)throw new Error('La aventura admite entre 1 y 64 mapas y hasta 1024 salidas.');
 const maps=a.maps.map(m=>parseScene(m,options)), byId=new Map(maps.map(m=>[m.id,m]));
 const catalog=validateCustomCatalog(a.catalog);
 for(const map of a.maps??[])for(const d of map.decorations??[])if(isCustomVisual(d.visualId)&&!catalog.some(r=>r.id===d.visualId&&r.kind!=='person'))throw new Error(`Falta ${d.visualId} en el catálogo de la aventura.`);
 validateCatalogOverrides(a.catalogOverrides);
 if(a.palette!==undefined)validateAdventurePalette(a.palette);
 validateChats(a.chats);
 validateLocalization(a.localization);
 for(const map of maps)for(const entity of map.entities)if(entity.interaction?.action==='chat.open'&&entity.interaction.resourceId.startsWith(CHAT_PREFIX))embeddedChat(a.chats,entity.interaction.resourceId);
 for(const map of maps)for(const e of map.entities)if(isCustomVisual(e.visualId)&&!catalog.some(r=>r.id===e.visualId&&compatibleVisualKind(e.kind,r.kind)))throw new Error(`Falta ${e.visualId} en el catálogo de la aventura.`);
 if(byId.size!==maps.length)throw new Error('Hay mapas con identificadores repetidos.');
 if(!byId.has(a.startMap))throw new Error('El mapa inicial no existe.');
 const items=a.items??[];
 if(!Array.isArray(items)||items.some(i=>!i||typeof i.id!=='string'||!i.id.trim()||typeof i.name!=='string'||!i.name.trim()||typeof i.description!=='string'||typeof i.stackable!=='boolean')||new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Artículos de inventario no válidos.');
 const checkItem=(r:{itemId:string;quantity:number})=>{if(!items.some(i=>i.id===r.itemId)||!Number.isSafeInteger(r.quantity)||r.quantity<1)throw new Error('Referencia o cantidad de inventario no válida.');};
 for(const map of maps)for(const e of map.entities)if(e.pickup){checkItem(e.pickup);if(e.solid!==false||e.interaction?.action!=='inventory.collect')throw new Error('Un recogible debe permitir el paso y tener acción de recogida.');}
 for(const exit of a.exits)if(exit.requirement){checkItem(exit.requirement);if(typeof exit.requirement.consume!=='boolean')throw new Error('Consumo no válido.');}
 const ids=new Set<string>(),sources=new Set<string>();
 for(const exit of a.exits){
  if(!exit||typeof exit.id!=='string'||!exit.id.trim()||ids.has(exit.id))throw new Error('Las salidas necesitan identificadores únicos.');
  ids.add(exit.id);
  const from=byId.get(exit.fromMap),to=byId.get(exit.toMap),entity=from?.entities.find(e=>e.id===exit.entityId);
  if(!from||!to||!entity)throw new Error('Una salida referencia un mapa u objeto inexistente.');
  const key=JSON.stringify([from.id,entity.id]);if(sources.has(key))throw new Error('Un objeto solo puede tener una salida.');sources.add(key);
  if(entity.interaction?.action!=='adventure.exit'||entity.interaction.resourceId!==exit.id)throw new Error(`La salida ${entity.label} no tiene la interacción correcta.`);
  if(exit.arrivalMode!==undefined&&!['spawn','position'].includes(exit.arrivalMode))throw new Error('Tipo de llegada no válido.');
  if(!exit.arrival||!Number.isInteger(exit.arrival.x)||!Number.isInteger(exit.arrival.y)||exit.arrival.x<0||exit.arrival.y<0||exit.arrival.x>63||exit.arrival.y>63)throw new Error(`La llegada a ${to.name} no es válida.`);
  const destination=exitArrival({maps,exits:a.exits},exit);
  if(!walkable(to,destination.cell))throw new Error(`La llegada a ${to.name} está fuera del mapa o bloqueada (${destination.cell.x}, ${destination.cell.y}).`);
  if(!options.allowUnreachable&&findPath(to,destination.cell,[to.spawn])===null)throw new Error(`La llegada a ${to.name} está aislada de su entrada.`);
  if(!options.allowUnreachable&&findPath(from,from.spawn,interactionCells(from,entity))===null)throw new Error(`No se puede llegar a la salida ${entity.label}.`);
 }
 for(const m of maps)for(const e of m.entities)if(e.interaction?.action==='adventure.exit'&&!a.exits.some(x=>x.fromMap===m.id&&x.entityId===e.id))throw new Error(`Falta el destino de ${e.label}.`);
 validateStory({...a,maps});
 return JSON.parse(JSON.stringify({...a,maps})) as Adventure;
}
export function saveAdventure(storage:Pick<Storage,'setItem'>,value:unknown){const a=parseAdventure(value);storage.setItem(ADVENTURE_KEY,JSON.stringify(a));return a;}
export function readAdventure(storage:Pick<Storage,'getItem'>):Adventure|null {const raw=storage.getItem(ADVENTURE_KEY);return raw?parseAdventure(JSON.parse(raw)):null;}
export function connectMaps(value:Adventure,fromMap:string,toMap:string,id:string,arrival?:Cell,position?:Cell,options:{allowUnreachable?:boolean}={}):Adventure {
 const a=parseAdventure(value,options),from=a.maps.find(m=>m.id===fromMap),to=a.maps.find(m=>m.id===toMap);
 if(!from||!to)throw new Error('Selecciona un mapa de origen y destino.');
 const scene=insertEntity(from,'goal',id,'pixel.goal',position,undefined,options);
 const entity=scene.entities.find(e=>e.id===id)!;entity.label=`Salida a ${to.name}`;entity.interaction={label:`Viajar a ${to.name}`,action:'adventure.exit',resourceId:id};
 const reverse=a.exits.filter(e=>e.fromMap===toMap&&e.toMap===fromMap&&!e.destinationEntityId&&e.arrivalMode!=='position');
 const paired=reverse.length===1?reverse[0]:undefined;
 return parseAdventure({...a,maps:a.maps.map(m=>m.id===fromMap?scene:m),exits:[...a.exits.map(e=>e===paired?{...e,destinationEntityId:id}:e),{id,fromMap,toMap,entityId:id,arrival:arrival??to.spawn,...(!arrival?{arrivalMode:'spawn' as const}:{}),...(paired?{destinationEntityId:paired.entityId}:{})}]},options);
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
 const destination=exitArrival(a,exit),target=destination.map,spawn=destination.cell;
 if(!walkable(target,spawn))throw new Error('La baldosa de entrada está bloqueada.');
 if(destination.entity)facing=entranceFacing(target,destination.entity);

 return {exit,facing,scene:{...target,spawn}};
}
