import {expect,it} from 'vitest';
import {appendActivity,freshProgress,readProgress,resetProgress,writeProgress,milestones} from '../src/lib/demo/test-progress';
import {createAdventure} from '../src/lib/demo/adventure';
import {office,outdoors} from '../src/lib/demo/scenes';
import {chatProgressKey} from '../src/lib/chat/routingtales';
import {saveInventory,readInventory} from '../src/lib/demo/inventory';
function memory():Storage{const data=new Map<string,string>();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);},removeItem:k=>{data.delete(k);},clear:()=>data.clear()};}
const a={...createAdventure([office,outdoors]),id:'adventure-a'};
it('persists manual milestones and task changes separately for each adventure',()=>{
 const storage=memory(),p=freshProgress();p.tasks[0].status='done';p.completed=[milestones(a)[0].key];p.log=appendActivity([],'Hito completado');writeProgress(storage,a.id,p);
 expect(readProgress(storage,a)).toEqual(p);expect(readProgress(storage,{...a,id:'other'}).tasks[0].status).toBe('todo');
 p.completed=[];writeProgress(storage,a.id,p);expect(readProgress(storage,a).completed).toEqual([]);
});
it('resets only the current adventure, including chats for maps removed since they were played',()=>{
 const storage=memory(),ownChat=chatProgressKey(a.id,'deleted-map','person','chat'),otherChat=chatProgressKey(a.id+'-other','map','person','chat');
 storage.setItem(ownChat,'success');storage.setItem(otherChat,'success');storage.setItem('isometrico.adventures.v1','authored maps');
 saveInventory(storage,a.id,{counts:{key:2},collected:['pickup'],unlocked:['exit']});saveInventory(storage,'other',{counts:{key:1},collected:[],unlocked:[]});
 const p=freshProgress();p.tasks[0].status='done';p.completed=['goal'];writeProgress(storage,a.id,p);
 const reset=resetProgress(storage,a.id);
 expect(reset.completed).toEqual([]);expect(reset.tasks.every(t=>t.status==='todo')).toBe(true);expect(reset.log).toHaveLength(1);
 expect(readInventory(storage,a.id)).toEqual({counts:{},collected:[],unlocked:[]});expect(storage.getItem(ownChat)).toBeNull();expect(storage.getItem(otherChat)).toBe('success');
 expect(readInventory(storage,'other').counts.key).toBe(1);expect(storage.getItem('isometrico.adventures.v1')).toBe('authored maps');
});
it('preserves the prior state if a reset write fails',()=>{
 const storage=memory(),p=freshProgress();p.completed=['goal'];writeProgress(storage,a.id,p);
 const original=storage.setItem;let calls=0;storage.setItem=(k,v)=>{if(++calls===2)throw new Error('quota');original(k,v);};
 expect(()=>resetProgress(storage,a.id)).toThrow('quota');expect(JSON.parse(storage.getItem('isometrico.progress.v1:'+a.id)!).completed).toEqual(['goal']);
});
it('bounds the activity log and tolerates malformed saved progress',()=>{
 let log:ReturnType<typeof appendActivity>=[];for(let i=0;i<120;i++)log=appendActivity(log,String(i));expect(log).toHaveLength(100);expect(log[0].message).toBe('20');
 const storage=memory();storage.setItem('isometrico.progress.v1:'+a.id,'invalid json');expect(readProgress(storage,a)).toEqual(freshProgress());
});
