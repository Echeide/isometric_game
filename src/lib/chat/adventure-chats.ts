import {parseAdventure,type Adventure} from '../demo/adventure';
import {chatResource,type AdventureChat} from './editor';
/** Keep the module payload local to the adventure and assign it atomically. */
export function attachChat(value:Adventure,mapId:string,entityId:string,chat:AdventureChat):Adventure {
 const map=value.maps.find(m=>m.id===mapId),entity=map?.entities.find(e=>e.id===entityId);
 if(!entity)throw Error('El elemento de la conversación ya no existe.');
 if(entity.pickup||value.exits.some(e=>e.fromMap===mapId&&e.entityId===entityId))throw Error('Una salida o un recogible no puede sustituir su acción por una conversación.');
 return parseAdventure({...value,chats:[...(value.chats??[]).filter(c=>c.id!==chat.id),chat],maps:value.maps.map(m=>m.id!==mapId?m:{...m,entities:m.entities.map(e=>e.id!==entityId?e:{...e,interaction:{label:e.interaction?.action==='chat.open'?e.interaction.label:'Conversar',action:'chat.open',resourceId:chatResource(chat.id)}})})},{allowUnreachable:true});
}
