import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {railingPiece,railingRole,railingFrame,railingAnchor,validateRailingFamilies,validateSceneRailings} from '../packages/world/src/railing-families';
import {parseScene} from '../packages/world/src/scene';
import {canCross,wallBodyHeight} from '../packages/world/src/walls';
import {railingGroup} from '../packages/world/src/railing-art';
import type {Wall,WorldScene} from '../packages/world/src/types';
import {createRailingTemplate,extractRailingPiece,replaceRailingPiece,appendRailingVariant} from '../src/lib/workshop/railing-template';
import {encodePalettePNG} from '../src/lib/workshop/palette-browser';
import {graphics} from '../src/lib/demo/pixelart';
import {createAdventure} from '../src/lib/demo/adventure';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';
import {exportAdventure,unpackAdventure,validateCatalogGraphics} from '../src/lib/storage/adventure-package';
import {packResource,unpackResource,addSharedResource,resourcePreview,type SharedResource} from '../src/lib/workshop/shared-resource';
import {publicGraphics} from '../src/lib/server/platform/publication-state';
import {workshopEntries,resourceUsages} from '../src/lib/workshop/resources';
const scene:WorldScene={schemaVersion:1,id:'rails',name:'Terraza',theme:'outdoors',width:8,height:8,spawn:{x:0,y:0},entities:[]};
const wall:Wall={x:2,y:1,axis:'x',kind:'railing',railingFamily:'custom.rail'};
const prepared=()=>{const result=createRailingTemplate('stone');result.family.image='asset:rail';return result;};
it('selects isolated, start, middle, end and corner pieces based on compatible neighbors',()=>{
 const prev={...wall,x:1},next={...wall,x:3},corner={...wall,axis:'y' as const};
 expect(railingRole(scene,wall,[wall])).toBe('single');expect(railingRole(scene,wall,[wall,next])).toBe('start');expect(railingRole(scene,wall,[prev,wall,next])).toBe('middle');expect(railingRole(scene,wall,[prev,wall])).toBe('end');expect(railingRole(scene,wall,[wall,corner,next])).toBe('cornerStart');expect(railingRole(scene,wall,[prev,wall,{...corner,x:3}])).toBe('cornerEnd');
 expect(railingRole(scene,wall,[wall,{...next,railingFamily:'custom.other'}])).toBe('single');expect(railingRole({...scene,elevations:{'3,1':1}},wall,[wall,next])).toBe('single');
});
it('keeps weighted variation deterministic despite sheet order and supports an explicit piece',()=>{
 const {family}=prepared();family.pieces.push({id:'b',label:'B',role:'middle',weight:200},{id:'c',label:'C',role:'middle',weight:50});
 const run=Array.from({length:7},(_,x)=>({...wall,x}));const first=run.slice(1,-1).map(w=>railingPiece(scene,w,run,family).id);expect(run.slice(1,-1).map(w=>railingPiece(scene,w,[...run].reverse(),{...family,pieces:[...family.pieces].reverse()}).id)).toEqual(first);
 expect(railingPiece(scene,{...wall,railingVariant:'c'},run,family).id).toBe('c');expect(()=>railingPiece(scene,{...wall,railingVariant:'missing'},run,family)).toThrow();
});
it('generates two transparent orientations, preserves fixed pivots and replaces one piece only',()=>{
 for(const style of ['stone','metal'] as const){const {family,pixels}=createRailingTemplate(style);expect(pixels.width).toBe(384);expect(pixels.height).toBe(128);for(const p of family.pieces)for(const axis of ['x','y'] as const){const frame=extractRailingPiece(pixels,family.pieces.indexOf(p),axis);const alpha=frame.data.filter((_,i)=>i%4===3);expect(alpha.some(a=>a===255)).toBe(true);expect(alpha.some(a=>a===0)).toBe(true);expect(railingFrame(family,p,axis)[1]).toBe(axis==='x'?0:64);}}
 const {pixels}=prepared(),edited=extractRailingPiece(pixels,2,'y');edited.data[0]=133;const replaced=replaceRailingPiece(pixels,2,'y',edited);expect(extractRailingPiece(replaced,2,'y').data[0]).toBe(133);for(const col of [0,1,3,4,5])expect(extractRailingPiece(replaced,col,'y')).toEqual(extractRailingPiece(pixels,col,'y'));expect(extractRailingPiece(replaced,2,'x')).toEqual(extractRailingPiece(pixels,2,'x'));expect(pixels.data).not.toBe(replaced.data);
 const added=appendRailingVariant(pixels,0);expect(added.width).toBe(448);for(const axis of ['x','y'] as const)expect(extractRailingPiece(added,6,axis)).toEqual(extractRailingPiece(pixels,0,axis));expect(railingAnchor('x')).toEqual([16,42]);expect(railingAnchor('y')).toEqual([48,42]);expect(()=>replaceRailingPiece(pixels,0,'x',{...edited,width:63})).toThrow();
});
it('validates atlas bounds, names, roles, weights and scene references',()=>{
 const {family}=prepared(),sizes=new Map([['asset:rail',{width:384,height:128}]]);expect(()=>validateRailingFamilies({'custom.rail':family},sizes)).not.toThrow();
 for(const value of [{...family,image:'missing'},{...family,pieces:family.pieces.slice(1)},{...family,pieces:family.pieces.map(p=>({...p,weight:0}))},{...family,pieces:family.pieces.map(p=>({...p,id:'repeat'}))},{...family,originalImage:'missing'}])expect(()=>validateRailingFamilies({'custom.rail':value},sizes)).toThrow();
 expect(()=>validateRailingFamilies({'custom.rail':family},new Map([['asset:rail',{width:383,height:128}]]))).toThrow();expect(()=>validateSceneRailings({...scene,walls:[wall]},{})).toThrow();expect(()=>parseScene({...scene,walls:[{...wall,kind:'wall'}]})).toThrow();expect(()=>parseScene({...scene,walls:[{...wall,railingFamily:undefined,railingVariant:'middle'}]})).toThrow();
});
it('retains half-height collision and separates custom/native fading groups',()=>{
 const next={...wall,x:3};expect(wallBodyHeight(wall)).toBe(31);expect(canCross({...scene,walls:[wall]},{x:2,y:0},{x:2,y:1})).toBe(false);expect(railingGroup(scene,wall,[wall,next])).toBe(railingGroup(scene,next,[wall,next]));expect(railingGroup(scene,{...next,railingFamily:undefined},[wall,{...next,railingFamily:undefined}])).not.toBe(railingGroup(scene,wall,[wall,next]));
});
it('round trips custom rails through adventure ZIP, public cartridge and shared library',async()=>{
 const {family,pixels}=prepared(),blob=new Blob([new Uint8Array(encodePalettePNG(pixels))],{type:'image/png'}),pack=mapImages({...graphics,railingFamilies:{'custom.rail':family}},url=>url.startsWith('asset:')?url:'asset:'+url),adventure=createAdventure([{...scene,walls:[wall]}]);
 const read=async(id:string)=>id==='rail'?blob:new Blob([new Uint8Array(await readFile('static'+id))]);const zip=await exportAdventure(adventure,{pack:async()=>pack,blob:read}),unpacked=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));expect(unpacked.adventure.maps[0].walls?.[0].railingFamily).toBe('custom.rail');expect(unpacked.pack.railingFamilies?.['custom.rail'].pieces).toEqual(family.pieces);expect(imageUrls(pack)).toContain('asset:rail');expect(()=>validateCatalogGraphics(adventure,{...pack,railingFamilies:{}})).toThrow();
 const publicPack=publicGraphics({...pack,railingFamilies:{'custom.rail':{...family,originalImage:family.image}}});expect(publicPack.railingFamilies?.['custom.rail'].originalImage).toBeUndefined();expect(publicPack.railingFamilies?.['custom.rail'].pieces.map(p=>p.role)).toEqual(family.pieces.map(p=>p.role));
 const resource:SharedResource={format:'isometric-resource',version:1,kind:'railing',name:family.name,category:'urban',size:{x:1,y:1},railing:family};const bytes=await packResource(resource,async()=>blob),copy=unpackResource(bytes).resource,added=addSharedResource(graphics,[],copy,{id:'source',version:1});expect(added.pack.railingFamilies?.[added.id].pieces).toEqual(family.pieces);expect(resourcePreview(copy).frame).toEqual([0,0,64,64]);const entry=workshopEntries(pack).find(e=>e.kind==='railing')!;expect(resourceUsages(adventure.maps,entry)).toEqual(['Terraza']);
});
