import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {graphics} from '../src/lib/demo/pixelart';
import {office} from '../src/lib/demo/scenes';
import {createAdventure} from '../src/lib/demo/adventure';
import {editorRevision,validateEditorLoaded,validateEditedImage,withEditedImage,playerEditClip,extractAnimationStrip,replaceAnimationStrip,cycleActions,cycleDirections,validateCycleSelection} from '../src/lib/workshop/image-edit';
import {mapResourceImages} from '../src/lib/workshop/palette';
import {emptyFrame} from '../packages/character-generator/src/pipeline';
import {validateGraphics} from '../packages/world/src/graphics-validation';
import {exportAdventure,unpackAdventure,pngSize} from '../src/lib/storage/adventure-package';
import {mapImages,imageUrls} from '../src/lib/storage/local-adventures';

const key=readFileSync('static'+graphics.objects['pixel.key'].image);
const size=pngSize(key);
const sizes=new Map(imageUrls(graphics).map(url=>[url,pngSize(readFileSync('static'+url))]));

it('accepts an edited PNG only at the original resolution',async()=>{
 await expect(validateEditedImage(new Blob([key]),size)).resolves.toEqual(size);
 await expect(validateEditedImage(new Blob([key]),{...size,width:size.width+1})).rejects.toThrow('tamaño');
 await expect(validateEditedImage(new Blob(['not a png']),size)).rejects.toThrow('PNG');
 await expect(validateEditedImage(new Blob([new Uint8Array(10_000_001)]),size)).rejects.toThrow('10 MB');
});

it('preserves crop, world size, pivot and optional NPC clips across repeated edits',()=>{
 const original={...graphics.objects['pixel.key'],frame:[8,4,24,16] as [number,number,number,number],width:48,height:32,origin:[11,23] as [number,number],animations:{idle:{image:'asset:idle',frameWidth:24,frameHeight:16,row:0,frames:3,fps:4}}};
 const before=structuredClone(original),first=withEditedImage(original,'asset:edit1'),second=withEditedImage(first,'asset:edit2');
 expect(second).toEqual({...original,image:'asset:edit2',originalImage:original.image});
 expect(original).toEqual(before);expect(first.image).toBe('asset:edit1');
});

it('validates original image references and rejects mismatched dimensions and orphan floors',()=>{
 const pack=structuredClone(graphics);
 pack.objects['pixel.key'].originalImage='asset:missing';
 expect(()=>validateGraphics(pack,sizes)).toThrow('Falta una imagen');
 pack.objects['pixel.key'].originalImage=graphics.objects['pixel.desk'].image;
 expect(()=>validateGraphics(pack,sizes)).toThrow('mismas dimensiones');
 delete pack.objects['pixel.key'].originalImage;
 pack.tileOriginalImages={'custom.missing':graphics.tiles.office};
 expect(()=>validateGraphics(pack,sizes)).toThrow('suelo que no existe');
 pack.tileOriginalImages={office:graphics.objects['pixel.desk'].image};
 expect(()=>validateGraphics(pack,sizes)).toThrow('mismas dimensiones');
});

it('carries edited pixels AND restorable originals through adventure ZIP export/import',async()=>{
 const source=structuredClone(graphics),originalFloor=source.tiles.office;
 source.objects['pixel.key']=withEditedImage(source.objects['pixel.key'],graphics.tiles.grass);
 source.tiles.office=graphics.tiles.path;
 source.tileOriginalImages={office:originalFloor};
 const snapshot=JSON.stringify(source),portable=mapImages(source,url=>'asset:'+url);
 expect(imageUrls(portable)).toContain('asset:'+source.objects['pixel.key'].originalImage);
 const zip=await exportAdventure(createAdventure([office]),{
  pack:async()=>portable,blob:async id=>new Blob([readFileSync('static'+id)])
 });
 const restored=unpackAdventure(new Uint8Array(await zip.arrayBuffer()));
 const bytes=async(url:string)=>new Uint8Array(await restored.blobs[url.slice(6)].arrayBuffer());
 const object=restored.pack.objects['pixel.key'];
 expect(await bytes(object.image)).toEqual(new Uint8Array(readFileSync('static'+graphics.tiles.grass)));
 expect(await bytes(object.originalImage!)).toEqual(new Uint8Array(key));
 expect(await bytes(restored.pack.tileOriginalImages!.office!)).toEqual(new Uint8Array(readFileSync('static'+originalFloor)));
 expect(object.width).toBe(source.objects['pixel.key'].width);
 expect(object.origin).toEqual(source.objects['pixel.key'].origin);
 expect(JSON.stringify(source)).toBe(snapshot);
});

it('keeps the deployed bridge identical to its source adapter',()=>{
 expect(readFileSync('static/tools/piskel/bridge.js','utf8')).toBe(readFileSync('vendor/piskel/bridge.js','utf8'));
 expect(readFileSync('static/tools/piskel/embed.css','utf8')).toBe(readFileSync('vendor/piskel/embed.css','utf8'));
 // Piskel has a nested HTML template; the real document must load the adapter stylesheet.
 expect(readFileSync('static/tools/piskel/index.html','utf8')).toMatch(/<link rel="stylesheet" href="embed\.css\?v=palette-4">\s*<\/body>\s*<\/html>\s*$/);
});


it('requires Piskel to confirm each frame instead of accepting the full strip as one image',()=>{
 const expected={blob:new Blob(),name:'walk/SE',width:512,height:96,frames:8,fps:10};
 expect(()=>validateEditorLoaded({frames:8,width:64,height:96},expected)).not.toThrow();
 expect(()=>validateEditorLoaded({frames:1,width:512,height:96},expected)).toThrow('fotogramas');
 expect(()=>validateEditorLoaded({},expected)).toThrow('fotogramas');
 expect(()=>validateEditorLoaded({frames:8,width:64,height:64},expected)).toThrow('fotogramas');
 expect(()=>validateEditorLoaded({frames:1,width:512,height:96},{...expected,frames:undefined})).not.toThrow();
});

it('versions the iframe and its adapter resources together',()=>{
 const html=readFileSync('static/tools/piskel/index.html','utf8');
 const script=readFileSync('scripts/vendor-piskel.mjs','utf8');
 for(const source of [html,script]) {
  expect(source).toContain(`bridge.js?v=${editorRevision}`);
  expect(source).toContain(`embed.css?v=${editorRevision}`);
 }
});

it('opens the chosen player action and direction, including its row offset and direction FPS',()=>{
 const c=structuredClone(graphics.character);c.animations.walk={image:'asset:walking',row:4,frames:8,fps:10,directionFps:{sw:12}};
 const clip=playerEditClip(c,'walk',c.directions.indexOf('sw'));
 expect(clip).toEqual({image:'asset:walking',frameWidth:c.frameWidth,frameHeight:c.frameHeight,row:6,frames:8,fps:12});
 expect(()=>playerEditClip(c,'walk',-1)).toThrow('Dirección');
 expect(()=>playerEditClip(c,'walk',c.directions.length)).toThrow('Dirección');
});

it('offers only available cycles and validates the selected action and direction before opening a sheet',()=>{
 const character=structuredClone(graphics.character),item=graphics.objects['pixel.key'];
 character.animations.sit.image='';
 expect(cycleActions('player',character,item)).not.toContain('sit');
 expect(cycleDirections('player',character,item,'walk')).toEqual(['ne','se','sw','nw']);
 expect(validateCycleSelection('player',character,item,{action:'walk',direction:'nw'})).toEqual({action:'walk',direction:'nw'});
 expect(()=>validateCycleSelection('player',character,item,{action:'missing'})).toThrow('acción');
 expect(()=>validateCycleSelection('player',character,item,{action:'walk',direction:''})).toThrow('Dirección');
});

it('supports switching NPC cycles between directional and single-row sheets without inventing a talk fallback',()=>{
 const clip={image:'asset:idle',frameWidth:24,frameHeight:32,row:0,frames:4,fps:6,directions:['ne','se','sw','nw'] as typeof graphics.character.directions};
 const item={...graphics.objects['pixel.key'],animations:{idle:clip,talk:{...clip,image:'asset:talk',directions:undefined}}};
 expect(cycleActions('npc',graphics.character,item)).toEqual(['idle','talk']);
 expect(validateCycleSelection('npc',graphics.character,item,{action:'talk',direction:'nw'})).toEqual({action:'talk',direction:undefined});
 expect(validateCycleSelection('npc',graphics.character,item,{action:'idle'})).toEqual({action:'idle',direction:'se'});
 delete (item.animations as Partial<typeof item.animations>).talk;
 expect(cycleActions('npc',graphics.character,item)).toEqual(['idle']);
 expect(()=>validateCycleSelection('npc',graphics.character,item,{action:'talk'})).toThrow('acción');
});

it('reassembles an edited NPC/player cycle without touching neighbouring rows or unused columns',()=>{
 const image=emptyFrame(8,8);for(let i=0;i<image.data.length;i++)image.data[i]=i%256;
 const before=new Uint8ClampedArray(image.data),clip={image:'asset:shared',frameWidth:2,frameHeight:2,row:2,frames:3,fps:6};
 const strip=extractAnimationStrip(image,clip);expect([strip.width,strip.height]).toEqual([6,2]);
 const editor={blob:new Blob(),name:'Ciclo',width:strip.width,height:strip.height,frames:clip.frames,fps:clip.fps};
 expect(()=>validateEditorLoaded({frames:3,width:2,height:2},editor)).not.toThrow();
 strip.data.fill(0);strip.data.set([255,0,0,255],0);
 const merged=replaceAnimationStrip(image,clip,strip);
 expect(image.data).toEqual(before);
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const i=(y*8+x)*4;
  expect(merged.data.subarray(i,i+4)).toEqual(y>=4&&y<6&&x<6?strip.data.subarray(((y-4)*6+x)*4,((y-4)*6+x+1)*4):before.subarray(i,i+4));
 }
 expect(()=>replaceAnimationStrip(image,clip,emptyFrame(2,2))).toThrow('tamaño');
 expect(()=>extractAnimationStrip(image,{...clip,row:4})).toThrow('hoja');
 expect(()=>extractAnimationStrip(image,{...clip,frames:5})).toThrow('hoja');
});

it('updates shared sheet references only within the edited character, retaining all clip metadata',()=>{
 const character=structuredClone(graphics.character),source=character.image;
 const resource={kind:'player' as const,character,item:graphics.objects['pixel.key'],tileImage:''},before=structuredClone(resource);
 const result=mapResourceImages(resource,url=>url===source?'asset:retouched':url);
 expect(resource).toEqual(before);
 expect(result.character.anchor).toEqual(character.anchor);expect(result.character.directions).toEqual(character.directions);
 for(const pose of Object.keys(character.animations) as (keyof typeof character.animations)[])expect(result.character.animations[pose]).toEqual({...character.animations[pose],...(character.animations[pose].image===source?{image:'asset:retouched'}:{})});
 const npc={...resource,kind:'npc' as const,item:{...resource.item,image:'asset:still',animations:{idle:{image:'asset:shared',frameWidth:2,frameHeight:2,row:0,frames:3,fps:6},talk:{image:'asset:shared',frameWidth:2,frameHeight:2,row:1,frames:2,fps:8}}}};
 const updated=mapResourceImages(npc,url=>url==='asset:shared'?'asset:edited-sheet':url);
 expect(updated.item.image).toBe('asset:still');expect(updated.item.animations!.talk).toEqual({...npc.item.animations.talk,image:'asset:edited-sheet'});
 expect(updated.item.animations!.idle).toEqual({...npc.item.animations.idle,image:'asset:edited-sheet'});
});
