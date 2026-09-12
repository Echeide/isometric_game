import {afterEach,expect,it,vi} from 'vitest';
vi.mock('pixi.js',()=>({Assets:{load:vi.fn()},Container:class{},Graphics:class{},Rectangle:class{},Sprite:class{},Texture:class{}}));
import {Assets} from 'pixi.js';
import {loadPixelArt,type PixelArtPack} from '../packages/world/src/pixelart';
const pack=()=>({version:1,character:{variants:['default'],frameWidth:1,frameHeight:1,animations:{},directions:[]},objects:{item:{image:'test.png',width:1,height:1,origin:[0,0]}},tiles:{}} as unknown as PixelArtPack);
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('shares preparation, masks and frames between scene rebuilds',async()=>{
 const read=vi.fn(()=>({data:new Uint8ClampedArray([0,0,0,255])}));
 vi.stubGlobal('document',{createElement:()=>({getContext:()=>({drawImage:()=>{},getImageData:read})})});
 vi.mocked(Assets.load).mockResolvedValue({source:{width:1,height:1,resource:{}}});
 const graphics=pack(),a=loadPixelArt(graphics),b=loadPixelArt(graphics);
 expect(a).toBe(b);expect(await a).toBe(await loadPixelArt(graphics));
 expect(Assets.load).toHaveBeenCalledTimes(1);expect(read).toHaveBeenCalledTimes(1);
});
it('allows another attempt after a failed asset load',async()=>{
 vi.mocked(Assets.load).mockRejectedValue(new Error('Unavailable'));
 const graphics=pack();await expect(loadPixelArt(graphics)).rejects.toThrow('Unavailable');
 await expect(loadPixelArt(graphics)).rejects.toThrow('Unavailable');expect(Assets.load).toHaveBeenCalledTimes(2);
});
