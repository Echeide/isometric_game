import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseScene,visualCatalog,resolveVisualCatalog,validateCatalogOverrides,type VisualCatalogOverrides,type VisualAsset} from '../packages/world/src/scene';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {insertEntity} from '../src/lib/demo/editor';
import {graphics} from '../src/lib/demo/pixelart';
import {workshopEntries} from '../src/lib/workshop/resources';
import {exportAdventure,unpackAdventure} from '../src/lib/storage/adventure-package';
import {mapImages} from '../src/lib/storage/local-adventures';

const empty=parseScene({schemaVersion:1,id:'test',name:'Prueba',theme:'office',width:10,height:10,spawn:{x:0,y:0},entities:[]});
const overrides:VisualCatalogOverrides={'pixel.desk':{label:'Mesa de recepción',category:'urban'}};

it('resolves name and category per adventure without changing the base catalogue or other adventures',()=>{
 const before=JSON.stringify(visualCatalog),custom:VisualAsset={id:'custom.bench',kind:'object',label:'Banco propio',category:'nature',size:{x:2,y:1}};
 const first=resolveVisualCatalog([custom],overrides),second=resolveVisualCatalog();
 expect(first.find(a=>a.id==='pixel.desk')).toMatchObject({label:'Mesa de recepción',category:'urban',kind:'desk',size:{x:2,y:1}});
 expect(second.find(a=>a.id==='pixel.desk')).toMatchObject({label:'Escritorio · Pixel',category:'office'});
 expect(first.filter(a=>a.category==='urban').some(a=>a.id==='pixel.desk')).toBe(true);
 expect(first.filter(a=>a.category==='office').some(a=>a.id==='pixel.desk')).toBe(false);
 first[0].size.x=9;first.find(a=>a.id===custom.id)!.size.x=3;
 expect(JSON.stringify(visualCatalog)).toBe(before);expect(custom.size.x).toBe(2);
});
it('uses the new catalogue label for new instances, preserving placed names and resource identity',()=>{
 const placed=insertEntity(empty,'desk','first','pixel.desk',{x:2,y:2});placed.entities[0].label='Puesto de Lucía';
 const adventure=parseAdventure({...createAdventure([placed]),catalogOverrides:overrides});
 const next=insertEntity(adventure.maps[0],'desk','second','pixel.desk',{x:5,y:5},resolveVisualCatalog(adventure.catalog,adventure.catalogOverrides));
 expect(next.entities.map(e=>e.label)).toEqual(['Puesto de Lucía','Mesa de recepción']);
 expect(next.entities.map(e=>e.visualId)).toEqual(['pixel.desk','pixel.desk']);
 expect(next.entities[1]).toMatchObject({kind:'desk',size:{x:2,y:1}});
 expect(parseAdventure({...adventure,maps:[next]}).catalogOverrides).toEqual(overrides);
});
it('shows overridden names exactly in the workshop, including existing NPCs',()=>{
 const labels:VisualCatalogOverrides={...overrides,'pixel.person-lucia':{label:'Guía · Pixel'},'pixel.tree':{category:'urban'}};
 const entries=workshopEntries(graphics,[],labels);
 expect(entries.find(e=>e.id==='pixel.desk')?.name).toBe('Mesa de recepción');
 expect(entries.find(e=>e.id==='pixel.person-lucia')).toMatchObject({name:'Guía · Pixel',kind:'npc'});
 expect(entries.find(e=>e.id==='pixel.tree')?.name).toBe('Árbol · Roble');
 expect(entries.filter(e=>e.id==='pixel.desk')).toHaveLength(1);
});
it('accepts partial and reactive overrides but rejects invalid names, categories, IDs and geometry changes',()=>{
 expect(validateCatalogOverrides(new Proxy(overrides,{}))).toEqual(overrides);
 expect(validateCatalogOverrides(undefined)).toEqual({});
 for(const value of [null,[],{'pixel.missing':{label:'Uno'}},{'custom.foo':{label:'Uno'}},{'pixel.desk':{label:' '}},{'pixel.desk':{label:'x'.repeat(121)}},{'pixel.desk':{category:'invalid'}},{'pixel.desk':{kind:'tree'}},{'pixel.desk':{size:{x:5,y:5}}}]){
  expect(()=>parseAdventure({...createAdventure([empty]),catalogOverrides:value})).toThrow('catálogo base');
 }
});
it('exports and imports the adventure metadata together with unchanged base sprite identities',async()=>{
 const adventure=parseAdventure({...createAdventure([empty]),catalogOverrides:overrides});
 const pack=mapImages(graphics,url=>'asset:'+url);
 const blob=await exportAdventure(adventure,{pack:async()=>pack,blob:async id=>new Blob([readFileSync('static'+id)])});
 const restored=unpackAdventure(new Uint8Array(await blob.arrayBuffer()));
 expect(restored.adventure.catalogOverrides).toEqual(overrides);
 expect(workshopEntries(restored.pack,restored.adventure.catalog,restored.adventure.catalogOverrides).find(e=>e.id==='pixel.desk')?.name).toBe('Mesa de recepción');
 expect(Object.keys(restored.pack.objects)).toEqual(Object.keys(graphics.objects));
 expect(createAdventure([empty]).catalogOverrides).toBeUndefined();
});
