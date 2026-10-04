import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {retouchReference} from '../packages/character-generator/src/browser';
import {pngUrl} from '../packages/character-generator/src/generation';

const bytes=new Uint8Array(readFileSync('static/pixelart/characters/grey-player-v1/sit.png'));
const image=pngUrl(bytes);
afterEach(()=>vi.unstubAllGlobals());
describe('reference retouching',()=>{
  it('opens a single image at original resolution and leaves cancellation unchanged',async()=>{
    const close=vi.fn();vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:1024,height:1536,close})));
    const edit=vi.fn(async()=>null);
    expect(await retouchReference(image,'reference SE',{edit})).toBeNull();
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({width:1024,height:1536,frames:1,fps:1,name:'reference SE'}));
    expect(close).toHaveBeenCalledOnce();
  });
  it('keeps the exact edited PNG and rejects a resized reference',async()=>{
    const editedBytes=new Uint8Array(readFileSync('static/pixelart/characters/grey-player-v1/idle.png'));
    const edit=vi.fn(async()=>new Blob([editedBytes],{type:'image/png'}));
    const close=vi.fn();const decode=vi.fn(async()=>({width:512,height:768,close}));vi.stubGlobal('createImageBitmap',decode);
    expect(await retouchReference(image,'reference NE',{edit})).toBe(pngUrl(editedBytes));
    expect(close).toHaveBeenCalledTimes(2);
    decode.mockResolvedValueOnce({width:512,height:768,close}).mockResolvedValueOnce({width:64,height:96,close});
    await expect(retouchReference(image,'reference NE',{edit})).rejects.toThrow('conservar el tamaño');
    expect(close).toHaveBeenCalledTimes(4);
  });
  it('does not replace an unchanged reference',async()=>{
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:512,height:768,close:vi.fn()})));
    expect(await retouchReference(image,'reference SE',{edit:async()=>new Blob([bytes],{type:'image/png'})})).toBeNull();
  });
});
