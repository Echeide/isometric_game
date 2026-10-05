import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Principal,Identity} from '../../platform/types';
import {Database} from './database';
export class PlatformError extends Error {constructor(public status:number,message:string){super(message);}}
export const hashToken=(value:string)=>createHash('sha256').update(value).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(e,key)=>e?reject(e):resolve(key)));
export async function hashPassword(password:string){if(typeof password!=='string'||password.length<10||password.length>256)throw new PlatformError(400,'La contraseña debe tener entre 10 y 256 caracteres.');const salt=randomBytes(16).toString('hex');return `scrypt-v1:${salt}:${(await derive(password,salt)).toString('hex')}`;}
export async function verifyPassword(password:string,stored:string){if(typeof password!=='string'||password.length>256)return false;const [version,salt,hash]=stored.split(':');if(version!=='scrypt-v1'||!salt||!hash)return false;const key=await derive(password,salt),expected=Buffer.from(hash,'hex');return expected.length===key.length&&timingSafeEqual(key,expected);}
export const identity=(row:Record<string,any>):Identity=>({id:row.id,username:row.username,role:row.role,tenantId:row.tenant_id});
export async function audit(db:PoolClient,p:Principal|null,action:string,target?:string,tenant?:string){await db.query('INSERT INTO platform_audit(actor_id,effective_id,tenant_id,action,target) VALUES($1,$2,$3,$4,$5)',[p?.actor.id??null,p?.user.id??null,tenant??p?.tenant?.id??null,action,target??null]);}
export class Auth {
 constructor(readonly database:Database){}
 async bootstrap(username:string,password:string){if(!/^[a-z0-9_.@-]{3,120}$/.test(username.trim().toLowerCase()))throw new PlatformError(400,'Usuario no válido.');const hashed=await hashPassword(password);return this.database.transaction(null,true,async db=>{await db.query("SELECT pg_advisory_xact_lock(762913)");if((await db.query('SELECT id FROM platform_users LIMIT 1')).rowCount)return false;await db.query("INSERT INTO platform_users(id,username,password_hash,role) VALUES($1,$2,$3,'superadmin')",[randomUUID(),username.toLowerCase().trim(),hashed]);await audit(db,null,'bootstrap');return true;});}
 async login(username:string,password:string,address:string){
  const name=typeof username==='string'?username.trim().toLowerCase():'';if(!/^[a-z0-9_.@-]{3,120}$/.test(name))throw new PlatformError(401,'Usuario o contraseña incorrectos.');
  // Both keys are reserved before hashing; concurrent attempts share the same limits.
  const allowed=await this.database.transaction(null,true,async db=>{for(const [key,max]of [[hashToken('account:'+name),10],[hashToken('address:'+address),50]] as const){const r=await db.query("INSERT INTO platform_login_attempts(key,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN platform_login_attempts.expires_at<now() THEN 1 ELSE platform_login_attempts.attempts+1 END,expires_at=CASE WHEN platform_login_attempts.expires_at<now() THEN now()+interval '15 minutes' ELSE platform_login_attempts.expires_at END RETURNING attempts",[key]);if(r.rows[0].attempts>max)return false;}return true;});
  if(!allowed)throw new PlatformError(429,'Demasiados intentos. Espera 15 minutos.');
  return this.database.transaction(null,true,async db=>{const row=(await db.query('SELECT u.*,t.enabled AS tenant_enabled FROM platform_users u LEFT JOIN platform_tenants t ON t.id=u.tenant_id WHERE username=$1',[name])).rows[0];const dummy='scrypt-v1:00000000000000000000000000000000:'+ '00'.repeat(64);const valid=await verifyPassword(password,row?.password_hash??dummy);if(!row||!valid||!row.enabled||row.tenant_enabled===false)throw new PlatformError(401,'Usuario o contraseña incorrectos.');
   await db.query('DELETE FROM platform_login_attempts WHERE key=$1',[hashToken('account:'+name)]);const token=randomBytes(32).toString('hex');await db.query("INSERT INTO platform_sessions(id,token_hash,actor_id,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[randomUUID(),hashToken(token),row.id]);await db.query('DELETE FROM platform_sessions WHERE expires_at<now()');await db.query("INSERT INTO platform_audit(actor_id,effective_id,tenant_id,action) VALUES($1,$1,$2,'login')",[row.id,row.tenant_id]);return token;});
 }
 async principal(token:string|undefined):Promise<Principal|null>{if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return this.database.transaction(null,true,async db=>{
  const s=(await db.query(`SELECT s.*,to_jsonb(a) AS actor,to_jsonb(u) AS effective,to_jsonb(t) AS tenant
   FROM platform_sessions s JOIN platform_users a ON a.id=s.actor_id AND a.enabled
   LEFT JOIN platform_users u ON u.id=s.effective_id AND u.enabled AND u.role='admin'
   LEFT JOIN platform_tenants t ON t.id=COALESCE(u.tenant_id,a.tenant_id)
   WHERE s.token_hash=$1 AND s.expires_at>now()`,[hashToken(token)])).rows[0];if(!s)return null;
  const a=s.actor;let u=s.effective_id?s.effective:a,t=s.tenant;
  if(s.effective_id&&a.role!=='superadmin')return null;
  if(s.effective_id&&(!u||!t?.enabled)){await db.query('UPDATE platform_sessions SET effective_id=NULL WHERE id=$1',[s.id]);await db.query("INSERT INTO platform_audit(actor_id,effective_id,action,target) VALUES($1,$2,'impersonation.expired',$2)",[a.id,s.effective_id]);s.effective_id=null;u=a;t=null;}
  if(u.tenant_id&&(!t||!t.enabled))return null;
  return {actor:identity(a),user:identity(u),tenant:t?{id:t.id,name:t.name,enabled:t.enabled,limits:t.limits,permissions:t.permissions}:null,impersonating:!!s.effective_id,sessionId:s.id};
 });}
 async logout(p:Principal){await this.database.transaction(null,true,async db=>{await audit(db,p,'logout');await db.query('DELETE FROM platform_sessions WHERE id=$1',[p.sessionId]);});}
 async impersonate(p:Principal,target:string|null){if(p.actor.role!=='superadmin'||(target&&p.impersonating))throw new PlatformError(403,'Acción exclusiva del superadmin.');return this.database.transaction(null,true,async db=>{
  if(target){const u=(await db.query("SELECT u.id FROM platform_users u JOIN platform_tenants t ON t.id=u.tenant_id WHERE u.id=$1 AND u.role='admin' AND u.enabled AND t.enabled",[target])).rows[0];if(!u)throw new PlatformError(404,'Administrador no disponible.');}
  const token=randomBytes(32).toString('hex');await db.query('UPDATE platform_sessions SET effective_id=$1,token_hash=$2 WHERE id=$3',[target,hashToken(token),p.sessionId]);await audit(db,p,target?'impersonation.start':'impersonation.stop',target??p.user.id);return token;
 });}
 async changePassword(p:Principal,current:string,next:string){if(p.impersonating)throw new PlatformError(403,'Vuelve a tu cuenta para cambiar tu contraseña.');const hashed=await hashPassword(next);await this.database.transaction(null,true,async db=>{const u=(await db.query('SELECT password_hash FROM platform_users WHERE id=$1',[p.actor.id])).rows[0];if(!await verifyPassword(current,u.password_hash))throw new PlatformError(400,'La contraseña actual no es correcta.');await db.query('UPDATE platform_users SET password_hash=$1 WHERE id=$2',[hashed,p.actor.id]);await db.query('DELETE FROM platform_sessions WHERE actor_id=$1 AND id<>$2',[p.actor.id,p.sessionId]);await audit(db,p,'password.change');});}
}
