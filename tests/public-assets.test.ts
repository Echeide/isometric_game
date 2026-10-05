import {it,expect,vi,beforeEach} from 'vitest';
import type {RequestEvent} from '@sveltejs/kit';
const mocks=vi.hoisted(()=>({publicAsset:vi.fn()}));
vi.mock('$lib/server/platform/runtime',()=>({platform:()=>({store:mocks})}));
import {GET} from '../src/routes/api/public/[...path]/+server';
beforeEach(()=>{mocks.publicAsset.mockReset();});
it.each(['image-id.png','image-id'])('serves public PNG bytes for %s through the release access check',async id=>{
 const png=new Uint8Array([137,80,78,71]);mocks.publicAsset.mockResolvedValue(png);
 const response=await GET({params:{path:`assets/release-id/${id}`}} as unknown as RequestEvent);
 expect(mocks.publicAsset).toHaveBeenCalledWith('release-id','image-id');expect(response.status).toBe(200);expect(response.headers.get('content-type')).toBe('image/png');expect(response.headers.get('cache-control')).toBe('no-store');expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
});
