import type {ConditionGroup} from '../story/types';
import type {RoutingContentModule} from './routing';
/** Every host uses this catalog, payload and renderer. IDs belong to the association, not the shared chat. */
export const contentModuleTypes=[{id:'context',label:'Contexto'},{id:'chat',label:'Conversación'},{id:'info',label:'Información'},{id:'video',label:'Vídeo'},{id:'question',label:'Pregunta'}] as const;
export type ContentModuleType=typeof contentModuleTypes[number]['id'];
export interface ContextSlide {id:string;title?:string;image?:string;text:string}
export interface ContextModule {id:string;type:'context';title:string;text:string;slides?:ContextSlide[]}
export type ContentModule=(ContextModule|{id:string;type:'chat';resourceId?:string}|RoutingContentModule)&{when?:ConditionGroup;/** Legacy import field; pending modules now always restart. */repeat?:boolean};
export interface ContentModuleCard {id:string;type:ContentModuleType;name:string}
export type ModuleHost={kind:'object';mapId:string;entityId:string}|{kind:'event';eventId:string};

export type ModuleStep={kind:'module';moduleId:string}|{kind:'condition';id:string;when?:ConditionGroup;moduleIds:string[];elseModuleIds?:string[]};
