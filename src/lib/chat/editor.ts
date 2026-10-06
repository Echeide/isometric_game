import {parseChat,type ChatConfig,type ChatNode,chatUrl} from './routingtales';

export interface AdventureChat {id:string;name:string;config:ChatConfig}
export const CHAT_PREFIX='chat:';
export const MAX_CHAT_BYTES=2_000_000;
export function chatResource(id:string){return CHAT_PREFIX+id;}
export function embeddedChat(chats:AdventureChat[]|undefined,resource:string):ChatConfig|undefined {
 if(!resource.startsWith(CHAT_PREFIX))return undefined;
 const chat=chats?.find(c=>chatResource(c.id)===resource);
 if(!chat)throw Error('La conversación no existe en esta aventura.');
 return chat.config;
}
export function validateChats(value:unknown):AdventureChat[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>128)throw Error('La aventura admite hasta 128 conversaciones.');
 const ids=new Set<string>();
 for(const c of value){
  if(!c||typeof c.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>120)throw Error('Las conversaciones necesitan identificadores únicos y un nombre de hasta 120 caracteres.');
  ids.add(c.id);parseChat(c.config);
 }
 if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_CHAT_BYTES)throw Error('Las conversaciones de la aventura no pueden superar 2 MB.');
 return value;
}
export function importChat(text:string):ChatConfig {
 if(new TextEncoder().encode(text).length>MAX_CHAT_BYTES)throw Error('La conversación no puede superar 2 MB.');
 return parseChat(JSON.parse(text));
}
export function createChat():ChatConfig {return {chatNodes:[{id:'start',messages:[['Hola, {playerName}.']],options:[{text:'Continuar',target:'success'}]},{id:'success',messages:[['¡Hasta pronto!']],options:[]}]};}
export async function loadChat(resource:string,signal?:AbortSignal){
 const response=await fetch(chatUrl(resource),{signal});if(!response.ok)throw Error('No se pudo cargar la conversación original. Puedes importar su JSON.');
 const text=await response.text(),config=importChat(text);
 const base=new URL(chatUrl(resource),location.href);
 if(config.avatar)config.avatar=new URL(config.avatar,base).href;
 return config;
}
// Adapted from RoutingTales nuevo_editor/editor_Chats.html, parseMessagesFromText.
// Groups separated by --- are successive visits to a node, not separate nodes.
export function parseMessagesFromText(text:string):string[][] {
 if(!text.trim())return [];
 return text.split('---').map(group=>group.trim().split('\n').filter(msg=>msg.trim())).filter(group=>group.length);
}
export function messageGroups(node:ChatNode):string[][] {
 const messages=node.messages??[];
 if(!messages.length)return [];
 return Array.isArray(messages[0])?(messages as string[][]).map(group=>[...group]):[[...(messages as string[])]];
}
export function renameNode(config:ChatConfig,index:number,id:string):ChatConfig {
 if(!id||/["\\\]\[]/.test(id)||config.chatNodes.some((n,i)=>i!==index&&n.id===id))throw Error('El identificador del nodo está vacío, repetido o contiene caracteres no admitidos.');
 const old=config.chatNodes[index]?.id;if(!old)throw Error('El nodo no existe.');
 return {...config,chatNodes:config.chatNodes.map((n,i)=>({...n,...(i===index?{id}:{}),...(n.options?{options:n.options.map(o=>!o.home&&o.target===old?{...o,target:id}:{...o})}:{})}))};
}
export function removeNode(config:ChatConfig,index:number):ChatConfig {
 if(config.chatNodes.length<=1)throw Error('La conversación necesita al menos un nodo.');
 const id=config.chatNodes[index]?.id;
 if(config.chatNodes.some((n,i)=>i!==index&&n.options?.some(o=>!o.home&&o.target===id)))throw Error('Otra respuesta apunta a este nodo. Cambia su destino antes de eliminarlo.');
 return {...config,chatNodes:config.chatNodes.filter((_,i)=>i!==index)};
}
/** Node order determines the entry node; branches continue to reference stable IDs. */
export function reorderNode(config:ChatConfig,from:number,to:number):ChatConfig {
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=config.chatNodes.length||to>=config.chatNodes.length)throw Error('La posición del nodo no es válida.');
 if(from===to)return config;
 const nodes=[...config.chatNodes],node=nodes.splice(from,1)[0];nodes.splice(to,0,node);
 return {...config,chatNodes:nodes};
}
