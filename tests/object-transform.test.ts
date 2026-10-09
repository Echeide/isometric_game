import {it,expect} from 'vitest';
import {Texture} from 'pixi.js';
import {pixelObject,type LoadedPixelArt,type PixelArtPack} from '../packages/world/src/pixelart';
import {alphaHitArea} from '../packages/world/src/alpha-hit';
it('keeps rendered opaque pixels clickable with rotation, scaling and an off-centre support',()=>{
 const mask={width:4,height:2,alpha:new Uint8Array([0,255,255,0,0,40,255,0])};
 for(const rotation of [undefined,0,6.5,-12]){
  const item={image:'test',width:60,height:30,origin:[31,28] as [number,number],rotation};
  const art={pack:{objects:{test:item}} as unknown as PixelArtPack,textures:new Map([['test',Texture.EMPTY]])} as LoadedPixelArt;
  const sprite=pixelObject(art,'test')!,hit=alphaHitArea(mask,item);
  for(const [u,v,opaque]of [[.375,.25,true],[.375,.75,false],[.625,.75,true],[.125,.25,false]] as const){
   const world=sprite.toGlobal({x:(u-sprite.anchor.x)*sprite.texture.width,y:(v-sprite.anchor.y)*sprite.texture.height});
   expect(hit.contains(world.x,world.y)).toBe(opaque);
   expect(alphaHitArea(mask,item,true).contains(-world.x,world.y)).toBe(opaque);
  }
  sprite.destroy();
 }
});
