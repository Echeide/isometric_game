/** Ground footprints determine occlusion; a sprite's centre is insufficient for long furniture. */
export interface DepthItem {x:number;y:number;width:number;height:number;tie?:number;floor?:boolean}
export function depthOrder(items:DepthItem[]):number[]{
 const behind=(a:DepthItem,b:DepthItem)=>a.x+a.width<=b.x+1e-6||a.y+a.height<=b.y+1e-6;
 const rank=(a:DepthItem)=>a.x+a.y+(a.width+a.height)/2+(a.tie??0)*.001;
 const outgoing=items.map(()=>[] as number[]),incoming=items.map(()=>0);
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
  const a=items[i],b=items[j];
  // Disjoint horizontal projections cannot obscure each other.
  if(a.x+a.width-a.y<b.x-b.y-b.height||b.x+b.width-b.y<a.x-a.y-a.height)continue;
  const overlap=a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  if(overlap&&!!a.floor!==!!b.floor){const from=a.floor?i:j,to=a.floor?j:i;outgoing[from].push(to);incoming[to]++;continue;}
  const ab=behind(a,b),ba=behind(b,a);
  if(ab===ba)continue;
  const from=ab?i:j,to=ab?j:i;outgoing[from].push(to);incoming[to]++;
 }
 const remaining=new Set(items.map((_,i)=>i)),result:number[]=[];
 while(remaining.size){
  const ready=[...remaining].filter(i=>incoming[i]===0);
  // Overlapping geometry can form a cycle: break it deterministically.
  const candidates=ready.length?ready:[...remaining];
  candidates.sort((a,b)=>rank(items[a])-rank(items[b])||a-b);
  const next=candidates[0];remaining.delete(next);result.push(next);
  for(const to of outgoing[next])incoming[to]--;
 }
 return result;
}
/** Reuse the static scene order while the avatar moves; avoid sorting thousands of tiles every frame. */
export function insertMovingDepth(items:DepthItem[],order:number[],moving:DepthItem):number[]{
 let after=0,before=order.length;
 const rank=(a:DepthItem)=>a.x+a.y+(a.width+a.height)/2+(a.tie??0)*.001;
 for(let i=0;i<order.length;i++){
  const a=items[order[i]],b=moving;
  if(a.x+a.width-a.y<b.x-b.y-b.height||b.x+b.width-b.y<a.x-a.y-a.height)continue;
  const overlap=a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  const ab=a.x+a.width<=b.x+1e-6||a.y+a.height<=b.y+1e-6,ba=b.x+b.width<=a.x+1e-6||b.y+b.height<=a.y+1e-6;
  if(overlap&&a.floor||ab&&!ba)after=Math.max(after,i+1);
  else if(ba&&!ab)before=Math.min(before,i);
  else if(overlap){if(rank(a)<=rank(b))after=Math.max(after,i+1);else before=Math.min(before,i);}
 }
 const index=after<=before?after:before;
 return [...order.slice(0,index),items.length,...order.slice(index)];
}
