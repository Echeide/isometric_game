import type {Adventure} from '../demo/adventure';
import {behavior,replaceBehavior} from './engine';
import type {EntityRef,StoryReaction} from './types';

/** Only offer this starter on objects without authored states/reactions or a travel/pickup action. */
export function canPrepareOpenClosed(a:Adventure,ref:EntityRef){
 const entity=a.maps.find(m=>m.id===ref.mapId)?.entities.find(e=>e.id===ref.entityId),config=behavior(a,ref);
 return !!entity&&!entity.pickup&&entity.interaction?.action!=='adventure.exit'&&!a.exits.some(e=>e.fromMap===ref.mapId&&e.entityId===ref.entityId)&&!config?.states.length&&!config?.reactions.length;
}

/** Add a reversible starter without replacing existing rules, graphics or content modules. */
export function prepareOpenClosed(a:Adventure,ref:EntityRef,makeId:()=>string=()=>crypto.randomUUID()):Adventure{
 if(!canPrepareOpenClosed(a,ref))throw Error('El atajo requiere un objeto sin estados ni reacciones, que no sea una salida ni un artículo recogible.');
 const closed=makeId(),open=makeId();
 const transition=(from:string,to:string):StoryReaction=>({id:makeId(),event:'interact',once:false,when:{mode:'all',conditions:[{kind:'object',...ref,stateId:from}]},effects:[{kind:'state',...ref,stateId:to}]});
 const next=replaceBehavior(a,{...behavior(a,ref),...ref,initialState:closed,states:[{id:closed,name:'Cerrado'},{id:open,name:'Abierto'}],reactions:[transition(closed,open),transition(open,closed)]});
 return {...next,maps:next.maps.map(m=>m.id!==ref.mapId?m:{...m,entities:m.entities.map(e=>e.id!==ref.entityId||e.interaction&&e.interaction.action!=='info.open'?e:{...e,interaction:{label:'Abrir / cerrar',action:'story.interact',resourceId:e.id}})})};
}
