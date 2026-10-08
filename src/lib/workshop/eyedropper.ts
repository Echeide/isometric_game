export type CanvasBounds={left:number;top:number;width:number;height:number};
/** Use the backing pixel, even when CSS size or browser zoom changes. */
export function eyedropperPixel(clientX:number,clientY:number,bounds:CanvasBounds,width:number,height:number){
 if(bounds.width<=0||bounds.height<=0||width<1||height<1)return undefined;
 const x=Math.floor((clientX-bounds.left)*width/bounds.width),y=Math.floor((clientY-bounds.top)*height/bounds.height);
 if(x<0||y<0||x>=width||y>=height)return undefined;
 return {x,y};
}
/** Keep the circle beside the pointer and within the preview. */
export function eyedropperLoupePosition(x:number,y:number,width:number,height:number,size=136){
 const gap=20,left=x+gap+size<=width?x+gap:x-gap-size;
 return {left:Math.max(0,Math.min(left,Math.max(0,width-size))),top:Math.max(0,Math.min(y-size/2,Math.max(0,height-size)))};
}
