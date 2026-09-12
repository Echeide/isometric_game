import {expect,it} from 'vitest';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {withInventoryExample} from '../src/lib/demo/adventure-library';
import {office,outdoors} from '../src/lib/demo/scenes';
import {collectItem,useExit,emptyInventory,readInventory,saveInventory} from '../src/lib/demo/inventory';
const example=()=>withInventoryExample(createAdventure([office,outdoors]));
it('requires the key, collects only once and persists unlocked exit across reloads',()=>{
 const a=example(),exit=a.exits.find(e=>e.fromMap==='checkpoint')!;
 expect(()=>useExit(a,emptyInventory(),exit.id)).toThrow('Necesitas');
 const p=collectItem(a,emptyInventory(),'checkpoint','north-route-key-pickup');
 expect(collectItem(a,p,'checkpoint','north-route-key-pickup')).toEqual(p);
 const unlocked=useExit(a,p,exit.id);expect(unlocked.counts['north-route-key']).toBe(1);
 const storage=new Map<string,string>(),io={getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);}};
 saveInventory(io,a.id,unlocked);expect(readInventory(io,a.id)).toEqual(unlocked);expect(readInventory(io,'other')).toEqual(emptyInventory());
 expect(withInventoryExample(a)).toEqual(a);
});
it('consumes once and keeps the door unlocked; validates article references',()=>{
 const a=example(),exit=a.exits[0];exit.requirement!.consume=true;
 const p=collectItem(a,emptyInventory(),'checkpoint','north-route-key-pickup'),next=useExit(a,p,exit.id);
 expect(next.counts['north-route-key']).toBe(0);expect(useExit(a,next,exit.id)).toEqual(next);
 exit.requirement!.itemId='missing';expect(()=>parseAdventure(a)).toThrow('inventario');
});
