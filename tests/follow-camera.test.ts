import {expect,it} from 'vitest';
import {cameraAction,initialGameCamera,shouldFollow} from '../packages/world/src/follow-camera';
it('starts game scenes at maximum zoom with a readable scale on every screen',()=>{
 for(const fit of [.1,.3,.6,1.5]){const c=initialGameCamera(fit);expect(c.zoom).toBe(3);expect(c.base*c.zoom).toBeGreaterThanOrEqual(1);}
});
it('chooses one control from the same crop threshold used by follow mode',()=>{
 expect(cameraAction(1,1)).toBe('player');
 expect(cameraAction(1.2,1)).toBe('player');
 expect(cameraAction(1.21,1)).toBe('fit');
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
