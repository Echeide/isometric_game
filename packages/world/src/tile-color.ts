/** Sample the inner diamond, excluding transparent pixels and outlines; group nearby shades. */
export function tileSurfaceColor(pixels:ArrayLike<number>,width:number,height:number):number|undefined{
 const bins=new Map<number,{count:number;r:number;g:number;b:number}>();
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(Math.abs((x+.5)/width*2-1)+Math.abs((y+.5)/height*2-1)>.8)continue;
  const i=(y*width+x)*4;if(pixels[i+3]<128)continue;const r=pixels[i],g=pixels[i+1],b=pixels[i+2],key=(r>>3)<<10|(g>>3)<<5|(b>>3),bin=bins.get(key)??{count:0,r:0,g:0,b:0};bin.count++;bin.r+=r;bin.g+=g;bin.b+=b;bins.set(key,bin);
 }
 const best=[...bins.values()].sort((a,b)=>b.count-a.count)[0];if(!best)return undefined;
 return Math.round(best.r/best.count)<<16|Math.round(best.g/best.count)<<8|Math.round(best.b/best.count);
}
