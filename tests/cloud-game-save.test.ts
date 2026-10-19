import {randomUUID} from 'node:crypto';
import {describe,it,expect,vi} from 'vitest';
import {createAdventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
import {newGameSave,type GameSave} from '../src/lib/storage/game-save';
import {cloudGameSaves,CloudSaveError,saveTransport,type SaveTransport,type CloudResult} from '../src/lib/storage/cloud-game-save';
import {playerReturnPath} from '../src/lib/player/types';
function memory(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
const adventure=createAdventure([office]),initial=newGameSave(adventure);
function network(){
 let state:CloudResult={save:null,revision:0,writeId:null},offline=false,lostReply=false;
 const transport:SaveTransport={
  read:vi.fn(async()=>{if(offline)throw new CloudSaveError('offline');return structuredClone(state);}),
  write:vi.fn(async value=>{if(offline)throw new CloudSaveError('offline');if(state.writeId===value.writeId)return structuredClone(state);if(value.revision!==state.revision)throw new CloudSaveError('other device','conflict');state={save:structuredClone(value.save),revision:state.revision+1,writeId:value.writeId};if(lostReply){lostReply=false;throw new CloudSaveError('reply lost');}return structuredClone(state);})
 };
 return {transport,get state(){return state;},set state(value){state=value;},set offline(value:boolean){offline=value;},set lostReply(value:boolean){lostReply=value;}};
}
function setup(storage=memory(),net=network(),key='player:alice:adventure'){
 const repo=cloudGameSaves({storage,key,adventure,transport:net.transport,uuid:randomUUID,delay:60000});return {repo,storage,net,key};
}
const moved=(x:number):GameSave=>({...structuredClone(initial),savedAt:'2026-10-19T10:00:00.000Z',position:{...initial.position,cell:{x,y:0}}});
describe('cloud save outbox',()=>{
 it('loads another device’s complete save before play and does not write when opening the menu',async()=>{const {repo,net}=setup();net.state={save:moved(3),revision:4,writeId:randomUUID()};expect(await repo.load()).toEqual(moved(3));expect(repo.status.state).toBe('synced');expect(net.transport.write).not.toHaveBeenCalled();repo.close();});
 it('uploads the newest checkpoint and coalesces intermediate updates',async()=>{const {repo,net}=setup();await repo.load();repo.write(moved(1));repo.write(moved(2));expect(await repo.flush()).toBe(true);expect(net.state.save).toEqual(moved(2));expect(net.transport.write).toHaveBeenCalledTimes(1);expect(await repo.flush()).toBe(true);repo.close();});
 it('serializes a checkpoint arriving while an earlier request is in flight',async()=>{
  const {repo,net}=setup();await repo.load();let release!:()=>void;const write=net.transport.write;
  net.transport.write=vi.fn(async value=>{await new Promise<void>(resolve=>release=resolve);return write(value);});
  repo.write(moved(1));const first=repo.flush();await Promise.resolve();repo.write(moved(2));net.transport.write=write;release();expect(await first).toBe(true);expect(net.state.revision).toBe(2);expect(net.state.save).toEqual(moved(2));repo.close();
 });
 it('keeps pending work over a reload without replacing it with the older remote save',async()=>{
  const {repo,storage,net,key}=setup();await repo.load();net.offline=true;repo.write(moved(4));expect(await repo.flush()).toBe(false);expect(repo.status.state).toBe('offline');repo.close();net.offline=false;
  const second=setup(storage,net,key).repo;expect(await second.load()).toEqual(moved(4));expect(net.state.save).toEqual(moved(4));expect(second.status.state).toBe('synced');second.close();
 });
 it('retries the exact same operation when a response is lost after the server commits',async()=>{
  const {repo,storage,net,key}=setup();await repo.load();net.lostReply=true;repo.write(moved(5));expect(await repo.flush()).toBe(false);expect(net.state.revision).toBe(1);const id=net.state.writeId;repo.close();
  const second=setup(storage,net,key).repo;await second.load();expect(net.state.revision).toBe(1);expect(net.state.writeId).toBe(id);expect(second.read()).toEqual(moved(5));second.close();
 });
 it('does not overwrite another device and keeps a local backup when the user loads the server copy',async()=>{
  const {repo,storage,net,key}=setup();await repo.load();net.state={save:moved(6),revision:1,writeId:randomUUID()};repo.write(moved(2));expect(await repo.flush()).toBe(false);expect(repo.blocked).toBe(true);expect(repo.status.state).toBe('conflict');expect(net.state.save).toEqual(moved(6));
  expect(await repo.useServer()).toEqual(moved(6));expect(JSON.parse(storage.getItem(key)!).backup).toEqual(moved(2));expect(repo.status.state).toBe('synced');repo.close();
 });
 it('retains changes and stops retries when authentication expires',async()=>{const {repo,net}=setup();await repo.load();net.transport.write=vi.fn(async()=>{throw new CloudSaveError('login','unauthorized');});repo.write(moved(2));expect(await repo.flush()).toBe(false);expect(repo.read()).toEqual(moved(2));expect(await repo.flush()).toBe(false);expect(net.transport.write).toHaveBeenCalledTimes(1);repo.close();});
 it('rejects play without a known revision if the initial server read fails',async()=>{const {repo,net}=setup();net.offline=true;await expect(repo.load()).rejects.toThrow();expect(repo.ready).toBe(false);repo.close();});
 it('keeps a previously loaded account save available offline',async()=>{const {repo,net}=setup();net.state={save:moved(3),revision:2,writeId:randomUUID()};await repo.load();net.offline=true;expect(await repo.load()).toEqual(moved(3));expect(repo.ready).toBe(true);expect(repo.status.state).toBe('offline');repo.close();});
 it('does not expose another player’s cached or pending save',async()=>{const {repo,storage,net}=setup();await repo.load();repo.write(moved(2));const bob=setup(storage,network(),'player:bob:adventure').repo;expect(bob.read()).toBeNull();expect(await bob.load()).toBeNull();repo.close();bob.close();});
 it('keeps memory unchanged if durable caching fails, and rejects late writes after closing',async()=>{const {repo,storage}=setup();await repo.load();vi.spyOn(storage,'setItem').mockImplementationOnce(()=>{throw Error('quota');});expect(()=>repo.write(moved(5))).toThrow('quota');expect(repo.read()).toBeNull();repo.close();expect(()=>repo.write(moved(2))).toThrow('ya no está activa');});
});
it('uses same-origin JSON requests and marks conflict and session errors',async()=>{
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({message:'changed',code:'conflict'}),{status:409}));const api=saveTransport('/api/game-saves?publication=one',fetcher as typeof fetch);
 await expect(api.write({save:initial,writeId:randomUUID(),revision:0},true)).rejects.toMatchObject({code:'conflict'});expect(fetcher).toHaveBeenCalledWith('/api/game-saves?publication=one',expect.objectContaining({method:'POST',keepalive:true,cache:'no-store'}));
 fetcher.mockResolvedValueOnce(new Response('{}',{status:401}));await expect(api.read()).rejects.toMatchObject({code:'unauthorized'});
});
it('aborts a stalled save request so pending work can be retried',async()=>{
 vi.useFakeTimers();try{const fetcher:typeof fetch=vi.fn((_url,options)=>new Promise<Response>((_resolve,reject)=>options!.signal!.addEventListener('abort',()=>reject(Error('aborted')))));const call=saveTransport('/api/game-saves',fetcher).read();const result=expect(call).rejects.toMatchObject({code:'offline'});await vi.advanceTimersByTimeAsync(15000);await result;}finally{vi.useRealTimers();}
});
it('restricts post-login returns to public adventures, previews and the catalogue',()=>{for(const value of ['//evil.example','https://evil.example','/\\evil.example','/admin','/player/login','/play/test#bad'])expect(playerReturnPath(value)).toBe('/');expect(playerReturnPath('/play/abc?lang=en')).toBe('/play/abc?lang=en');expect(playerReturnPath('/preview?adventure=one')).toBe('/preview?adventure=one');});
