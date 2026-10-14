import {describe,it,expect} from 'vitest';
import {parseScene} from '../packages/world/src/scene';
import {createAdventure,parseAdventure} from '../src/lib/demo/adventure';
import {storyBoard,objectNode,eventNode,mapNode,itemNode,boardPositions,filterBoard,boardDragPosition,boardEdgePan,boardWire} from '../src/lib/story/board';
import {publicAdventure,adventureChanged} from '../src/lib/server/platform/publication-state';
function fixture(){const map=parseScene({schemaVersion:1,id:'room',name:'Oficina',theme:'office',width:8,height:8,spawn:{x:0,y:0},entities:[{id:'one',label:'Armario',kind:'object',visualId:'pixel.bin',position:{x:2,y:2},size:{x:1,y:1},solid:false},{id:'two',label:'Otro armario',kind:'object',visualId:'pixel.bin',position:{x:4,y:2},size:{x:1,y:1},solid:false}]});const a=createAdventure([map,{...map,id:'other',name:'Jardín'}]);a.items=[{id:'key',name:'Llave',description:'',stackable:false}];a.story={version:1,entities:[{mapId:'room',entityId:'one',states:[{id:'open',name:'Abierto'}],initialState:'open',reactions:[],interaction:{mode:'all',conditions:[{kind:'event',eventId:'intro',status:'completed'}]}}],events:[{id:'intro',name:'Prólogo',trigger:'map.enter',mapId:'other',enabled:true,once:true,modules:[{id:'context',type:'context',title:'Inicio',text:'Bienvenido'}],effects:[{kind:'give',itemId:'key',quantity:1}]}]};return parseAdventure(a);}
describe('adventure story board',()=>{
 it('does not turn the first board-only layout into a public story change',()=>{const a=fixture();delete a.story;const moved={...a,story:{version:1 as const,entities:[],events:[],layout:{node:{x:32,y:64}}}};expect(adventureChanged(moved,a)).toBe(false);expect(publicAdventure(moved).story).toBeUndefined();});
 it('uses placed object identities across maps, preserving objects sharing a sprite',()=>{
  const a=fixture(),board=storyBoard(a);expect(new Set(board.nodes.map(n=>n.id)).size).toBe(board.nodes.length);expect(board.nodes.filter(n=>n.visualId==='pixel.bin')).toHaveLength(4);expect(board.nodes.find(n=>n.id===objectNode({mapId:'other',entityId:'one'}))?.selection).toEqual({kind:'object',ref:{mapId:'other',entityId:'one'}});
 });
 it('derives event triggers, requirements and rewards from the actual definitions',()=>{
  const board=storyBoard(fixture());expect(board.edges).toEqual(expect.arrayContaining([expect.objectContaining({source:eventNode('intro'),target:objectNode({mapId:'room',entityId:'one'}),kind:'requirement'}),expect.objectContaining({source:mapNode('other'),target:eventNode('intro'),kind:'travel'}),expect.objectContaining({source:eventNode('intro'),target:itemNode('key'),kind:'effect'})]));
 });
 it('connects adventure-start events to the actual initial map and keeps their inspector selectable',()=>{
  const a=fixture(),event=a.story!.events![0];event.trigger='adventure.start';delete event.mapId;
  const board=storyBoard(a),edge=board.edges.find(edge=>edge.source===eventNode(event.id)&&edge.kind==='travel');
  expect(edge).toMatchObject({source:eventNode(event.id),target:mapNode(a.startMap),label:'Al iniciar la aventura',owner:{kind:'event',eventId:event.id}});
  expect(board.edges.some(edge=>edge.target===eventNode(event.id)&&edge.label==='Al entrar en el mapa')).toBe(false);
  a.startMap='other';expect(storyBoard(a).edges.find(edge=>edge.source===eventNode(event.id)&&edge.kind==='travel')?.target).toBe(mapNode('other'));
 });
 it('keeps selected-map dependencies and lets the diagram filter by module or event title',()=>{
  const board=storyBoard(fixture()),room=filterBoard(board,'room','',false);expect(room.nodes.some(n=>n.id===eventNode('intro'))).toBe(true);expect(room.nodes.some(n=>n.id===objectNode({mapId:'other',entityId:'two'}))).toBe(false);expect(filterBoard(board,'','prologo').nodes.some(n=>n.id===eventNode('intro'))).toBe(true);
 });
 it('preserves saved positions, gives unique defaults and excludes layout from public changes',()=>{
  const a=fixture(),board=storyBoard(a),positions=boardPositions(board.nodes),before=JSON.stringify(a);expect(new Set(Object.values(positions).map(p=>JSON.stringify(p))).size).toBe(board.nodes.length);const id=board.nodes[0].id;expect(boardPositions(board.nodes,{[id]:{x:800,y:64}})[id]).toEqual({x:800,y:64});expect(JSON.stringify(a)).toBe(before);
  const moved=parseAdventure({...a,story:{...a.story!,layout:positions}});expect(publicAdventure(moved).story!.layout).toBeUndefined();expect(adventureChanged(moved,a)).toBe(false);moved.story!.events![0].name='Otro contexto';expect(adventureChanged(moved,a)).toBe(true);
  const negative=parseAdventure({...a,story:{...a.story!,layout:{[id]:{x:-640,y:-320}}}});expect(boardPositions(board.nodes,negative.story!.layout)[id]).toEqual({x:-640,y:-320});expect(adventureChanged(negative,a)).toBe(false);for(const invalid of [-1000001,1000001,Infinity,NaN])expect(()=>parseAdventure({...a,story:{...a.story!,layout:{x:{x:invalid,y:0}}}})).toThrow('Posición');
 });
});

describe('story board navigation',()=>{
 it('keeps a dragged card under the pointer as the view pans at different zoom levels',()=>{
  expect(boardDragPosition({x:40,y:40},{x:100,y:100},{x:80,y:60},{x:20,y:20},{x:60,y:100},.5)).toEqual({x:-80,y:-200});
  expect(boardDragPosition({x:0,y:0},{x:100,y:100},{x:84,y:116},{x:20,y:20},{x:20,y:20},1)).toEqual({x:-16,y:16});
 });
 it('pans outward at all edges and stops away from the edges or outside the viewport',()=>{
  const rect={left:100,top:100,right:900,bottom:600};
  expect(boardEdgePan({x:100,y:100},rect)).toEqual({x:480,y:480});
  expect(boardEdgePan({x:900,y:600},rect)).toEqual({x:-480,y:-480});
  expect(boardEdgePan({x:500,y:350},rect)).toEqual({x:0,y:0});
  expect(boardEdgePan({x:950,y:350},rect)).toEqual({x:0,y:0});
 });
});

describe('story board connections',()=>{
 it('reattaches to facing sides when a card moves around its source',()=>{
  const a={x:0,y:0};
  expect(boardWire(a,{x:400,y:0}).path).toMatch(/^M 224 71 C .*400 71$/);
  expect(boardWire(a,{x:-400,y:0}).path).toMatch(/^M 0 71 C .*-176 71$/);
  expect(boardWire(a,{x:0,y:300}).path).toMatch(/^M 112 142 C .*112 300$/);
  expect(boardWire(a,{x:0,y:-300}).path).toMatch(/^M 112 0 C .*112 -158$/);
 });
 it('uses the nearest facing sides for staggered rows and keeps its label on the curve',()=>{
  const line=boardWire({x:0,y:0},{x:173,y:249});
  expect(line.path).toMatch(/^M 224 71 C .*285 249$/);
  const coordinates=line.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(line.x).toBe((coordinates[0]+3*coordinates[2]+3*coordinates[4]+coordinates[6])/8);
  expect(line.y).toBe((coordinates[1]+3*coordinates[3]+3*coordinates[5]+coordinates[7])/8);
  const shifted=boardWire({x:-80,y:40},{x:93,y:289});
  expect(shifted.x).toBeCloseTo(line.x-80);expect(shifted.y).toBeCloseTo(line.y+40);
 });
 it('keeps self-relations outside the card with their label on the loop',()=>{
  const line=boardWire({x:0,y:0},{x:0,y:0},true);
  expect(line.path).toMatch(/^M 224 38 C .*224 104$/);
  expect(line.x).toBeGreaterThan(224);expect(Number.isFinite(line.y)).toBe(true);
 });
});
