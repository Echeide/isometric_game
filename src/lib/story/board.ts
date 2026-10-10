import {contentModuleName} from '../modules/content';
import type {Adventure} from '../demo/adventure';
import {behavior,entityModules} from './engine';
import {eventLabels,entityKey,statusLabels,type EntityRef,type Condition,type StoryEffect} from './types';
import {narrativeTriggerLabels} from './narrative';
export type BoardSelection={kind:'object';ref:EntityRef}|{kind:'event';eventId:string}|{kind:'map';mapId:string}|{kind:'item';itemId:string};
export interface BoardNode {id:string;title:string;mapId?:string;location:string;selection:BoardSelection;visualId?:string;action:string;modules:string[];states:string[];configured:boolean}
export interface BoardEdge {id:string;source:string;target:string;kind:'requirement'|'effect'|'travel';label:string;owner:BoardSelection}
export const objectNode=(ref:EntityRef)=>'object:'+entityKey(ref);
export const eventNode=(id:string)=>'event:'+id;
export const itemNode=(id:string)=>'item:'+id;
export const mapNode=(id:string)=>'map:'+id;
/** References always address placed instances, never reusable sprite IDs. */
export function storyBoard(a:Adventure,t:(source:string,inputs?:Record<string,string|number>)=>string=(source,inputs={})=>source.replace(/\{(\w+)\}/g,(match,key)=>String(inputs[key]??match))){
 const nodes:BoardNode[]=[],edges:BoardEdge[]=[];
 for(const map of a.maps){nodes.push({id:mapNode(map.id),title:map.name,mapId:map.id,location:t('Mapa'),selection:{kind:'map',mapId:map.id},action:map.id===a.startMap?t('Mapa inicial'):t('{arg0} objetos',{arg0:map.entities.length}),modules:[],states:[],configured:true});for(const entity of map.entities){const ref={mapId:map.id,entityId:entity.id},b=behavior(a,ref),modules=entityModules(a,ref);nodes.push({id:objectNode(ref),title:entity.label,mapId:map.id,location:map.name,selection:{kind:'object',ref},visualId:b?.states.find(s=>s.id===b.initialState)?.visualId??entity.visualId??`pixel.${entity.kind}`,action:entity.interaction?.label??t('Sin interacción'),modules:modules.map(m=>m.type==='chat'&&!a.chats?.some(c=>'chat:'+c.id===m.resourceId)?t('Conversación'):m.name),states:b?.states.map(s=>s.name)??[],configured:!!(entity.interaction||b||entity.pickup)});}}
 for(const e of a.story?.events??[])nodes.push({id:eventNode(e.id),title:e.name,mapId:e.mapId,location:e.mapId?a.maps.find(m=>m.id===e.mapId)!.name:t('Toda la aventura'),selection:{kind:'event',eventId:e.id},action:t(narrativeTriggerLabels[e.trigger])+(e.enabled?'':t(' · Desactivado')),modules:e.modules.map(m=>contentModuleName(m,a.chats,t('Conversación'))),states:[],configured:true});
 for(const item of a.items??[])nodes.push({id:itemNode(item.id),title:item.name,location:t('Inventario'),selection:{kind:'item',itemId:item.id},action:item.stackable?t('Acumulable'):t('Artículo único'),modules:[],states:[],configured:true});
 function condition(c:Condition,target:string,owner:BoardSelection,scope:string){const source=c.kind==='item'?itemNode(c.itemId):c.kind==='event'?eventNode(c.eventId):objectNode(c);const detail=c.kind==='item'?t('Tener {arg0}',{arg0:c.quantity}):c.kind==='event'?t(statusLabels[c.status]):c.kind==='module'?(entityModules(a,c).find(m=>m.id===c.moduleId)?.name??c.moduleId)+' '+t(statusLabels[c.status]):behavior(a,c)?.states.find(s=>s.id===c.stateId)?.name??c.stateId;edges.push({id:'',source,target,owner,kind:'requirement',label:scope+': '+(c.not?t('NO '):'')+detail});}
 function effect(e:StoryEffect,source:string,owner:BoardSelection,scope:string){const target=e.kind==='state'?objectNode(e):itemNode(e.itemId),detail=e.kind==='state'?behavior(a,e)?.states.find(s=>s.id===e.stateId)?.name??e.stateId:(e.kind==='give'?t('Dar '):t('Consumir '))+e.quantity;edges.push({id:'',source,target,owner,kind:'effect',label:scope+' → '+detail});}
 for(const b of a.story?.entities??[]){const owner:BoardSelection={kind:'object',ref:b},key=objectNode(b);for(const [name,group]of [['Visible',b.visibility],['Interactuar',b.interaction]] as const)for(const c of group?.conditions??[])condition(c,key,owner,t(name)+(group?.mode==='any'?t(' · alguna'):''));for(const r of b.reactions){for(const c of r.when?.conditions??[])condition(c,key,owner,t('Reacción')+(r.when?.mode==='any'?t(' · alguna'):''));for(const e of r.effects)effect(e,key,owner,t(eventLabels[r.event]));}}
 for(const event of a.story?.events??[]){const owner:BoardSelection={kind:'event',eventId:event.id},key=eventNode(event.id);if(event.mapId)edges.push({id:'',source:mapNode(event.mapId),target:key,owner,kind:'travel',label:t('Al entrar en el mapa')});for(const c of event.when?.conditions??[])condition(c,key,owner,t('Evento')+(event.when?.mode==='any'?t(' · alguna'):''));for(const e of event.effects)effect(e,key,owner,t('Al completar el evento'));}
 for(const exit of a.exits){const owner:BoardSelection={kind:'object',ref:{mapId:exit.fromMap,entityId:exit.entityId}},source=objectNode(owner.ref);edges.push({id:'',source,target:mapNode(exit.toMap),kind:'travel',label:t('Viajar al mapa'),owner});if(exit.requirement)condition({kind:'item',itemId:exit.requirement.itemId,quantity:exit.requirement.quantity},source,owner,t('Salida'));}
 for(const map of a.maps)for(const e of map.entities)if(e.pickup)effect({kind:'give',itemId:e.pickup.itemId,quantity:e.pickup.quantity},objectNode({mapId:map.id,entityId:e.id}),{kind:'object',ref:{mapId:map.id,entityId:e.id}},t('Recoger'));
 const ids=new Set(nodes.map(n=>n.id)),merged=new Map<string,BoardEdge>();for(const edge of edges){if(!ids.has(edge.source)||!ids.has(edge.target))continue;const key=JSON.stringify([edge.source,edge.target,edge.kind,edge.owner]),old=merged.get(key);if(old){if(!old.label.includes(edge.label))old.label+=' · '+edge.label;}else merged.set(key,{...edge,id:key});}
 return {nodes,edges:[...merged.values()]};
}
export function boardPositions(nodes:BoardNode[],saved:Record<string,{x:number;y:number}>={}){
 const positions:Record<string,{x:number;y:number}>={},groups=[...new Set(nodes.map(n=>n.mapId??''))];
 for(const [index,group]of groups.entries()){const members=nodes.filter(n=>(n.mapId??'')===group);for(const [i,node]of members.entries())positions[node.id]=saved[node.id]??{x:40+index*530+(i%2)*248,y:40+Math.floor(i/2)*166};}
 return positions;
}
export function filterBoard(board:ReturnType<typeof storyBoard>,mapId:string,query:string,allObjects=false){
 const search=query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(),connected=new Set(board.edges.flatMap(e=>[e.source,e.target]));
 const base=board.nodes.filter(n=>(!mapId||n.mapId===mapId||n.selection.kind==='event'&&!n.mapId)&&(allObjects||n.configured||connected.has(n.id))&&(!search||[n.title,n.action,n.location,...n.modules,...n.states].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().includes(search)));
 const ids=new Set(base.map(n=>n.id)),seeds=new Set(ids);if(mapId||search)for(const edge of board.edges)if(seeds.has(edge.source)||seeds.has(edge.target)){ids.add(edge.source);ids.add(edge.target);}
 return {nodes:board.nodes.filter(n=>ids.has(n.id)),edges:board.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))};
}
