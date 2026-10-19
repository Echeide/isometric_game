import {parseGameSave,type GameSave,type GameSaveRepository} from './game-save';
import type {Adventure} from '../demo/adventure';
export type SyncState='loading'|'synced'|'pending'|'saving'|'offline'|'conflict'|'unauthorized'|'content-changed'|'error';
export interface SyncStatus {state:SyncState;message?:string}
interface Mutation {save:GameSave;writeId:string}
interface Cache {format:1;loaded:boolean;revision:number;save:GameSave|null;pending?:Mutation;flight?:Mutation&{revision:number};backup?:GameSave}
export interface CloudResult {save:GameSave|null;revision:number;writeId:string|null;releaseId?:string|null}
export class CloudSaveError extends Error {constructor(message:string,public code:SyncState='offline'){super(message);}}
export interface SaveTransport {read:()=>Promise<CloudResult>;write:(value:Mutation&{revision:number},keepalive?:boolean)=>Promise<CloudResult>}
export function saveTransport(endpoint:string,fetcher:typeof fetch=fetch):SaveTransport{
 async function request(body?:unknown,keepalive=false){
  let response:Response,value:any;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{response=await fetcher(endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store',keepalive,signal:controller.signal});value=await response.json();}
  catch{throw new CloudSaveError('Sin conexión. La partida sigue guardada en este dispositivo.');}
  finally{clearTimeout(timer);}
  if(!response.ok)throw new CloudSaveError(value.message??'No se pudo sincronizar la partida.',response.status===401?'unauthorized':response.status===409?value.code==='content-changed'?'content-changed':'conflict':response.status>=500?'offline':'error');
  return value as CloudResult;
 }
 return {read:()=>request(),write:(value,keepalive)=>request(value,keepalive)};
}

/** Durable outbox: an ambiguous network failure retries the same operation ID. */
export function cloudGameSaves(options:{storage:Pick<Storage,'getItem'|'setItem'>;key:string;adventure:Adventure;transport:SaveTransport;onstatus?:(status:SyncStatus)=>void;delay?:number;uuid?:()=>string}){
 const {storage,key,adventure,transport,onstatus}=options,uuid=options.uuid??(()=>crypto.randomUUID());
 let cache:Cache={format:1,loaded:false,revision:0,save:null},closed=false,timer:ReturnType<typeof setTimeout>|undefined,running:Promise<boolean>|undefined;
 let status:SyncStatus={state:'loading'};
 try{const raw=JSON.parse(storage.getItem(key)??'null');if(raw?.format===1&&Number.isInteger(raw.revision)&&raw.revision>=0){const save=raw.save?parseGameSave(raw.save,adventure):null;if(!raw.save||save)cache={...raw,save};}}catch{/* A remote read can rebuild a missing or damaged cache. */}
 const blocked=()=>['conflict','unauthorized','content-changed','error'].includes(status.state);
 function report(value:SyncStatus){status=value;if(!closed)onstatus?.(value);}
 function persist(next:Cache){storage.setItem(key,JSON.stringify(next));cache=structuredClone(next);}
 function later(delay=options.delay??800){clearTimeout(timer);if(!closed&&!running&&!blocked())timer=setTimeout(()=>void flush(),delay);}
 function checked(value:CloudResult){if(!Number.isInteger(value.revision)||value.revision<0)throw new CloudSaveError('Respuesta de guardado no válida.','error');const save=value.save?parseGameSave(value.save,adventure):null;if(value.save&&!save)throw new CloudSaveError('La partida del servidor no es compatible.','error');return {...value,save};}
 function failure(error:unknown){const e=error instanceof CloudSaveError?error:new CloudSaveError('No se pudo guardar la copia local de la partida.','error');report({state:e.code,message:e.message});}
 async function flush(keepalive=false):Promise<boolean>{
  clearTimeout(timer);if(running)return running;if(closed||blocked()||!cache.loaded)return false;
  running=Promise.resolve().then(async()=>{
   try{
    while(cache.flight||cache.pending){
     if(!cache.flight)persist({...cache,flight:{...cache.pending!,revision:cache.revision},pending:undefined});
     const sent=cache.flight!;report({state:'saving'});
     const result=checked(await transport.write(sent,keepalive));
     persist({...cache,revision:result.revision,save:cache.pending?cache.save:result.save,flight:undefined});
    }
    report({state:'synced'});return true;
   }catch(e){failure(e);return false;}
   finally{running=undefined;}
  });
  const result=await running;
  if(!result&&status.state==='offline')later(5000);
  return result;
 }
 const repository:GameSaveRepository={
  read:()=>cache.save?structuredClone(cache.save):null,
  write(save){if(closed)throw Error('La partida ya no está activa.');persist({...cache,save:structuredClone(save),pending:{save:structuredClone(save),writeId:uuid()}});if(!blocked())report({state:'pending'});later();}
 };
 return {
  ...repository,
  get status(){return status;},get ready(){return cache.loaded;},get blocked(){return blocked();},
  async load(){
   if(running)await running;report({state:'loading'});
   try{
    const result=checked(await transport.read());
    if(cache.pending||cache.flight){persist({...cache,loaded:true});await flush();}
    else {persist({...cache,loaded:true,revision:result.revision,save:result.save});report({state:'synced'});}
   }catch(e){failure(e);if(!cache.loaded)throw e;}
   return repository.read();
  },
  /** Explicit recovery keeps the unsent local playthrough as a backup. */
  async useServer(){if(running)await running;const result=checked(await transport.read());persist({format:1,loaded:true,revision:result.revision,save:result.save,backup:cache.save??cache.backup});report({state:'synced'});return repository.read();},
  flush,
  close(){closed=true;clearTimeout(timer);}
 };
}
export type CloudGameSaves=ReturnType<typeof cloudGameSaves>;
