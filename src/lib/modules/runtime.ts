import type {Adventure} from '../demo/adventure';
import type {InventoryProgress} from '../demo/inventory';
import type {EntityRef,StoryProgress,ModuleStatus} from '../story/types';
import {moduleStatus,setModuleStatus,react} from '../story/engine';
import {objectContentModules} from './adventure-modules';
import {contentModuleReady} from './content';
/** Progress belongs to the object/module association. Returning resumes the unfinished module. */
export function beginObjectModules(a:Adventure,p:StoryProgress,i:InventoryProgress,ref:EntityRef){
 const modules=objectContentModules(a,ref);if(!modules.length||!modules.every(m=>contentModuleReady(m,a.chats)))throw Error('Completa los módulos de este objeto antes de probarlo.');
 const module=modules.find(m=>moduleStatus(p,ref,m.id)==='started')??modules.find(m=>moduleStatus(p,ref,m.id)!=='completed')??modules[0];
 if(modules.length===1&&['completed','failed'].includes(moduleStatus(p,ref,module.id)))return {progress:p,inventory:i,messages:[],moduleId:module.id,finished:false};
 const result=reportObjectModule(a,p,i,ref,module.id,'started',false);return {...result,moduleId:module.id};
}
/** Complete + consequences + start of the next module form one atomic transaction. */
export function reportObjectModule(a:Adventure,p:StoryProgress,i:InventoryProgress,ref:EntityRef,id:string,status:ModuleStatus,advance=true){
 const modules=objectContentModules(a,ref),index=modules.findIndex(m=>m.id===id);if(index<0)throw Error('El módulo ya no existe en este objeto.');
 if(status==='not-started')throw Error('No se puede reiniciar un módulo desde su reproductor.');
 if(moduleStatus(p,ref,id)===status)return {progress:p,inventory:i,messages:[] as string[],moduleId:id,finished:false};
 let result=react(a,setModuleStatus(a,p,ref,id,status),i,ref,('module.'+status) as 'module.started'|'module.completed'|'module.failed',id);
 const next=status==='completed'&&advance?modules[index+1]:undefined;
 if(next){const started=react(a,setModuleStatus(a,result.progress,ref,next.id,'started'),result.inventory,ref,'module.started',next.id);result={...started,messages:[...result.messages,...started.messages]};}
 return {...result,moduleId:next?.id??id,finished:status==='failed'||status==='completed'&&advance&&!next};
}
