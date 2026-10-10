import {describe,it,expect} from 'vitest';
import {resourceCatalog} from '../src/lib/workshop/catalog';
import {workshopEntries,type ResourceEntry} from '../src/lib/workshop/resources';
import {graphics} from '../src/lib/demo/pixelart';
import {mapImages} from '../src/lib/storage/local-adventures';
import {insertEntity} from '../src/lib/demo/editor';
import {parseScene,type VisualAsset} from '../packages/world/src/scene';

const entries:ResourceEntry[]=[
 {id:'custom.closed',kind:'object',name:'Taquilla verde',category:'office',image:'base.png',frame:[4,8,20,30],custom:true},
 {id:'custom.open',kind:'object',name:'Taquilla abierta',category:'urban',image:'open.png',custom:true},
 {id:'pixel.tree',kind:'object',name:'Árbol',category:'nature',image:'tree.png',custom:false},
 {id:'custom.npc',kind:'npc',name:'Guía',category:'people',image:'npc.png',custom:true},
 {id:'grass',kind:'tile',name:'Césped',image:'grass.png',custom:false},
 {id:'custom.flowers',kind:'tile',name:'Flores',image:'flowers.png',custom:true}
];
const families={'family.locker':{name:'Armarios metálicos',aspects:{'custom.closed':'Cerrada','custom.open':'Abierta'}}};
const ids=(result:ReturnType<typeof resourceCatalog>)=>[...result.groups.flatMap(g=>g.entries),...result.ungrouped].map(e=>e.id);
describe('shared adventure resource catalog',()=>{
 it('searches resource, family and aspect names regardless of accents, case and surrounding spaces',()=>{
  expect(ids(resourceCatalog(entries,{kind:'object',query:' METALICOS ',objectFamilies:families}))).toEqual(['custom.closed','custom.open']);
  expect(ids(resourceCatalog(entries,{kind:'object',query:'cerrada',objectFamilies:families}))).toEqual(['custom.closed']);
  expect(ids(resourceCatalog(entries,{kind:'object',query:'arbol',objectFamilies:families}))).toEqual(['pixel.tree']);
  expect(ids(resourceCatalog(entries,{kind:'npc',query:'GUIA'}))).toEqual(['custom.npc']);
 });
 it('combines category and family filters without duplicates or losing ungrouped resources',()=>{
  const all=resourceCatalog(entries,{kind:'object',objectFamilies:families});expect(all.count).toBe(3);expect(new Set(ids(all)).size).toBe(3);
  const office=resourceCatalog(entries,{kind:'object',category:'office',query:'metalicos',objectFamilies:families});expect(ids(office)).toEqual(['custom.closed']);expect(office.groups[0].name).toBe('Armarios metálicos');
  expect(resourceCatalog(entries,{kind:'object',category:'nature',query:'metalicos',objectFamilies:families})).toEqual({groups:[],ungrouped:[],count:0});
  expect(ids(resourceCatalog(entries,{kind:'object',category:'nature',objectFamilies:families}))).toEqual(['pixel.tree']);
 });
 it('preserves cropping, URLs and IDs while keeping NPCs out of object families',()=>{
  const snapshot=JSON.stringify(entries),result=resourceCatalog(entries,{kind:'object',objectFamilies:families});expect(result.groups[0].entries[0]).toMatchObject({id:'custom.closed',image:'base.png',frame:[4,8,20,30]});
  expect(ids(result)).not.toContain('custom.npc');expect(JSON.stringify(entries)).toBe(snapshot);
 });
 it('keeps texture families searchable when switching resource type with a category active',()=>{
  const result=resourceCatalog(entries,{kind:'tile',category:'office',query:'pradera',tileFamilies:{'family.grass':{name:'Pradera',tiles:{grass:80,'custom.flowers':20}}}});expect(ids(result)).toEqual(['grass','custom.flowers']);
 });
 it('reads the same family metadata from stored packs and resolved world graphics, then places a concrete aspect',()=>{
  const pack=structuredClone(graphics),catalog:VisualAsset[]=[{id:'custom.closed',kind:'object',label:'Taquilla verde',category:'office',size:{x:2,y:1}},{id:'custom.open',kind:'object',label:'Taquilla abierta',category:'urban',size:{x:2,y:1}}];
  pack.objects['custom.closed']=structuredClone(pack.objects['pixel.desk']);pack.objects['custom.open']=structuredClone(pack.objects['pixel.desk']);pack.objectFamilies=families;
  const stored=resourceCatalog(workshopEntries(pack,catalog),{kind:'object',query:'abierta',objectFamilies:pack.objectFamilies});
  const resolved=mapImages(pack,url=>'blob:'+url),world=resourceCatalog(workshopEntries(resolved,catalog),{kind:'object',query:'abierta',objectFamilies:resolved.objectFamilies});expect(ids(world)).toEqual(ids(stored));expect(ids(world)).toEqual(['custom.open']);
  const scene=parseScene({schemaVersion:1,id:'room',name:'Sala',theme:'office',width:8,height:8,spawn:{x:0,y:0},entities:[]}),placed=insertEntity(scene,'object','instance',ids(world)[0],{x:3,y:3},catalog);
  expect(placed.entities[0]).toMatchObject({visualId:'custom.open',kind:'object',size:{x:2,y:1}});expect(scene.entities).toEqual([]);
 });
 it('keeps category and renamed builtin metadata in the entries used by both editors',()=>{
  const pack=structuredClone(graphics),entry=workshopEntries(pack,[],{'pixel.sofa':{label:'Sofá azul',category:'urban'}}).find(e=>e.id==='pixel.sofa');
  expect(entry).toMatchObject({name:'Sofá azul',category:'urban'});expect(ids(resourceCatalog([entry!],{kind:'object',category:'office'}))).toEqual([]);expect(ids(resourceCatalog([entry!],{kind:'object',category:'urban',query:'sofa'}))).toEqual(['pixel.sofa']);
 });
});
