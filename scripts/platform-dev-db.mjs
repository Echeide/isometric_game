// Local-only PostgreSQL cluster. No TCP listener; the socket directory is private to this OS user.
import {execFileSync} from 'node:child_process';import {mkdirSync,existsSync,chmodSync,readFileSync,writeFileSync} from 'node:fs';import {resolve,join} from 'node:path';
const root=resolve('.platform-data'),data=join(root,'postgres'),socket=join(root,'socket'),port='55440';
const executable=name=>{for(const prefix of ['/opt/homebrew/bin','/usr/local/bin','/usr/bin'])if(existsSync(join(prefix,name)))return join(prefix,name);throw Error('Instala PostgreSQL 16+ o configura DATABASE_URL con tu instancia.');};
const run=(name,args)=>execFileSync(executable(name),args,{stdio:['ignore','pipe','pipe'],encoding:'utf8'});
mkdirSync(socket,{recursive:true,mode:0o700});chmodSync(root,0o700);chmodSync(socket,0o700);
if(!existsSync(join(data,'PG_VERSION')))run('initdb',['-D',data,'-A','trust','--no-locale','-E','UTF8']);
let running=false;try{run('pg_ctl',['-D',data,'status']);running=true;}catch{}
if(!running)run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-k ${socket} -c listen_addresses='' -p ${port}`,'start']);
const args=['-h',socket,'-p',port,'-d','postgres','-tAc'];
if(!run('psql',[...args,"SELECT 1 FROM pg_roles WHERE rolname='isometric_app'"]).trim())run('psql',[...args,'CREATE ROLE isometric_app LOGIN NOSUPERUSER NOBYPASSRLS']);
if(!run('psql',[...args,"SELECT 1 FROM pg_database WHERE datname='isometric_platform'"]).trim())run('createdb',['-h',socket,'-p',port,'-O','isometric_app','isometric_platform']);
const url=`postgresql://isometric_app@localhost:${port}/isometric_platform?host=${encodeURIComponent(socket)}`,file=resolve('.env');let env=existsSync(file)?readFileSync(file,'utf8'):'';
if(/^DATABASE_URL=/m.test(env)){console.log('PostgreSQL local preparado. Se conserva DATABASE_URL existente.');}else{env+='\nDATABASE_URL='+url+'\nPLATFORM_STORAGE_DIR=.platform-storage\n';writeFileSync(file,env,{mode:0o600});chmodSync(file,0o600);console.log('PostgreSQL local preparado y DATABASE_URL añadido a .env.');}
