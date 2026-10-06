export const moduleStatuses=['not-started','started','completed','failed'] as const;
export type ModuleStatus=typeof moduleStatuses[number];
export const statusLabels:Record<ModuleStatus,string>={'not-started':'No iniciado',started:'Iniciado',completed:'Completado',failed:'Fallado'};
export interface EntityRef {mapId:string;entityId:string}
export type Condition=(EntityRef&{kind:'object';stateId:string;not?:boolean})|(EntityRef&{kind:'module';moduleId:string;status:ModuleStatus;not?:boolean})|{kind:'item';itemId:string;quantity:number;not?:boolean};
export interface ConditionGroup {mode:'all'|'any';conditions:Condition[]}
export interface ObjectState {id:string;name:string;description?:string;visualId?:string;solid?:boolean;visible?:boolean;interactive?:boolean}
export type StoryEffect=(EntityRef&{kind:'state';stateId:string})|{kind:'give'|'consume';itemId:string;quantity:number};
export const storyEvents=['interact','module.started','module.completed','module.failed'] as const;
export type StoryEvent=typeof storyEvents[number];
export const eventLabels:Record<StoryEvent,string>={interact:'Al ejecutar la interacción','module.started':'Al iniciar un módulo','module.completed':'Al completar un módulo','module.failed':'Al fallar un módulo'};
export interface StoryReaction {id:string;event:StoryEvent;moduleId?:string;once:boolean;when?:ConditionGroup;effects:StoryEffect[]}
export interface EntityBehavior extends EntityRef {states:ObjectState[];initialState?:string;visibility?:ConditionGroup;interaction?:ConditionGroup;blockedMessage?:string;reactions:StoryReaction[]}
export interface StoryDefinition {version:1;entities:EntityBehavior[]}
export interface StoryProgress {states:Record<string,string>;modules:Record<string,ModuleStatus>;fired:string[]}
export const entityKey=(ref:EntityRef)=>JSON.stringify([ref.mapId,ref.entityId]);
export const moduleKey=(ref:EntityRef,moduleId:string)=>JSON.stringify([ref.mapId,ref.entityId,moduleId]);
export const reactionKey=(ref:EntityRef,id:string)=>JSON.stringify([ref.mapId,ref.entityId,id]);
export const emptyStory=():StoryProgress=>({states:{},modules:{},fired:[]});
