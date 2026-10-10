import type {RoutingContentModule} from './routing';
/** Every host uses this catalog, payload and renderer. IDs belong to the association, not the shared chat. */
export const contentModuleTypes=[{id:'context',label:'Contexto'},{id:'chat',label:'Conversación'},{id:'info',label:'Información'},{id:'video',label:'Vídeo'},{id:'question',label:'Pregunta'}] as const;
export type ContentModuleType=typeof contentModuleTypes[number]['id'];
export type ContentModule={id:string;type:'context';title:string;text:string}|{id:string;type:'chat';resourceId?:string}|RoutingContentModule;
export interface ContentModuleCard {id:string;type:ContentModuleType;name:string}
export type ModuleHost={kind:'object';mapId:string;entityId:string}|{kind:'event';eventId:string};
