/** Pack AI-created artwork into the game's regular grid; preserve generated alpha. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../static/pixelart/characters/grey-player-v1');
const actions = {idle:[4,3,64],walk:[8,10,64],work:[4,8,52],talk:[4,5,64],celebrate:[6,8,64],sit:[1,1,52]};

function separators(projection, count) {
 const size=projection.length, result=[0];
 for(let i=1;i<count;i++){
  const ideal=i*size/count,radius=Math.floor(size/count*.12);
  let best=Math.round(ideal),score=Infinity;
  for(let p=Math.floor(ideal)-radius;p<=Math.floor(ideal)+radius;p++){
   const candidate=projection[p]*1000+Math.abs(p-ideal);
   if(candidate<score){score=candidate;best=p;}
  }
  result.push(best);
 }
 return [...result,size];
}

(async()=>{
 const manifest={image:'/pixelart/characters/grey-player-v1/idle.png',frameWidth:64,frameHeight:96,anchor:[32,80],directions:['ne','se','sw','nw'],animations:{}};
 const report={};
 for(const [action,[count,fps,targetHeight]] of Object.entries(actions)){
  const input=path.join(root,'generated',action+'.png');
  const meta=await sharp(input).metadata();
  if(!meta.hasAlpha)throw new Error(`${action}: background is not transparent`);
  const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=info,px=new Uint32Array(width),py=new Uint32Array(height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>128){px[x]++;py[y]++;}
  const xs=separators(px,count),ys=separators(py,4),cells=[];
  for(let row=0;row<4;row++)for(let col=0;col<count;col++){
   let left=xs[col+1],right=xs[col],top=ys[row+1],bottom=ys[row];
   for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++){
    if(data[(y*width+x)*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   }
   if(right<left||bottom<top)throw new Error(`${action}/${row}/${col}: missing sprite`);
   cells.push({row,col,left,top,width:right-left+1,height:bottom-top+1});
  }
  // Use stable standing poses to set scale; preserve shorter jump/landing silhouettes.
  const baseline=action==='celebrate'?cells.filter(c=>c.col===0||c.col===count-1):cells;
  const sorted=baseline.map(c=>c.height).sort((a,b)=>a-b);
  const scale=Math.min(targetHeight/sorted[Math.floor(sorted.length/2)],...cells.map(c=>54/c.width));
  const layers=[];
  for(const cell of cells){
   const w=Math.round(cell.width*scale),h=Math.round(cell.height*scale);
   const png=await sharp(input).extract({left:cell.left,top:cell.top,width:cell.width,height:cell.height}).resize(w,h,{kernel:'nearest'}).png().toBuffer();
   const lift=action==='celebrate'&&cell.col===3?8:0;
   layers.push({input:png,left:cell.col*64+Math.round(32-w/2),top:cell.row*96+80-h-lift});
  }
  await sharp({create:{width:count*64,height:384,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(path.join(root,action+'.png'));
  manifest.animations[action]={image:`/pixelart/characters/grey-player-v1/${action}.png`,row:0,frames:count,fps};
  report[action]={source:[width,height],output:[count*64,384],frames:count,scale};
 }
 fs.writeFileSync(path.join(root,'character.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(root,'packing.json'),JSON.stringify(report,null,2)+'\n');
 console.log(report);
})().catch(error=>{console.error(error);process.exitCode=1;});
