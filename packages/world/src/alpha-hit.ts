/** Map world-local coordinates back to the visible pixels of an object sprite. */
export function alphaHitArea(mask:{width:number;height:number;alpha:Uint8Array},item:{width:number;height:number;origin:[number,number];frame?:[number,number,number,number]},flipX=false){
 const [fx,fy,fw,fh]=item.frame??[0,0,mask.width,mask.height];
 return {contains(x:number,y:number){
  const u=((flipX?-x:x)+item.origin[0])/item.width;
  const v=(y+item.origin[1])/item.height;
  if(u<0||v<0||u>=1||v>=1)return false;
  const px=fx+Math.floor(u*fw),py=fy+Math.floor(v*fh);
  // Ignore soft shadows as well as fully transparent padding.
  return (mask.alpha[py*mask.width+px]??0)>=64;
 }};
}

/** The diamond-shaped floor area occupied by an entity, in entity-local pixels. */
export function footprintHitArea(size:{x:number;y:number}={x:1,y:1}){
 return {contains(x:number,y:number){
  const gridX=x/64+y/32,gridY=y/32-x/64;
  return gridX>=0&&gridY>=0&&gridX<=size.x&&gridY<=size.y;
 }};
}
