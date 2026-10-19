import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {PlayerPrincipal} from '../../player/types';
import {Database} from './database';
import {PlatformError,hashPassword,hashToken,verifyPassword} from './auth';

export class PlayerAuth {
 constructor(readonly database:Database){}
 private async limit(address:string,name:string,register:boolean){
  const allowed=await this.database.transaction(null,true,async db=>{
   for(const [key,max] of [[hashToken(`player:${register?'register':'login'}:address:`+address),register?10:50],...(!register?[[hashToken('player:account:'+name),10]]:[])] as [string,number][]){
    const r=await db.query("INSERT INTO platform_login_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN platform_login_attempts.expires_at<now() THEN 1 ELSE platform_login_attempts.attempts+1 END,expires_at=CASE WHEN platform_login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE platform_login_attempts.expires_at END RETURNING attempts",[key]);
    if(r.rows[0].attempts>max)return false;
   }return true;
  });
  if(!allowed)throw new PlatformError(429,'Demasiados intentos. Espera 15 minutos.');
 }
 private async session(db:PoolClient,id:string){const token=randomBytes(32).toString('hex');await db.query("INSERT INTO platform_player_sessions(id,token_hash,player_id,expires_at) VALUES($1,$2,$3,now()+interval '30 days')",[randomUUID(),hashToken(token),id]);await db.query('DELETE FROM platform_player_sessions WHERE expires_at<now()');return token;}
 async register(username:unknown,password:string,address:string){
  const name=typeof username==='string'?username.trim().toLowerCase():'';
  if(!/^[a-z0-9_.-]{3,64}$/.test(name))throw new PlatformError(400,'El usuario debe tener entre 3 y 64 letras, números, puntos, guiones o guiones bajos.');
  await this.limit(address,name,true);const hash=await hashPassword(password);
  try{return await this.database.transaction(null,true,async db=>{const id=randomUUID();await db.query('INSERT INTO platform_players(id,username,password_hash) VALUES($1,$2,$3)',[id,name,hash]);return this.session(db,id);});}
  catch(e){if((e as {code?:string}).code==='23505')throw new PlatformError(409,'Ese nombre de jugador ya está en uso.');throw e;}
 }
 async login(username:unknown,password:string,address:string){
  const name=typeof username==='string'?username.trim().toLowerCase():'';await this.limit(address,name,false);
  return this.database.transaction(null,true,async db=>{const row=(await db.query('SELECT * FROM platform_players WHERE username=$1',[name])).rows[0],dummy='scrypt-v1:'+ '00'.repeat(16)+':'+ '00'.repeat(64);
   const valid=await verifyPassword(password,row?.password_hash??dummy);if(!row?.enabled||!valid)throw new PlatformError(401,'Usuario o contraseña incorrectos.');
   await db.query('DELETE FROM platform_login_attempts WHERE key=$1',[hashToken('player:account:'+name)]);return this.session(db,row.id);
  });
 }
 async principal(token:string|undefined):Promise<PlayerPrincipal|null>{
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return this.database.transaction(null,true,async db=>{const row=(await db.query('SELECT p.id,p.username,s.id AS session_id FROM platform_player_sessions s JOIN platform_players p ON p.id=s.player_id WHERE s.token_hash=$1 AND s.expires_at>now() AND p.enabled',[hashToken(token)])).rows[0];return row?{id:row.id,username:row.username,sessionId:row.session_id}:null;});
 }
 async logout(p:PlayerPrincipal){await this.database.transaction(null,true,async db=>{await db.query('DELETE FROM platform_player_sessions WHERE id=$1 AND player_id=$2',[p.sessionId,p.id]);});}
}
