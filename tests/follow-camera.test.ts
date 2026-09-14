import {expect,it} from 'vitest';
import {mobileCamera,shouldFollow} from '../packages/world/src/follow-camera';
it('starts mobile scenes at a readable scale within zoom limits',()=>{
 for(const fit of [.1,.3,.6,1.5]){const c=mobileCamera(fit);expect(c.zoom).toBeLessThanOrEqual(3);expect(c.base*c.zoom).toBeGreaterThanOrEqual(1);}
});
it('follows cropped close views but leaves overview, editor and manual pan free',()=>{
 expect(shouldFollow(true,false,false,1,.3)).toBe(true);
 expect(shouldFollow(true,false,false,.4,.3)).toBe(true);
 expect(shouldFollow(true,false,false,1.15,1)).toBe(false);
 expect(shouldFollow(true,false,false,1,1)).toBe(false);
 expect(shouldFollow(true,true,false,1,.3)).toBe(false);
 expect(shouldFollow(true,false,true,1,.3)).toBe(false);
 expect(shouldFollow(false,false,false,1,.3)).toBe(false);
});
