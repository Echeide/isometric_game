import {describe,it,expect,vi} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {createAdventure} from '../src/lib/demo/adventure';
import {freshProgress,writeProgress} from '../src/lib/demo/test-progress';
import {emptyInventory} from '../src/lib/demo/inventory';
import {saveStory} from '../src/lib/story/progress';
import {emptyStory,entityKey} from '../src/lib/story/types';
import {setObjectState} from '../src/lib/story/engine';
import {chatProgressKey} from '../src/lib/chat/routingtales';
import {scopedStorage} from '../src/lib/storage/scoped-storage';
import {createGameSession,localGameSaves,newGameSave,restoreGame,gameSaveKey,type PlayerPosition} from '../src/lib/storage/game-save';

function memory():Storage{const data=new Map<string,string>();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear()};}
function fixture(){
 const room=parseScene({schemaVersion:1,id:'room',name:'Sala',theme:'office',width:6,height:6,spawn:{x:0,y:0},entities:[{id:'door',label:'Puerta',kind:'object',visualId:'pixel.bin',position:{x:2,y:2}}]});
 const a=createAdventure([room,{...room,id:'garden',name:'Jardín',spawn:{x:1,y:0},entities:[]}]);a.id='save-test';
 a.items=[{id:'key',name:'Llave',description:'',stackable:true}];
 a.story={version:1,entities:[{mapId:'room',entityId:'door',states:[{id:'closed',name:'Cerrada',solid:true},{id:'open',name:'Abierta',solid:false}],initialState:'closed',reactions:[]}]};
 return a;
}
describe('player save repository',()=>{
 it('opens the menu without creating a save or changing legacy progress',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a);expect(repo.read()).toBeNull();expect(storage.length).toBe(0);
  const p=freshProgress();p.tasks[0].status='done';writeProgress(storage,a.id,p);
  storage.setItem(chatProgressKey(a.id,'removed-map','person','chat'),'success');storage.setItem(chatProgressKey('another','map','person','chat'),'keep');storage.setItem('authored-data','keep');
  const legacy=repo.read()!;expect(restoreGame(a,legacy).progress.tasks[0].status).toBe('done');expect(Object.keys(legacy.records)).toHaveLength(2);
  expect(legacy.savedAt).toBeUndefined();expect(storage.getItem(gameSaveKey(a.id))).toBeNull();expect(storage.getItem('authored-data')).toBe('keep');
 });
 it('stores position, orientation, story, inventory and module cursors in one write',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a),write=vi.spyOn(repo,'write');
  let position:PlayerPosition={mapId:'garden',cell:{x:4,y:3},facing:'nw'};
  const session=createGameSession(repo,newGameSave(a),()=>({position,narrativeQueue:['waiting-event']}),()=> '2026-10-19T12:00:00.000Z');
  const inventory={counts:{key:2},collected:['pickup'],unlocked:['exit']},story=setObjectState(a,emptyStory(),{mapId:'room',entityId:'door'},'open');
  session.transaction(()=>{saveStory(session.storage,a.id,story,inventory);session.storage.setItem(chatProgressKey(a.id,'room','door','chat'),'node-7');});
  expect(write).toHaveBeenCalledTimes(1);expect(storage.length).toBe(1);
  const save=repo.read()!,restored=restoreGame(a,save);expect(save.position).toEqual(position);expect(save.narrativeQueue).toEqual(['waiting-event']);expect(save.savedAt).toBe('2026-10-19T12:00:00.000Z');
  expect(restored.scene.id).toBe('garden');expect(restored.scene.spawn).toEqual({x:4,y:3});expect(restored.inventory).toEqual(inventory);expect(restored.story.states[entityKey({mapId:'room',entityId:'door'})]).toBe('open');expect(save.records[chatProgressKey(a.id,'room','door','chat')]).toBe('node-7');
  session.checkpoint();expect(write).toHaveBeenCalledTimes(1);
  position={...position,cell:{x:5,y:3}};session.checkpoint();expect(write).toHaveBeenCalledTimes(2);expect(repo.read()!.position.cell).toEqual({x:5,y:3});
 });
 it('rolls back memory and the previous whole save when persistence fails',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a),initial=newGameSave(a),session=createGameSession(repo,initial,()=>({position:initial.position,narrativeQueue:[]}));session.checkpoint();
  const before=storage.getItem(gameSaveKey(a.id));vi.spyOn(repo,'write').mockImplementationOnce(()=>{throw Error('quota');});
  expect(()=>session.transaction(()=>saveStory(session.storage,a.id,emptyStory(),{counts:{key:9},collected:[],unlocked:[]}))).toThrow('quota');
  expect(storage.getItem(gameSaveKey(a.id))).toBe(before);expect(session.storage.getItem('isometrico.inventory.v1:'+a.id)).toBeNull();
  expect(()=>session.transaction(()=>{session.storage.setItem(chatProgressKey(a.id,'room','door','chat'),'bad');throw Error('effect failed');})).toThrow('effect failed');
  expect(session.storage.getItem(chatProgressKey(a.id,'room','door','chat'))).toBeNull();expect(storage.getItem(gameSaveKey(a.id))).toBe(before);
 });
 it('replaces only this adventure on new game and never resurrects its old legacy records',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a);storage.setItem(chatProgressKey(a.id,'old-map','person','chat'),'success');
  const legacy=repo.read()!,session=createGameSession(repo,legacy,()=>({position:legacy.position,narrativeQueue:[]}));session.checkpoint();const prior=storage.getItem(gameSaveKey(a.id));
  const fresh=newGameSave(a),next=createGameSession(repo,fresh,()=>({position:fresh.position,narrativeQueue:[]}));expect(storage.getItem(gameSaveKey(a.id))).toBe(prior);
  next.checkpoint();expect(restoreGame(a,repo.read()!).inventory).toEqual(emptyInventory());expect(Object.keys(repo.read()!.records)).not.toContain(chatProgressKey(a.id,'old-map','person','chat'));
  expect(storage.getItem(chatProgressKey(a.id,'old-map','person','chat'))).toBe('success');
 });
 it('isolates public play, editor previews and different accounts',()=>{
  const a=fixture(),storage=memory(),preview=scopedStorage(()=>storage,()=> 'preview:alice'),publicPlay=scopedStorage(()=>storage,()=> 'public:adventure');
  const save=newGameSave(a);localGameSaves(preview,a).write(save);
  expect(localGameSaves(publicPlay,a).read()).toBeNull();expect(localGameSaves(scopedStorage(()=>storage,()=> 'preview:bob'),a).read()).toBeNull();
  expect(localGameSaves(preview,{...a,id:'another'}).read()).toBeNull();
 });
 it('prevents a late module callback from overwriting a newer playthrough',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a),save=newGameSave(a),first=createGameSession(repo,save,()=>({position:save.position,narrativeQueue:[]}));first.checkpoint();first.close();
  const next=newGameSave(a,'garden'),second=createGameSession(repo,next,()=>({position:next.position,narrativeQueue:[]}));second.checkpoint();
  expect(()=>first.storage.setItem(chatProgressKey(a.id,'room','door','chat'),'late')).toThrow('ya no está activa');expect(repo.read()!.position.mapId).toBe('garden');
 });
 it('rejects corrupt or unsupported saves without falling back to obsolete progress',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a);writeProgress(storage,a.id,freshProgress());
  for(const value of ['bad',JSON.stringify({...newGameSave(a),version:99}),JSON.stringify({...newGameSave(a),adventureId:'another'})]){storage.setItem(gameSaveKey(a.id),value);expect(repo.read()).toBeNull();expect(storage.getItem(gameSaveKey(a.id))).toBe(value);}
 });
});
describe('restoring a changed adventure',()=>{
 it('keeps a valid saved cell, including cells made walkable by restored story state',()=>{
  const a=fixture(),save=newGameSave(a);save.position={mapId:'room',cell:{x:2,y:2},facing:'sw'};
  save.records['isometrico.story.v1:'+a.id]=JSON.stringify(setObjectState(a,emptyStory(),{mapId:'room',entityId:'door'},'open'));
  const resumed=restoreGame(a,save);expect(resumed.position).toEqual(save.position);expect(resumed.adjusted).toBe(false);
 });
 it('moves a blocked or removed tile to the current map entry, preserving progress',()=>{
  const a=fixture(),save=newGameSave(a);save.records['isometrico.inventory.v1:'+a.id]=JSON.stringify({counts:{key:3},collected:[],unlocked:[]});
  for(const cell of [{x:2,y:2},{x:19,y:2},{x:-1,y:0}]){save.position={mapId:'room',cell,facing:'ne'};const resumed=restoreGame(a,save);expect(resumed.position.cell).toEqual({x:0,y:0});expect(resumed.position.facing).toBe('ne');expect(resumed.adjusted).toBe(true);expect(resumed.inventory.counts.key).toBe(3);}
 });
 it('uses the start map when a saved map disappeared and supports explicit preview entries for new games',()=>{
  const a=fixture(),save=newGameSave(a,'garden');expect(save.position.mapId).toBe('garden');save.position.mapId='removed';
  const resumed=restoreGame(a,save);expect(resumed.position.mapId).toBe(a.startMap);expect(resumed.position.cell).toEqual(a.maps[0].spawn);expect(resumed.adjusted).toBe(true);
 });
 it('recovers malformed coordinates at the saved map entry rather than using another map coordinates',()=>{
  const a=fixture(),storage=memory(),repo=localGameSaves(storage,a),save=newGameSave(a,'garden');
  storage.setItem(gameSaveKey(a.id),JSON.stringify({...save,position:{...save.position,cell:{x:1.5,y:1},facing:'invalid'}}));
  const resumed=restoreGame(a,repo.read()!);expect(resumed.position).toEqual({mapId:'garden',cell:{x:1,y:0},facing:'se'});expect(resumed.adjusted).toBe(true);
 });
});
