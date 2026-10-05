import {Pool,type PoolClient} from 'pg';
import schema from './schema.sql?raw';
export class Database {
 readonly pool:Pool;
 private ready:Promise<void>|undefined;
 constructor(url:string){this.pool=new Pool({connectionString:url,max:8});}
 init(){return this.ready??=this.migrate().catch(e=>{this.ready=undefined;throw e;});}
 private async migrate(){const db=await this.pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(762912)');const role=(await db.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];if(role.rolsuper||role.rolbypassrls)throw new Error('DATABASE_URL debe usar un rol sin SUPERUSER ni BYPASSRLS.');await db.query(schema);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 async transaction<T>(tenant:string|null,system:boolean,fn:(db:PoolClient)=>Promise<T>):Promise<T>{
  await this.init();const db=await this.pool.connect();
  try{await db.query('BEGIN');await db.query("SELECT set_config('platform.tenant',$1,true),set_config('platform.system',$2,true)",[tenant??'',system?'yes':'no']);const result=await fn(db);await db.query('COMMIT');return result;}
  catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
}
