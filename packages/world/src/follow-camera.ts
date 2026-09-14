import type {CameraAction} from './types';

export function isCameraCropped(scale:number,fitScale:number){return scale>fitScale*1.2;}

/** Offer the useful next action for the current amount of visible map. */
export function cameraAction(scale:number,fitScale:number):CameraAction{
 return isCameraCropped(scale,fitScale)?'fit':'player';
}

/** Only follow when the scene is materially cropped. */
export function shouldFollow(enabled:boolean,editor:boolean,suspended:boolean,scale:number,fitScale:number){
 return enabled&&!editor&&!suspended&&isCameraCropped(scale,fitScale);
}
export function mobileCamera(fitScale:number){
 const base=Math.max(fitScale,1/3);
 return {base,zoom:Math.max(1,Math.min(3,1/base))};
}
