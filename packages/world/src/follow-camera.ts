/** Only follow when the scene is materially cropped. */
export function shouldFollow(enabled:boolean,editor:boolean,suspended:boolean,scale:number,fitScale:number){
 return enabled&&!editor&&!suspended&&scale>fitScale*1.2;
}
export function mobileCamera(fitScale:number){
 const base=Math.max(fitScale,1/3);
 return {base,zoom:Math.max(1,Math.min(3,1/base))};
}
