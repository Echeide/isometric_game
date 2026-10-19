import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Database} from '../src/lib/server/platform/database';
import {Auth,hashToken} from '../src/lib/server/platform/auth';
import {PlayerAuth} from '../src/lib/server/platform/players';
import {GameSaves} from '../src/lib/server/platform/game-saves';
import {PlatformStore} from '../src/lib/server/platform/store';
import {newGameSave,type GameSave} from '../src/lib/storage/game-save';
import {createAdventure,type Adventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
import {graphics} from '../src/lib/demo/pixelart';
import type {Principal} from '../src/lib/platform/types';
import type {PlayerPrincipal} from '../src/lib/player/types';
const url=process.env.PLAYER_TEST_DATABASE_URL;
if(url&&!new URL(url).pathname.endsWith('_test'))throw Error('Use an isolated player test database ending in _test.');
describe.skipIf(!url)('player accounts and saved games with real PostgreSQL',()=>{
 let database:Database,players:PlayerAuth,saves:GameSaves,store:PlatformStore,folder:string,admin:Principal,a:PlayerPrincipal,b:PlayerPrincipal,adventure:Adventure,slug:string,release:string,token:string;
 const password='disposable-player-password-123';
 beforeAll(async()=>{
  database=new Database(url!);await database.init();await database.pool.query('TRUNCATE platform_tenants,platform_users,platform_players,platform_login_attempts CASCADE');
  const auth=new Auth(database);players=new PlayerAuth(database);saves=new GameSaves(database);folder=await mkdtemp(join(tmpdir(),'player-test-'));store=new PlatformStore(database,folder,resolve('static/pixelart'));
  await auth.bootstrap('root-player-test',password);const root=(await auth.principal(await auth.login('root-player-test',password,'root-test')))!;
  const tenant=(await store.configure(root,{action:'tenant.create',name:'Player test'})).id!;await store.configure(root,{action:'user.create',username:'author-player-test',password,tenantId:tenant});admin=(await auth.principal(await auth.login('author-player-test',password,'admin-test')))!;
  token=await players.register('alice-player',password,'register-a');a=(await players.principal(token))!;b=(await players.principal(await players.register('bob-player',password,'register-b')))!;
  adventure={...createAdventure([structuredClone(office)]),id:'player-fixture'};await store.save(admin,adventure,graphics,{},0);slug=(await store.publish(admin,adventure.id,true)).slug!;release=(await store.published(slug)).releaseId;
 },60000);
 afterAll(async()=>{await database?.pool.end();if(folder)await rm(folder,{recursive:true,force:true});});
 const context=()=>({publication:slug,release});
 const position=(x:number):GameSave=>({...newGameSave(adventure),position:{mapId:office.id,cell:{x,y:0},facing:'nw'}});
 it('stores only hashes, supports multiple devices and never creates administrative access',async()=>{
  const otherToken=await players.login('ALICE-PLAYER',password,'device-two'),other=(await players.principal(otherToken))!;expect(other.id).toBe(a.id);expect(other.sessionId).not.toBe(a.sessionId);
  expect(await new Auth(database).principal(token)).toBeNull();await expect(new Auth(database).login('alice-player',password,'admin-attempt')).rejects.toMatchObject({status:401});
  const credentials=(await database.pool.query('SELECT password_hash FROM platform_players')).rows;expect(credentials.every(r=>r.password_hash.startsWith('scrypt-v1:')&&!r.password_hash.includes(password))).toBe(true);expect((await database.pool.query('SELECT token_hash FROM platform_player_sessions')).rows.some(r=>r.token_hash===token)).toBe(false);
 });
 it('validates registration, rejects duplicate names and invalid or revoked sessions',async()=>{
  await expect(players.register('invalid user',password,'bad')).rejects.toMatchObject({status:400});await expect(players.register('short-password','short','short')).rejects.toMatchObject({status:400});await expect(players.register('alice-player',password,'duplicate')).rejects.toMatchObject({status:409});await expect(players.login('alice-player','wrong','wrong')).rejects.toMatchObject({status:401});
  const t=await players.login('alice-player',password,'temporary'),p=(await players.principal(t))!;await players.logout(p);expect(await players.principal(t)).toBeNull();expect(await players.principal('invalid')).toBeNull();
 });
 it('enforces login and registration limits before password hashing',async()=>{
  await database.pool.query("INSERT INTO platform_login_attempts(key,attempts,expires_at) VALUES($1,10,now()+interval '15 minutes'),($2,10,now()+interval '15 minutes')",[hashToken('player:account:blocked-player'),hashToken('player:register:address:blocked-register')]);
  await expect(players.login('blocked-player',password,'blocked-login')).rejects.toMatchObject({status:429});await expect(players.register('new-blocked',password,'blocked-register')).rejects.toMatchObject({status:429});
 });
 it('round-trips a complete save on another device and isolates other players',async()=>{
  const save=position(3);save.records['isometrico.inventory.v1:'+adventure.id]=JSON.stringify({counts:{key:2},collected:['pickup'],unlocked:['door']});const result=await saves.write(null,a,context(),{save,revision:0,writeId:randomUUID()});expect(result.revision).toBe(1);expect(result.save!.savedAt).toBeTruthy();
  const other=(await players.principal(await players.login('alice-player',password,'another-device')))!;expect((await saves.read(null,other,context())).save).toEqual(result.save);expect((await saves.read(null,b,context())).save).toBeNull();expect((await saves.read(admin,null,{adventure:adventure.id})).save).toBeNull();
 });
 it('rejects stale writes and lets only one simultaneous writer advance a revision',async()=>{
  const results=await Promise.allSettled([saves.write(null,a,context(),{save:position(4),revision:1,writeId:randomUUID()}),saves.write(null,a,context(),{save:position(5),revision:1,writeId:randomUUID()})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{status:409,code:'conflict'}});expect((await saves.read(null,a,context())).revision).toBe(2);
 });
 it('handles an ambiguous retry idempotently without replaying or replacing newer content',async()=>{
  const input={save:position(6),revision:2,writeId:randomUUID()},first=await saves.write(null,a,context(),input);expect(await saves.write(null,a,context(),input)).toEqual(first);expect(first.revision).toBe(3);
  await expect(saves.write(null,a,context(),{...input,save:position(7)})).rejects.toMatchObject({status:400});
 });
 it('requires authentication, validates the adventure and rejects unrelated records',async()=>{
  await expect(saves.read(null,null,context())).rejects.toMatchObject({status:401});await expect(saves.read(null,b,{adventure:adventure.id})).rejects.toMatchObject({status:401});await expect(saves.read(null,b,{publication:'missing'})).rejects.toMatchObject({status:404});
  await expect(saves.write(null,b,context(),{save:{...position(1),adventureId:'other'},revision:0,writeId:randomUUID()})).rejects.toMatchObject({status:400});
  const save=position(1);save.records['isometrico.story.v1:another']='private';await expect(saves.write(null,b,context(),{save,revision:0,writeId:randomUUID()})).rejects.toMatchObject({status:400});
  expect((await saves.read(null,b,context())).revision).toBe(0);
 });
 it('rejects requests from an old tab after another account signs in',async()=>{
  await expect(saves.write(null,b,{...context(),account:'player:'+a.id},{save:position(1),revision:0,writeId:randomUUID()})).rejects.toMatchObject({status:401,code:'unauthorized'});
  expect((await saves.read(null,b,context())).save).toBeNull();
 });
 it('keeps previews and public play separate even when both sessions are present',async()=>{
  const result=await saves.write(admin,b,{adventure:adventure.id},{save:position(2),revision:0,writeId:randomUUID()});expect((await saves.read(admin,null,{adventure:adventure.id})).save).toEqual(result.save);expect((await saves.read(null,b,context())).save).toBeNull();
  expect(await database.transaction(admin.tenant!.id,false,async db=>(await db.query('SELECT * FROM platform_game_saves')).rowCount)).toBe(0);
 });
 it('detects publication changes without losing a compatible saved game',async()=>{
  const old=release;await store.publish(admin,adventure.id,true);release=(await store.published(slug)).releaseId;expect(release).not.toBe(old);
  await expect(saves.read(null,a,{publication:slug,release:old})).rejects.toMatchObject({status:409,code:'content-changed'});expect((await saves.read(null,a,context())).revision).toBe(3);
 });
 it('makes saves unavailable when the publication is withdrawn and removes them with the adventure',async()=>{
  await store.publish(admin,adventure.id,false);await expect(saves.read(null,a,context())).rejects.toMatchObject({status:404});await store.publish(admin,adventure.id,true);await store.deleteAdventure(admin,adventure.id,1,'ELIMINAR');await expect(saves.read(admin,null,{adventure:adventure.id})).rejects.toMatchObject({status:404});
 });
});
