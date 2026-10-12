import type {CharacterPack,ObjectSprite} from '@isometrico/world';

/** The object starts one cell inside the preview floor on both axes. */
export function stageLayout(size:{x:number;y:number},item:ObjectSprite|undefined,reference:CharacterPack,zoom:number){
 const cells=(n:number)=>Number.isFinite(n)?Math.max(1,Math.min(64,Math.ceil(n))):1;
 const footprint={x:cells(size.x),y:cells(size.y)};
 const columns=Math.max(4,footprint.x+2),rows=Math.max(4,footprint.y+2);
 const points=[[-rows*32,0],[columns*32,(columns+rows)*16]];
 const scale=reference.scale??1,rx=-85-reference.anchor[0]*scale,ry=52-reference.anchor[1]*scale;
 points.push([rx,ry],[rx+reference.frameWidth*scale,ry+reference.frameHeight*scale]);
 if(item&&[item.width,item.height,...item.origin,item.rotation??0].every(Number.isFinite)){
  const angle=(item.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  for(const x of [-item.origin[0],item.width-item.origin[0]])for(const y of [-item.origin[1],item.height-item.origin[1]])points.push([x*c-y*s,32+x*s+y*c]);
 }
 const left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0]));
 const top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
 // At the default 2× zoom show the entire drawing and floor, leaving a margin.
 const viewScale=zoom*Math.min(1,616/(2*(right-left)),350/(2*(bottom-top)));
 return {columns,rows,footprint,scale:viewScale,x:340-(left+right)/2*viewScale,y:215-(top+bottom)/2*viewScale};
}
