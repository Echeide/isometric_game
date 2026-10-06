import {describe,it,expect,beforeAll,afterAll,vi} from 'vitest';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {Database} from '../src/lib/server/platform/database';
import {Auth} from '../src/lib/server/platform/auth';
import {PlatformStore} from '../src/lib/server/platform/store';
import {defaultLimits,defaultPermissions,type Principal} from '../src/lib/platform/types';
import {graphics} from '../src/lib/demo/pixelart';
import {office} from '../src/lib/demo/scenes';
import {createAdventure} from '../src/lib/demo/adventure';
import {attachChat} from '../src/lib/chat/adventure-chats';
import {createChat,chatResource} from '../src/lib/chat/editor';
import {packResource,instantiateResource} from '../src/lib/workshop/shared-resource';
const url=process.env.PLATFORM_TEST_DATABASE_URL;
if(url&&!new URL(url).pathname.endsWith('_test'))throw Error('Use an isolated database ending in _test.');
describe.skipIf(!url)('platform integration with PostgreSQL RLS',()=>{
 let database:Database,auth:Auth,store:PlatformStore,folder:string,root:Principal,a:Principal,b:Principal,ta:string,tb:string,aid:string,bid:string,token:string;
 const password='fixture-password-123';
 // Fixture setup hashes several passwords; allow slower development/CI machines.
 beforeAll(async()=>{database=new Database(url!);await database.init();await database.pool.query('TRUNCATE platform_releases,platform_publications,platform_resources,platform_adventures,platform_assets,platform_usage,platform_audit,platform_sessions,platform_users,platform_tenants,platform_login_attempts CASCADE');folder=await mkdtemp(join(tmpdir(),'platform-test-'));auth=new Auth(database);store=new PlatformStore(database,folder,resolve('static/pixelart'));await auth.bootstrap('root-test',password);token=await auth.login('root-test',password,'test');root=(await auth.principal(token))!;ta=(await store.configure(root,{action:'tenant.create',name:'Espacio A'})).id!;tb=(await store.configure(root,{action:'tenant.create',name:'Espacio B'})).id!;aid=(await store.configure(root,{action:'user.create',username:'admin-a',password,tenantId:ta})).id!;bid=(await store.configure(root,{action:'user.create',username:'admin-b',password,tenantId:tb})).id!;a=(await auth.principal(await auth.login('admin-a',password,'a')))!;b=(await auth.principal(await auth.login('admin-b',password,'b')))!;},60000);
 afterAll(async()=>{await database?.pool.end();if(folder)await rm(folder,{recursive:true,force:true});});
 const adventure=(name='Privada A')=>({...createAdventure([structuredClone(office)]),id:'example',name});
 it('bootstraps once and stores only password and token hashes',async()=>{expect(await auth.bootstrap('other-root',password)).toBe(false);const rows=await database.pool.query('SELECT password_hash FROM platform_users');expect(rows.rows.every(r=>r.password_hash.startsWith('scrypt-v1:')&&!r.password_hash.includes(password))).toBe(true);expect((await database.pool.query('SELECT token_hash FROM platform_sessions')).rows.some(r=>r.token_hash===token)).toBe(false);});
 it('isolates identical adventure IDs across tenants, including raw RLS reads',async()=>{await store.save(a,adventure(),graphics,{},0);await store.save(b,adventure('Privada B'),graphics,{},0);expect((await store.list(a)).adventures.map(x=>x.name)).toEqual(['Privada A']);expect((await store.list(b)).adventures.map(x=>x.name)).toEqual(['Privada B']);const rows=await database.transaction(ta,false,async db=>(await db.query('SELECT tenant_id FROM platform_adventures')).rows);expect(rows.map(r=>r.tenant_id)).toEqual([ta]);expect(await database.transaction(null,false,async db=>(await db.query('SELECT * FROM platform_adventures')).rowCount)).toBe(0);});
 it('rejects lost updates instead of overwriting another editor',async()=>{await store.save(a,adventure('A editada'),undefined,{},1);await expect(store.save(a,adventure('A obsoleta'),undefined,{},1)).rejects.toMatchObject({status:409});expect((await store.adventure(a,'example')).definition.name).toBe('A editada');});
 it('reuses validated images for content-only saves but validates new uploads and object references',async()=>{
  const draft={...adventure(),id:'content-save'},pack=structuredClone(graphics),bytes=new Uint8Array(await readFile('static'+pack.objects['pixel.key'].image));
  pack.objects['pixel.key'].image='asset:content-key';
  await store.save(a,draft,pack,{'content-key':bytes},0);
  const reads=vi.spyOn(PlatformStore.prototype as any,'bytes');
  try{
   // No builtin files are available to this instance: metadata saves must not read them.
   const contentStore=new PlatformStore(database,folder,join(folder,'no-builtins'));
   await contentStore.save(a,{...draft,name:'Contenido actualizado'},undefined,{},1);
   expect(reads).not.toHaveBeenCalled();
   expect((await store.adventure(a,draft.id)).graphics).toEqual(pack);
   const invalid={...structuredClone(draft),catalog:[{id:'custom.missing',kind:'object' as const,label:'Objeto sin imagen',category:'office' as const,size:{x:1,y:1}}]};
   await expect(contentStore.save(a,invalid,undefined,{},2)).rejects.toThrow('Falta el objeto');
   await expect(store.save(a,draft,pack,{'content-key':new Uint8Array([1,2,3])},2)).rejects.toThrow();
   expect((await store.adventure(a,draft.id)).revision).toBe(2);
   await store.save(a,draft,pack,{},2);expect(reads).toHaveBeenCalled();
  }finally{reads.mockRestore();}
 });
 it('keeps drafts private and publications immutable until republished',async()=>{expect(await store.publicList()).toHaveLength(0);const published=await store.publish(a,'example',true);await store.save(a,adventure('Borrador secreto'),undefined,{},2);expect((await store.published(published.slug!)).adventure.name).toBe('A editada');expect((await store.publicList()).map(r=>r.name)).toEqual(['A editada']);await store.publish(a,'example',false);expect(await store.publicList()).toHaveLength(0);await expect(store.published(published.slug!)).rejects.toMatchObject({status:404});});
 it('reports saved map and player changes, clears the warning on republish and ignores a no-op save',async()=>{
  const draft={...adventure('Estado de publicación'),id:'publication-state'},pack=structuredClone(graphics);
  await store.save(a,draft,pack,{},0);const first=await store.publish(a,draft.id,true);
  const status=async()=> (await store.list(a)).publications.find(p=>p.adventure_id===draft.id)!;
  expect((await status()).hasUnpublishedChanges).toBe(false);
  await store.save(a,draft,undefined,{},1);expect((await status()).hasUnpublishedChanges).toBe(false);
  const edited=structuredClone(draft);edited.maps[0].name='Mapa modificado';await store.save(a,edited,undefined,{},2);
  expect((await status()).hasUnpublishedChanges).toBe(true);expect((await store.published(first.slug!)).adventure.maps[0].name).toBe(draft.maps[0].name);
  expect((await store.list(b)).publications.some(p=>p.adventure_id===draft.id)).toBe(false);
  const updated=await store.publish(a,draft.id,true);expect(updated.slug).toBe(first.slug);expect((await status()).hasUnpublishedChanges).toBe(false);
  pack.players={'custom.player':{name:'Jugador de prueba',character:structuredClone(pack.character)}};pack.activePlayer='custom.player';
  await store.save(a,edited,pack,{},3);expect((await status()).hasUnpublishedChanges).toBe(true);expect((await store.published(first.slug!)).graphics.activePlayer).toBeUndefined();
  await store.publish(a,draft.id,true);expect((await status()).hasUnpublishedChanges).toBe(false);
  await store.publish(a,draft.id,false);expect((await status()).active).toBe(false);expect((await status()).hasUnpublishedChanges).toBe(false);
 });
 it('saves tenant chat content and publishes independent conversation snapshots',async()=>{
  const base={...adventure(),id:'embedded-chat'},entity=base.maps[0].entities.find(e=>e.kind==='person')!;
  const chat={id:'welcome',name:'Bienvenida',config:createChat()};const first=attachChat(base,base.maps[0].id,entity.id,chat);
  await store.save(a,first,graphics,{},0);expect((await store.adventure(a,first.id)).definition.chats).toEqual([chat]);await expect(store.adventure(b,first.id)).rejects.toMatchObject({status:404});
  const publication=await store.publish(a,first.id,true),before=await store.published(publication.slug!);expect(before.adventure.chats).toEqual([chat]);expect(before.adventure.maps[0].entities.find((e:import('@isometrico/world').WorldEntity)=>e.id===entity.id)!.interaction!.resourceId).toBe(chatResource(chat.id));
  const changed=structuredClone(chat);changed.config.chatNodes[0].messages=['Conversación actualizada'];const second=attachChat(first,base.maps[0].id,entity.id,changed);await store.save(a,second,undefined,{},1);
  expect((await store.published(publication.slug!)).adventure.chats).toEqual([chat]);expect((await store.list(a)).publications.find(p=>p.adventure_id===first.id)!.hasUnpublishedChanges).toBe(true);
  await store.publish(a,first.id,true);expect((await store.published(publication.slug!)).adventure.chats).toEqual([changed]);expect((await store.list(a)).publications.find(p=>p.adventure_id===first.id)!.hasUnpublishedChanges).toBe(false);
 });
 it('persists object conditions in private drafts and independent published snapshots',async()=>{
  const draft={...adventure(),id:'story-rules'},map=draft.maps[0],entity=map.entities.find(e=>e.kind==='person')!;
  const definition={...draft,story:{version:1 as const,entities:[{mapId:map.id,entityId:entity.id,initialState:'closed',states:[{id:'closed',name:'Cerrado'},{id:'open',name:'Abierto',solid:false}],reactions:[{id:'open-after-chat',event:'module.completed' as const,moduleId:'chat',once:true,effects:[{kind:'state' as const,mapId:map.id,entityId:entity.id,stateId:'open'}]}]}]}};
  await store.save(a,definition,graphics,{},0);expect((await store.adventure(a,draft.id)).definition.story).toEqual(definition.story);await expect(store.adventure(b,draft.id)).rejects.toMatchObject({status:404});
  const publication=await store.publish(a,draft.id,true),changed=structuredClone(definition);changed.story.entities[0].initialState='open';await store.save(a,changed,undefined,{},1);
  expect((await store.published(publication.slug!)).adventure.story.entities[0].initialState).toBe('closed');expect((await store.list(a)).publications.find(p=>p.adventure_id===draft.id)!.hasUnpublishedChanges).toBe(true);
  await store.publish(a,draft.id,true);expect((await store.published(publication.slug!)).adventure.story.entities[0].initialState).toBe('open');
 });
 it('denies assets from another tenant and never serves unpublished originals',async()=>{const bytes=new Uint8Array(await readFile('static'+graphics.objects['pixel.key'].image));const pack=structuredClone(graphics);pack.objects['pixel.key'].image='asset:private-key';pack.objects['pixel.key'].originalImage='asset:private-original';pack.paletteOriginalImages={'asset:private-key':'asset:private-original'};await store.save(a,adventure(),pack,{'private-key':bytes,'private-original':bytes},3);expect(await store.asset(a,'private-key')).toEqual(bytes);await expect(store.asset(b,'private-key')).rejects.toMatchObject({status:404});const pub=await store.publish(a,'example',true);const game=await store.published(pub.slug!);expect(game.graphics.objects['pixel.key'].originalImage).toBeUndefined();expect(game.graphics.paletteOriginalImages).toBeUndefined();expect(game.graphics.objects['pixel.key'].image).toMatch(/\/private-key\.png$/);const path=game.graphics.objects['pixel.key'].image.split('/'),release=path[4];expect(await store.publicAsset(release,'private-key')).toEqual(bytes);await expect(store.publicAsset(release,'private-original')).rejects.toMatchObject({status:404});});
 it('keeps tenant resources private and promotes independent shared copies',async()=>{const bytes=await packResource({format:'isometric-resource',version:1,kind:'object',name:'Llave',category:'office',size:{x:1,y:1},object:graphics.objects['pixel.key']},async u=>new Blob([new Uint8Array(await readFile('static'+u))]));const r=await store.saveResource(a,bytes);expect(await store.resourceList(b)).toHaveLength(0);await expect(store.resource(b,r.id)).rejects.toMatchObject({status:404});await expect(store.promote(a,r.id)).rejects.toMatchObject({status:403});const shared=await store.promote(root,r.id);expect(shared.id).not.toBe(r.id);const copied=instantiateResource(await store.resource(b,shared.id));expect(copied.resource.name).toBe('Llave');await store.withdrawResource(root,shared.id);expect(await store.resourceList(b,'global')).toHaveLength(0);expect(await store.resource(a,r.id)).toEqual(bytes);expect(copied.resource.name).toBe('Llave');});
 it('enforces quota reservations atomically under concurrency',async()=>{await store.configure(root,{action:'tenant.update',id:ta,name:'Espacio A',enabled:true,limits:{...defaultLimits,images:2},permissions:defaultPermissions});const requests=await Promise.allSettled(Array.from({length:8},()=>store.reserve(a,'images')));expect(requests.filter(r=>r.status==='fulfilled')).toHaveLength(2);expect(requests.filter(r=>r.status==='rejected')).toHaveLength(6);await expect(store.reserve(a,'videos')).rejects.toMatchObject({status:403});});
 it('impersonates with effective restrictions, rotates tokens and records real actor',async()=>{const impersonation=await auth.impersonate(root,aid),acting=(await auth.principal(impersonation))!;expect(await auth.principal(token)).toBeNull();expect(acting.actor.id).toBe(root.actor.id);expect(acting.user.id).toBe(aid);expect(acting.tenant?.id).toBe(ta);await expect(store.administration(acting)).rejects.toMatchObject({status:403});await expect(store.reserve(acting,'images')).rejects.toMatchObject({status:429});await store.save(acting,adventure('Superadmin actuando'),undefined,{},4);const audit=(await database.pool.query("SELECT * FROM platform_audit WHERE action='adventure.save' ORDER BY id DESC LIMIT 1")).rows[0];expect(audit.actor_id).toBe(root.actor.id);expect(audit.effective_id).toBe(aid);token=await auth.impersonate(acting,null);root=(await auth.principal(token))!;expect(root.impersonating).toBe(false);});
 it('returns a superadmin to their own account if impersonated tenant is disabled',async()=>{const actingToken=await auth.impersonate(root,bid);await store.configure(root,{action:'tenant.update',id:tb,name:'Espacio B',enabled:false,limits:defaultLimits,permissions:defaultPermissions});const p=(await auth.principal(actingToken))!;expect(p.user.role).toBe('superadmin');expect(p.impersonating).toBe(false);expect(await auth.principal(await auth.login('admin-a',password,'a'))).not.toBeNull();await expect(auth.login('admin-b',password,'b')).rejects.toMatchObject({status:401});root=p;});
 it('revokes sessions after administrator password reset',async()=>{const before=await auth.login('admin-a',password,'a');await store.configure(root,{action:'user.password',id:aid,password:'changed-password-123'});expect(await auth.principal(before)).toBeNull();await expect(auth.login('admin-a',password,'a')).rejects.toMatchObject({status:401});expect(await auth.principal(await auth.login('admin-a','changed-password-123','a'))).not.toBeNull();});
});
