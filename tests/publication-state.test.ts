import {expect,it} from 'vitest';
import {graphics} from '../src/lib/demo/pixelart';
import {publicGraphics,graphicsChanged} from '../src/lib/server/platform/publication-state';

it('compares existing snapshots independently of JSON object order and leaves originals intact',()=>{
 const current=structuredClone(graphics),snapshot=JSON.stringify(current),published=publicGraphics(current);
 const reordered={...published,objects:Object.fromEntries(Object.entries(published.objects).reverse())};
 expect(graphicsChanged(current,reordered)).toBe(false);expect(JSON.stringify(current)).toBe(snapshot);
});

it('ignores private backups, library origins and generation metadata rather than flagging them as public changes',()=>{
 const current=structuredClone(graphics),published=publicGraphics(current),image=current.objects['pixel.key'].image;
 current.resourceOrigins={'pixel.key':{id:'private-library',version:2}};
 current.tileOriginalImages={office:'asset:private-floor'};current.paletteOriginalImages={[image]:'asset:private-sheet'};
 current.objects['pixel.key'].originalImage='asset:private-key';current.objects['pixel.key'].generationImage='asset:private-raw';
 Object.assign(current.objects['pixel.key'],{sourcePrompt:'private description',generationNotes:'private notes'});
 expect(graphicsChanged(current,published)).toBe(false);
 const publicCopy=publicGraphics(current);expect(publicCopy.paletteOriginalImages).toBeUndefined();expect(publicCopy.resourceOrigins).toBeUndefined();expect(publicCopy.tileOriginalImages).toBeUndefined();
 expect(publicCopy.objects['pixel.key'].originalImage).toBeUndefined();expect(publicCopy.objects['pixel.key']).not.toHaveProperty('sourcePrompt');expect(current.objects['pixel.key'].originalImage).toBe('asset:private-key');
});

it('detects another active player and changes to that player’s animation configuration',()=>{
 const current=structuredClone(graphics);current.players={'custom.player':{name:'Otro jugador',character:structuredClone(current.character)}};
 const published=publicGraphics(current);current.activePlayer='custom.player';expect(graphicsChanged(current,published)).toBe(true);
 const active=publicGraphics(current);current.players['custom.player'].character.animations.walk.fps=17;expect(graphicsChanged(current,active)).toBe(true);
 current.players['custom.player'].character.animations.walk.fps=active.players!['custom.player'].character.animations.walk.fps;expect(graphicsChanged(current,active)).toBe(false);
});

it('detects replacement images, crops, floor graphics, scale and NPC clips',()=>{
 const published=publicGraphics(graphics);
 const changes=[
  (p:typeof graphics)=>{p.objects['pixel.key'].image='asset:new-image';},
  (p:typeof graphics)=>{p.objects['pixel.key'].frame=[1,0,16,16];},
  (p:typeof graphics)=>{p.tiles.office='asset:new-floor';},
  (p:typeof graphics)=>{p.character.scale=1.5;},
  (p:typeof graphics)=>{p.objects['pixel.key'].animations={idle:{image:p.character.image,frameWidth:64,frameHeight:96,frames:2,row:0,fps:6}};}
 ];
 for(const change of changes){const current=structuredClone(graphics);change(current);expect(graphicsChanged(current,published)).toBe(true);}
});
