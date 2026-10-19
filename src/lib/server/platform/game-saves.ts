import {isDeepStrictEqual} from 'node:util';
import type {PoolClient} from 'pg';
import type {Principal} from '../../platform/types';
import type {PlayerPrincipal} from '../../player/types';
import {parseGameSave,ownsGameRecord,type GameSave} from '../../storage/game-save';
import type {Adventure} from '../../demo/adventure';
import {Database} from './database';
import {PlatformError} from './auth';

export class GameSaveError extends PlatformError {constructor(status:number,message:string,public code:string){super(status,message);}}
export interface SaveContext {publication?:string|null;adventure?:string|null;release?:string|null;account?:string|null;tenant?:string|null}
export class GameSaves {
 constructor(readonly database:Database){}
 private async context(db:PoolClient,p:Principal|null|undefined,player:PlayerPrincipal|null|undefined,context:SaveContext){
  if(!!context.publication===!!context.adventure)throw new PlatformError(400,'Selecciona una aventura para guardar la partida.');
  let row:any,scope:string,playerId:string|null=null,userId:string|null=null;
  if(context.publication){
   if(player)playerId=player.id;else if(p)userId=p.user.id;else throw new GameSaveError(401,'Inicia sesión para sincronizar tu partida.','unauthorized');
   row=(await db.query('SELECT p.tenant_id,p.adventure_id,r.id AS release_id,r.definition FROM platform_publications p JOIN platform_tenants t ON t.id=p.tenant_id JOIN platform_releases r ON r.id=p.release_id WHERE p.slug=$1 AND p.active AND t.enabled',[context.publication])).rows[0];
   scope='public:'+context.publication;
   if(row&&context.release&&row.release_id!==context.release)throw new GameSaveError(409,'La aventura se ha actualizado. Recarga la página para continuar.','content-changed');
  }else{
   if(!p?.tenant)throw new GameSaveError(401,'Inicia sesión en tu espacio para guardar las pruebas.','unauthorized');userId=p.user.id;
   row=(await db.query('SELECT tenant_id,id AS adventure_id,definition FROM platform_adventures WHERE tenant_id=$1 AND id=$2',[p.tenant.id,context.adventure])).rows[0];
   scope=JSON.stringify(['preview',p.tenant.id,context.adventure]);
  }
  if(!row)throw new PlatformError(404,'Aventura no disponible.');
  const owner=playerId?'player:'+playerId:'admin:'+userId;
  if(context.account&&context.account!==owner||context.tenant&&context.tenant!==row.tenant_id)throw new GameSaveError(401,'La cuenta ha cambiado. Vuelve a iniciar sesión para sincronizar esta partida.','unauthorized');
  await db.query("SELECT set_config('platform.save_owner',$1,true),set_config('platform.save_scope',$2,true)",[owner,scope]);
  return {...row,definition:row.definition as Adventure,scope,owner,playerId,userId};
 }
 private result(row:any,releaseId:string|null){return {save:(row?.state??null) as GameSave|null,revision:Number(row?.revision??0),writeId:row?.write_id??null,releaseId:releaseId??null};}
 async read(p:Principal|null|undefined,player:PlayerPrincipal|null|undefined,context:SaveContext){
  return this.database.transaction(p?.tenant?.id??null,false,async db=>{const c=await this.context(db,p,player,context),row=(await db.query('SELECT state,revision,write_id FROM platform_game_saves WHERE owner_key=$1 AND scope_key=$2',[c.owner,c.scope])).rows[0];return this.result(row,c.release_id);});
 }
 async write(p:Principal|null|undefined,player:PlayerPrincipal|null|undefined,context:SaveContext,input:{save:unknown;revision:number;writeId:string}){
  if(!input||!Number.isInteger(input.revision)||input.revision<0||input.revision>=2147483647||typeof input.writeId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.writeId))throw new PlatformError(400,'Versión de partida no válida.');
  return this.database.transaction(p?.tenant?.id??null,false,async db=>{
   const c=await this.context(db,p,player,context),raw=input.save as GameSave;
   if(!raw?.records||Object.keys(raw.records).length>2048||Object.entries(raw.records).some(([key,value])=>!ownsGameRecord(c.adventure_id,key)||typeof value!=='string'||value.length>300_000))throw new PlatformError(400,'Contenido de partida no válido.');
   const save=parseGameSave(input.save,c.definition);if(!save)throw new PlatformError(400,'Formato de partida no válido.');
   if(Buffer.byteLength(JSON.stringify(save),'utf8')>1_000_000)throw new PlatformError(413,'La partida supera el tamaño permitido.');
   // Serialize first writes as well as updates; retries use the same write ID.
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[c.owner,c.scope]);
   const existing=(await db.query('SELECT state,revision,write_id FROM platform_game_saves WHERE owner_key=$1 AND scope_key=$2',[c.owner,c.scope])).rows[0];
   if(existing?.write_id===input.writeId){
    if(!isDeepStrictEqual({...existing.state,savedAt:undefined},{...save,savedAt:undefined}))throw new PlatformError(400,'Identificador de guardado reutilizado.');
    return this.result(existing,c.release_id);
   }
   if(Number(existing?.revision??0)!==input.revision)throw new GameSaveError(409,'La partida ha avanzado en otro dispositivo. Carga la partida del servidor para continuar.','conflict');
   save.savedAt=new Date().toISOString();
   const row=(await db.query(`INSERT INTO platform_game_saves(owner_key,scope_key,player_id,user_id,tenant_id,adventure_id,publication_slug,release_id,state,revision,write_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,$10) ON CONFLICT(owner_key,scope_key) DO UPDATE SET state=EXCLUDED.state,revision=platform_game_saves.revision+1,write_id=EXCLUDED.write_id,release_id=EXCLUDED.release_id,updated_at=now() RETURNING state,revision,write_id`,[c.owner,c.scope,c.playerId,c.userId,c.tenant_id,c.adventure_id,context.publication??null,c.release_id??null,save,input.writeId])).rows[0];
   return this.result(row,c.release_id);
  });
 }
}
