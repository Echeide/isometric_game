export interface ChatNode { id: string; messages?: string[] | string[][]; options?: {text:string;target?:string;home?:boolean}[]; [key:string]:unknown }
export interface ChatConfig { chatNodes:ChatNode[]; avatar?:string; [key:string]:unknown }

/** Validate the native RoutingTales format without translating its node payload. */
export function parseChat(value:unknown):ChatConfig {
 const config=value as ChatConfig;
 if(!config||!Array.isArray(config.chatNodes)||!config.chatNodes.length)throw new Error('La conversación no contiene chatNodes.');
 const ids=new Set<string>();
 for(const node of config.chatNodes){
  if(!node||typeof node.id!=='string'||!node.id||/["\\\]\[]/.test(node.id)||ids.has(node.id))throw new Error('La conversación contiene identificadores inválidos o repetidos.');
  ids.add(node.id);
  if(node.messages!==undefined&&(!Array.isArray(node.messages)||!(node.messages.every(m=>typeof m==='string')||node.messages.every(m=>Array.isArray(m)&&m.length>0&&m.every(t=>typeof t==='string')))))throw new Error('Los mensajes de la conversación no son válidos.');
  if(node.options!==undefined&&(!Array.isArray(node.options)||!node.options.every(o=>o&&typeof o.text==='string')))throw new Error('Las respuestas de la conversación no son válidas.');
 }
 for(const node of config.chatNodes)for(const option of node.options??[])if(!option.home&&!ids.has(option.target??''))throw new Error('Una respuesta apunta a un nodo que no existe.');
 return config;
}
export function chatUrl(resource:string):string {
 if(resource==='lucia'||resource==='marcos')return `/chats/${resource}.json`;
 if(resource.startsWith('/')&&!resource.startsWith('//')&&/\.json(?:\?.*)?$/.test(resource))return resource;
 throw new Error('Esta conversación no tiene un archivo JSON asignado.');
}
export function chatProgressKey(adventure:string,map:string,entity:string,resource:string){return 'isometrico.chat.v1:'+JSON.stringify([adventure,map,entity,resource]);}
export function resumeNode(config:ChatConfig,saved:string|null):string|undefined {return config.chatNodes.some(n=>n.id===saved)?saved!:undefined;}
