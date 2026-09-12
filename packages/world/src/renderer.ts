import {topContains,levelAt,stairAt,stairDirections,STAIR_STEPS,LEVEL_HEIGHT,projectSurface,surfaceHeight,wallHeight} from './elevation';
import {exitFacing} from './exits';
import {alphaHitArea} from './alpha-hit';
import {depthOrder,insertMovingDepth,type DepthItem} from './depth';
import {sceneWalls,wallCells,hasTile,wallEndExposed} from './walls';
import type {Wall} from './types';
import { cameraGestures } from './camera-gestures';
import { Application, Container, Graphics, Text, Sprite, Polygon, Rectangle } from 'pixi.js';
import { loadPixelArt, pixelObject, type LoadedPixelArt, type PixelArtPack } from './pixelart';
import { createActor, facingFor } from './actor';
import {tileAt,defaultTile} from './terrain';
import { seatPlacement } from './seating';
import type { WorldEditor, ActorPose, Facing, Cell, WorldEntity, WorldScene } from './types';
import { findPath, interactionCells, project, walkable } from './navigation';

const palette = { top: 0xdce6e4, left: 0xb1c5c2, right: 0x91aaa7 };
function poly(g: Graphics, points: number[], fill: number, alpha = 1) { g.poly(points).fill({ color: fill, alpha }); }
function box(g: Graphics, x: number, y: number, w: number, d: number, h: number, color = palette, z = 0) {
  const p = project({ x, y }); const a = w * 32, b = d * 32;
  poly(g,[p.x,p.y-z,p.x+a,p.y+a/2-z,p.x+a-b,p.y+(a+b)/2-z,p.x-b,p.y+b/2-z],color.top);
  poly(g,[p.x-b,p.y+b/2-z,p.x+a-b,p.y+(a+b)/2-z,p.x+a-b,p.y+(a+b)/2+h-z,p.x-b,p.y+b/2+h-z],color.left);
  poly(g,[p.x+a,p.y+a/2-z,p.x+a-b,p.y+(a+b)/2-z,p.x+a-b,p.y+(a+b)/2+h-z,p.x+a,p.y+a/2+h-z],color.right);
}
function entityArt(e: WorldEntity, outdoor: boolean, art:LoadedPixelArt, scene:WorldScene) {
  const c = new Container(), drawing=new Container(); const g = new Graphics(); drawing.addChild(g);c.addChild(drawing);
  drawing.scale.x=e.flipX?-1:1;
  const footprintSize=e.size??{x:1,y:1};
  const size=e.flipX?{x:footprintSize.y,y:footprintSize.x}:footprintSize;
  if(e.interaction?.action==='adventure.exit') {
    if(scene.walls?.some(w=>w.exitId===e.id))return c;
    // Exit markers live on the ground, including those in already-saved maps.
    const corners=[{x:.04,y:.04},{x:size.x-.04,y:.04},{x:size.x-.04,y:size.y-.04},{x:.04,y:size.y-.04}].flatMap(p=>{const at=project(p);return [at.x,at.y];});
    g.poly(corners).fill({color:outdoor?0xd7ddc3:0xd3dfd5,alpha:.8}).stroke({color:0x849a83,width:1,alpha:.65});
    const edges=[{distance:e.position.x,dx:-1,dy:0},{distance:scene.width-e.position.x-footprintSize.x,dx:1,dy:0},{distance:e.position.y,dx:0,dy:-1},{distance:scene.height-e.position.y-footprintSize.y,dx:0,dy:1}];
    const direction=edges.sort((a,b)=>a.distance-b.distance)[0];
    const arrow=[[-.28,-.065],[.02,-.065],[.02,-.20],[.30,0],[.02,.20],[.02,.065],[-.28,.065]].flatMap(([u,v])=>{
      const p=project({x:size.x/2+u*direction.dx-v*direction.dy,y:size.y/2+u*direction.dy+v*direction.dx});return [p.x,p.y];
    });
    g.poly(arrow).fill({color:0x526f53,alpha:.9});
    c.hitArea=new Polygon(corners);
    return c;
  }
  if(e.kind!=='person'){
    const id=e.visualId?.startsWith('pixel.')?e.visualId:`pixel.${e.kind}`;
    const custom=pixelObject(art,id==='pixel.goal'&&e.completed?'pixel.goal-completed':id);
    if(!custom)throw new Error(`Falta el gráfico de píxel: ${id}.`);
    drawing.addChild(custom);
    const item=art.pack.objects[id==='pixel.goal'&&e.completed?'pixel.goal-completed':id];
    const mask=art.masks.get(item.image);
    if(mask)c.hitArea=alphaHitArea(mask,item,e.flipX);
  }
  return c;
}
export async function createWorld(host: HTMLElement, scene: WorldScene, onArrive: (e: WorldEntity) => void, onStatus: (s:string) => void, initialEditor: WorldEditor|undefined, graphics:PixelArtPack) {
  const art=await loadPixelArt(graphics);
  const app = new Application();
  await app.init({backgroundAlpha:0,antialias:false,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true,width:host.clientWidth,height:host.clientHeight});
  host.appendChild(app.canvas);
  const world=new Container(); const floor=new Container(); const objects=new Container(); objects.sortableChildren=true;
  const labelLayer=new Container();labelLayer.eventMode='none';
  world.addChild(floor,objects,labelLayer); app.stage.addChild(world);
  let editor=initialEditor;
  const outdoor=scene.theme==='outdoors';
  const groundPalette=outdoor?{top:0xb5cba4,left:0x8d9e78,right:0x768b69}:palette;
  const minimumHeight=Math.min(0,...Object.values(scene.elevations??{}))*LEVEL_HEIGHT;
  const hasLevels=Object.values(scene.elevations??{}).some(z=>z!==0)||Object.keys(scene.stairs??{}).length>0;
  const foundation = new Graphics();
  for(let x=0;x<scene.width;x++)for(let y=0;y<scene.height;y++)if(hasTile(scene,{x,y}))box(foundation,x,y,1,1,18,groundPalette,minimumHeight);
  floor.addChild(foundation);
  const depthItems:{view:Container;bounds:()=>DepthItem}[]=[];
  const tileDrawers=new Map<string,(kind:import('./types').TileKind|'void')=>void>();
  for(let x=0;x<scene.width;x++) for(let y=0;y<scene.height;y++) {
    const z=levelAt(scene,{x,y})*LEVEL_HEIGHT;const base=project({x,y});const p={x:base.x,y:base.y-z}; const tile=new Graphics();
    let textureTile:Sprite|undefined;
    const drawTile=(kind:import('./types').TileKind|'void')=>{
      tile.clear();
      if(textureTile)textureTile.visible=kind!=='void';
      if(kind==='void'){if(editor)tile.poly([p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16]).stroke({color:0x829d7a,alpha:.25,width:1});return;}
      if(z>minimumHeight)box(tile,x,y,1,1,z-minimumHeight,groundPalette,z);
      {
        const texture=art.textures.get(art.pack.tiles[kind])!;
        if(!textureTile){textureTile=new Sprite(texture);textureTile.position.set(p.x-32,p.y);textureTile.width=64;textureTile.height=32;textureTile.eventMode='none';textureTile.roundPixels=true;tile.addChild(textureTile);}
        else textureTile.texture=texture;
      }
      const stair=stairAt(scene,{x,y});
      if(stair){
        if(textureTile)textureTile.visible=false;
        const d=stairDirections[stair];
        for(let step=0;step<STAIR_STEPS;step++){
          const along=(d.x+d.y)>0?step:STAIR_STEPS-1-step;
          const sx=x+(d.x?step/STAIR_STEPS:0),sy=y+(d.y?step/STAIR_STEPS:0),h=z+(along+1)*LEVEL_HEIGHT/STAIR_STEPS;
          box(tile,sx,sy,d.x?1/STAIR_STEPS:1,d.y?1/STAIR_STEPS:1,h-minimumHeight,{top:0xe0d9c1,left:0xa69d85,right:0x8f8876},h);
        }
      }
      tile.hitArea={contains:(px:number,py:number)=>topContains(scene,{x,y},{x:px,y:py})};
    };
    drawTile(tileAt(scene,{x,y}));tileDrawers.set(`${x},${y}`,drawTile);
    if(walkable(scene,{x,y})) {
      tile.eventMode='static';tile.cursor='pointer';
      tile.on('pointertap',()=>{host.focus({preventScroll:true});if(!gestures.blocked()){if(editor?.onpick)editor.onpick({x,y});else if(!editor)moveTo({x,y});else if(!editor.brush&&!editor.wallTool)editor.onselect('');}});
      tile.on('pointerover',()=>{tile.tint=0xd0e8b6;});tile.on('pointerout',()=>{tile.tint=0xffffff;});
    }
    if(hasLevels){objects.addChild(tile);depthItems.push({view:tile,bounds:()=>({x,y,width:1,height:1,tie:-1000,floor:true})});}else floor.addChild(tile);
  }
  const allWalls=sceneWalls(scene);
  const wallViews:{wall:Wall;view:Graphics;group:string}[]=[];
  function wallArt(w:Wall){
    const g=new Graphics(),dx=w.axis==='x'?1:0,dy=1-dx;
    const thickness=w.kind==='door'?.20:.16;
    const neighbor=(end:0|1)=>!wallEndExposed(w,end,allWalls.filter(n=>wallHeight(scene,n)===wallHeight(scene,w)));
    const material=w.material??'white';
    const colors=w.kind==='door'?{front:0x997450,top:0xc6a37a,side:0x74583e,under:0x604a36}:{front:w.axis==='x'?0xd4ded5:0xb8cdc5,top:0xe9eee5,side:0x8ca69b,under:0x7e978c};
    if(w.kind==='wall'){if(material==='glass')Object.assign(colors,{front:0xaed4dc,top:0xe3f8fa,side:0x779ea9});else if(material==='stone')Object.assign(colors,{front:0x9ba297,top:0xc9cec0,side:0x747f73});else if(material==='cobble')Object.assign(colors,{front:0x747b70,top:0xbdb9a7,side:0x656f61});}
    function point(t:number,offset:number,z:number){const p=project({x:w.x+dx*t+dy*offset,y:w.y+dy*t+dx*offset});return [p.x,p.y-z-wallHeight(scene,w)];}
    function face(points:number[][],color:number,alpha=1){g.poly(points.flat()).fill({color,alpha});}
    function slab(start:number,end:number,low:number,high:number,capStart:boolean,capEnd:boolean){
      const back=-thickness/2,front=thickness/2;
      // Continuous upper surface; no outlines at the joins between tiles.
      face([point(start,back,high),point(end,back,high),point(end,front,high),point(start,front,high)],colors.top);
      if(low>0)face([point(start,back,low),point(end,back,low),point(end,front,low),point(start,front,low)],colors.under);
      if(capStart)face([point(start,back,low),point(start,front,low),point(start,front,high),point(start,back,high)],colors.side);
      if(capEnd)face([point(end,back,low),point(end,front,low),point(end,front,high),point(end,back,high)],colors.side);
      face([point(start,front,low),point(end,front,low),point(end,front,high),point(start,front,high)],colors.front);
    }
    if(w.kind==='door'){
      slab(0,.16,0,49,!neighbor(0),true);
      slab(.84,1,0,49,true,!neighbor(1));
      slab(0,1,49,62,!neighbor(0),!neighbor(1));
    }else {
      slab(0,1,0,62,!neighbor(0),!neighbor(1));
      const offset=thickness/2,origin=w.axis==='x'?w.x:w.y;
      if(material==='stone'||material==='cobble'){
        const step=material==='stone'?.65:.38,rowHeight=material==='stone'?12:10;
        for(let row=0;row*rowHeight<62;row++){
          const shift=(row%2)*step/2;
          for(let col=Math.floor((origin-shift)/step);col*step+shift<origin+1;col++){
            const left=Math.max(0,col*step+shift-origin+.018),right=Math.min(1,(col+1)*step+shift-origin-.018);
            const low=row*rowHeight+1,high=Math.min(61,(row+1)*rowHeight-1);
            if(right<=left||high<=low)continue;
            const shade=Math.abs((col*37+row*17)%4);
            if(material==='stone')face([point(left,offset,low),point(right,offset,low),point(right,offset,high),point(left,offset,high)],[0xaeb3a7,0x989e93,0xb9bdaf,0xa2a99b][shade]);
            else {const cut=Math.min(.06,(right-left)/4),mid=(low+high)/2;face([point(left+cut,offset,low),point(right-cut,offset,low+.5),point(right,offset,mid),point(right-cut,offset,high),point(left+cut,offset,high-.5),point(left,offset,mid)],[0xa5a38f,0xb7ae98,0x969e8b,0xc0b7a2][shade]);}
          }
        }
      }else if(material==='glass'){
        // Subtle reflection bands on the original translucent glass.
        for(const [low,high] of [[17,20],[43,48]])g.poly([point(0,offset,low),point(1,offset,low+7),point(1,offset,high+7),point(0,offset,high)].flat()).fill({color:0xf0ffff,alpha:.35});
      }
    }
    return g;
  }
  for(const w of allWalls){
    const view=wallArt(w);view.zIndex=(w.x+w.y+.5)*100+3;objects.addChild(view);let gx=w.x,gy=w.y;
    if(w.kind==='wall')while(allWalls.some(n=>n.kind==='wall'&&n.axis===w.axis&&n.x===gx-(w.axis==='x'?1:0)&&n.y===gy-(w.axis==='y'?1:0))){gx-=w.axis==='x'?1:0;gy-=w.axis==='y'?1:0;}
    wallViews.push({wall:w,view,group:`${w.kind}:${w.axis}:${gx},${gy}`});depthItems.push({view,bounds:()=>({x:w.x,y:w.y,width:w.axis==='x'?1:0,height:w.axis==='y'?1:0,tie:3})});
    view.eventMode='static';view.cursor='pointer';
    view.on('pointertap',()=>{if(gestures.blocked())return;if(editor&&!editor.brush&&!editor.wallTool)editor.onwall?.(w);else if(!editor&&w.exitId)goTo(w.exitId);});
  }
  const wallPreview=new Graphics();wallPreview.eventMode='none';objects.addChild(wallPreview);wallPreview.zIndex=1e9;
  const entityViews=new Map<string,Container>();
  const labels=new Map<string,Container>();
  const hovered=new Set<string>();
  let selectedEntity=editor?.selectedId??'';
  function refreshLabels(){for(const [id,label] of labels)label.visible=id===selectedEntity||hovered.has(id);}
  const occupants=new Map<string,ReturnType<typeof createActor>>();
  for(const e of scene.entities) {
    const view=entityArt(e,outdoor,art,scene);const p=projectSurface(scene,e.position);view.position.set(p.x,p.y);view.zIndex=(e.position.x+e.position.y+(e.size?.x??1)/2+(e.size?.y??1)/2)*100;
    depthItems.push({view,bounds:()=>({...(drag?.id===e.id?drag.position:e.position),width:e.size?.x??1,height:e.size?.y??1})});
    {view.eventMode='static';view.cursor='pointer';view.on('pointertap',()=>{host.focus({preventScroll:true});if(!editor&&!gestures.blocked())goTo(e.id);});view.on('pointerover',event=>{if(event.pointerType==='touch')return;view.alpha=.8;hovered.add(e.id);refreshLabels();});view.on('pointerout',()=>{view.alpha=1;hovered.delete(e.id);refreshLabels();});}
    if(e.kind==='person'){const actor=createActor(e.color??0xd79875,false,art);const at=project({x:.5,y:.5});actor.view.position.set(at.x,at.y);actor.view.scale.x=e.flipX?-1:1;view.addChildAt(actor.view,0);occupants.set(e.id,actor);}
    if(e.seat){
      const placement=seatPlacement(e.seat),p=projectSurface(scene,placement);
      const base=pixelObject(art,'pixel.chair-base');
      const back=pixelObject(art,`pixel.chair-back-${e.seat.facing}`);
      if(base&&back){
        for(const [sprite,z] of [[base,0],[back,placement.backInFront?2:0]] as const){
          const layer=new Container();layer.position.set(p.x,p.y);layer.addChild(sprite);
          layer.zIndex=(placement.x+placement.y+1)*100+z;objects.addChild(layer);depthItems.push({view:layer,bounds:()=>({x:placement.x,y:placement.y,width:1,height:1,tie:z})});
        }
      }else{throw new Error('Faltan los gráficos de píxel del asiento.');
      }
    }
    view.on('pointerdown',event=>{
      if(!editor || editor.onpick || editor.wallTool || event.button!==0 || drag)return;
      host.focus({preventScroll:true});editor.onselect(e.id);
      const start=world.toLocal(event.global);
      drag={id:e.id,pointerId:event.pointerId,start,original:{...e.position},position:{...e.position}};
      app.canvas.setPointerCapture(event.pointerId);view.cursor='grabbing';
      highlight(e.id,e.position);
    });
    const bounds=view.getLocalBounds();
    view.hitArea??=new Rectangle(bounds.x,bounds.y,bounds.width,bounds.height);
    const size=e.size??{x:1,y:1},at=project({x:size.x/2,y:size.y/2});
    const label=new Container();label.eventMode='none';label.visible=false;
    const text=new Text({text:e.label,style:{fontFamily:'system-ui',fontSize:12,fontWeight:'600',fill:outdoor?0x385648:0x344a4e}});
    text.anchor.set(.5,0);text.position.set(at.x,at.y+15);
    const back=new Graphics().roundRect(at.x-text.width/2-8,at.y+12,text.width+16,23,7).fill({color:0xffffff,alpha:.92});
    label.addChild(back,text);label.position.copyFrom(view.position);labelLayer.addChild(label);labels.set(e.id,label);
    objects.addChild(view);entityViews.set(e.id,view);
  }
  const selection=new Graphics();selection.eventMode='none';floor.addChild(selection);
  let drag:{id:string;pointerId:number;start:{x:number;y:number};original:Cell;position:Cell}|null=null;
  function highlight(id:string,position?:Cell){
    selectedEntity=id;refreshLabels();
    selection.clear();
    for(const [key,view]of entityViews){view.tint=editor&&key===id?0xe3ffc8:0xffffff;view.cursor=editor?'grab':scene.entities.find(e=>e.id===key)?.interaction?'pointer':'default';}
    host.dataset.selected=editor?id:'';
    const e=scene.entities.find(e=>e.id===id);if(!e||!editor)return;
    const p=projectSurface(scene,position??e.position),w=(e.size?.x??1)*32,h=(e.size?.y??1)*32;
    selection.poly([p.x,p.y,p.x+w,p.y+w/2,p.x+w-h,p.y+(w+h)/2,p.x-h,p.y+h/2]).fill({color:0x8dcb56,alpha:.3}).stroke({color:0x437e2e,width:3});
    host.dataset.selected=id;
  }
  function dragMove(event:PointerEvent){
    if(!drag||event.pointerId!==drag.pointerId)return;
    event.preventDefault();
    const rect=app.canvas.getBoundingClientRect();
    const p=world.toLocal({x:(event.clientX-rect.left)*app.screen.width/rect.width,y:(event.clientY-rect.top)*app.screen.height/rect.height});
    const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    drag.position={x:drag.original.x+Math.round(dx/64+dy/32),y:drag.original.y+Math.round(dy/32-dx/64)};
    const at=projectSurface(scene,drag.position);entityViews.get(drag.id)?.position.set(at.x,at.y);highlight(drag.id,drag.position);
  }
  function endDrag(event:PointerEvent){
    if(!drag||event.pointerId!==drag.pointerId)return;
    const finished=drag;drag=null;
    if(app.canvas.hasPointerCapture(event.pointerId))app.canvas.releasePointerCapture(event.pointerId);
    const at=projectSurface(scene,finished.original);entityViews.get(finished.id)?.position.set(at.x,at.y);
    highlight(finished.id,finished.original);
    if(event.type!=='pointercancel'&&(finished.position.x!==finished.original.x||finished.position.y!==finished.original.y))editor?.onmove(finished.id,finished.position);
  }
  let panX=0,panY=0,panMode=false,spaceHeld=false;
  let panGesture:{id:number;x:number;y:number}|null=null;
  function panCursor(){app.canvas.style.setProperty('cursor',panGesture?'grabbing':panMode||spaceHeld?'grab':'auto',panGesture||panMode||spaceHeld?'important':'');app.canvas.style.touchAction='none';}
  function panDown(event:PointerEvent){
    if(panGesture||drag||stroke||!(event.button===1||(event.button===0&&(panMode||spaceHeld))))return;
    event.preventDefault();event.stopImmediatePropagation();host.focus({preventScroll:true});
    panGesture={id:event.pointerId,x:event.clientX,y:event.clientY};app.canvas.setPointerCapture(event.pointerId);panCursor();
  }
  function panMove(event:PointerEvent){
    if(!panGesture||panGesture.id!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    const rect=app.canvas.getBoundingClientRect();panX+=(event.clientX-panGesture.x)*app.screen.width/rect.width;panY+=(event.clientY-panGesture.y)*app.screen.height/rect.height;
    panGesture.x=event.clientX;panGesture.y=event.clientY;fit();
  }
  function panEnd(event:PointerEvent){
    if(!panGesture||panGesture.id!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();panGesture=null;
    if(app.canvas.hasPointerCapture(event.pointerId))app.canvas.releasePointerCapture(event.pointerId);panCursor();
  }
  function spaceDown(event:KeyboardEvent){if(event.code==='Space'){event.preventDefault();spaceHeld=true;panCursor();}}
  function spaceUp(event:KeyboardEvent){if(event.code==='Space'){spaceHeld=false;panCursor();}}
  function clearPan(){spaceHeld=false;if(panGesture&&app.canvas.hasPointerCapture(panGesture.id))app.canvas.releasePointerCapture(panGesture.id);panGesture=null;panCursor();}
  const gestures=cameraGestures(app.canvas,{
    cancelInteraction(){
      // A second finger cancels editor previews without committing them.
      if(drag)endDrag(new PointerEvent('pointercancel',{pointerId:drag.pointerId}));
      if(stroke)paintEnd(new PointerEvent('pointercancel',{pointerId:stroke.pointerId}));
      clearPan();
    },
    transform(from,to,factor){
      const rect=app.canvas.getBoundingClientRect();
      if(!rect.width||!rect.height)return;
      const point={x:(from.x-rect.left)*app.screen.width/rect.width,y:(from.y-rect.top)*app.screen.height/rect.height};
      const local=world.toLocal(point);
      zoomLevel=Math.max(.65,Math.min(3,zoomLevel*factor));fit();
      const moved=world.toGlobal(local);
      panX+=(to.x-rect.left)*app.screen.width/rect.width-moved.x;
      panY+=(to.y-rect.top)*app.screen.height/rect.height-moved.y;fit();
    }
  });
  app.canvas.addEventListener('pointerdown',panDown,true);
  window.addEventListener('pointermove',panMove,{capture:true,passive:false});window.addEventListener('pointerup',panEnd,true);window.addEventListener('pointercancel',panEnd,true);
  host.addEventListener('keydown',spaceDown);window.addEventListener('keyup',spaceUp);window.addEventListener('blur',clearPan);host.addEventListener('blur',clearPan);
  let stroke:{pointerId:number;brush:NonNullable<WorldEditor['brush']>;cells:Map<string,Cell>;last:Cell}|null=null;
  function paintCell(event:PointerEvent):Cell{
    const rect=app.canvas.getBoundingClientRect();const p=world.toLocal({x:(event.clientX-rect.left)*app.screen.width/rect.width,y:(event.clientY-rect.top)*app.screen.height/rect.height});
    // Pick the visible top surface, front to back, instead of the flat ground plane.
    for(let sum=scene.width+scene.height-2;sum>=0;sum--)for(let x=Math.max(0,sum-scene.height+1);x<=Math.min(scene.width-1,sum);x++){
      const y=sum-x;if(!hasTile(scene,{x,y}))continue;
      if(topContains(scene,{x,y},p))return {x,y};
    }
    return {x:Math.floor(p.x/64+p.y/32),y:Math.floor(p.y/32-p.x/64)};
  }
  function addPaint(cell:Cell){
    if(!stroke||cell.x<0||cell.y<0||cell.x>=scene.width||cell.y>=scene.height)return;
    const key=`${cell.x},${cell.y}`;stroke.cells.set(key,cell);
    if(!stroke.brush.includes(':'))tileDrawers.get(key)?.(stroke.brush==='erase'?defaultTile(scene,cell):stroke.brush as import('./types').TileKind|'void');
    else {const p=projectSurface(scene,cell);selection.poly([p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16]).fill({color:0x79b550,alpha:.4});}
  }
  function paintDown(event:PointerEvent){
    if(editor?.onpick||!editor?.brush||!editor.onpaint||event.button!==0||stroke)return;
    event.preventDefault();event.stopImmediatePropagation();host.focus({preventScroll:true});
    const cell=paintCell(event);stroke={pointerId:event.pointerId,brush:editor.brush,cells:new Map(),last:cell};
    app.canvas.setPointerCapture(event.pointerId);addPaint(cell);
  }
  function paintMove(event:PointerEvent){
    if(!stroke||stroke.pointerId!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();const cell=paintCell(event),last=stroke.last;
    const steps=Math.max(Math.abs(cell.x-last.x),Math.abs(cell.y-last.y));
    for(let i=1;i<=steps;i++)addPaint({x:Math.round(last.x+(cell.x-last.x)*i/steps),y:Math.round(last.y+(cell.y-last.y)*i/steps)});
    stroke.last=cell;
  }
  function paintEnd(event:PointerEvent){
    if(!stroke||stroke.pointerId!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();const finished=stroke;stroke=null;selection.clear();
    if(app.canvas.hasPointerCapture(event.pointerId))app.canvas.releasePointerCapture(event.pointerId);
    // Restore before committing, so a rejected stroke also leaves the preview unchanged.
    for(const [key,cell] of finished.cells)tileDrawers.get(key)?.(tileAt(scene,cell));
    if(event.type!=='pointercancel'&&finished.cells.size)editor?.onpaint?.([...finished.cells.values()],finished.brush);
  }
  function edgeAt(event:PointerEvent):Wall{
    const rect=app.canvas.getBoundingClientRect(),p=world.toLocal({x:(event.clientX-rect.left)*app.screen.width/rect.width,y:(event.clientY-rect.top)*app.screen.height/rect.height});
    const cell=paintCell(event),z=levelAt(scene,cell)*LEVEL_HEIGHT;const x=p.x/64+(p.y+z)/32,y=(p.y+z)/32-p.x/64;
    return Math.abs(x-Math.round(x))<Math.abs(y-Math.round(y))?{x:Math.round(x),y:Math.floor(y),axis:'y',kind:'wall'}:{x:Math.floor(x),y:Math.round(y),axis:'x',kind:'wall'};
  }
  function edgeHover(event:PointerEvent){
    wallPreview.clear();if(!editor?.wallTool)return;
    const w=edgeAt(event);if(!wallCells(w).some(p=>hasTile(scene,p)))return;
    const a=project(w),b=project({x:w.x+(w.axis==='x'?1:0),y:w.y+(w.axis==='y'?1:0)});a.y-=wallHeight(scene,w);b.y-=wallHeight(scene,w);
    wallPreview.moveTo(a.x,a.y).lineTo(b.x,b.y).stroke({color:editor.wallTool==='remove'?0xc86c58:0x719747,width:5});
  }
  function edgeDown(event:PointerEvent){
    if(!editor?.wallTool||event.button!==0||spaceHeld||panMode)return;
    event.preventDefault();event.stopImmediatePropagation();editor.onwall?.(edgeAt(event));
  }
  app.canvas.addEventListener('pointermove',edgeHover);
  app.canvas.addEventListener('pointerdown',edgeDown,true);
  app.canvas.addEventListener('pointerdown',paintDown,true);
  window.addEventListener('pointermove',paintMove,{capture:true,passive:false});
  window.addEventListener('pointerup',paintEnd,true);window.addEventListener('pointercancel',paintEnd,true);
  window.addEventListener('pointermove',dragMove,{passive:false});window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);
  if(editor)app.canvas.style.touchAction='none';
  highlight(editor?.selectedId??'');
  const player=createActor(0x728da5,true,art);const avatar=player.view;objects.addChild(avatar);
  const badge=new Text({text:'Tú',style:{fontFamily:'system-ui',fontSize:12,fontWeight:'600',fill:0x345249}});badge.anchor.set(.5,0);badge.y=14;badge.visible=false;badge.eventMode='none';labelLayer.addChild(badge);
  let playerHovered=false;avatar.eventMode='static';avatar.on('pointerover',event=>{if(event.pointerType!=='touch')playerHovered=true;});avatar.on('pointerout',()=>{playerHovered=false;});
  depthItems.push({view:avatar,bounds:()=>{const p=seatedAt?.seat?seatPlacement(seatedAt.seat):{x:px,y:py};return {x:p.x+.35,y:p.y+.35,width:.3,height:.3,tie:1};}});
  let lastDepth='',lastStaticDepth='';let staticOrder:number[]=[];
  const routeView=new Graphics();floor.addChild(routeView);
  let cell={...scene.spawn};let px=cell.x,py=cell.y;let route:Cell[]=[];let destination:WorldEntity|null=null;let zoomLevel=1;let cameraScale=1;let cameraBaseScale:number|undefined;let destroyed=false;
  let time=0,celebrationUntil=0,standingUntil=0;let facing:Facing='se';let working=false;let seatedAt:WorldEntity|null=null;let conversation:string|null=null;let purpose:'interact'|'work'='interact';
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit() {if(destroyed)return;const w=host.clientWidth,h=host.clientHeight;app.renderer.resize(w,h);const scale=(cameraBaseScale??Math.min(w/((scene.width+scene.height)*32+100),(h-55)/((scene.width+scene.height)*16+135+Math.max(0,...Object.values(scene.elevations??{}))*LEVEL_HEIGHT-minimumHeight)))*zoomLevel;world.scale.set(Math.max(.2,scale));cameraScale=world.scale.x;world.position.set(w/2-(scene.width-scene.height)*16*scale,h/2-(scene.width+scene.height)*8*scale+35*scale+panY);world.x+=panX;host.dataset.pan=`${Math.round(panX)},${Math.round(panY)}`;host.dataset.zoom=String(zoomLevel);host.dataset.scale=String(world.scale.x);}
  const observer=new ResizeObserver(fit);observer.observe(host);fit();
  function drawRoute() {routeView.clear();for(const c of route){const p=projectSurface(scene,{x:c.x+.5,y:c.y+.5});routeView.ellipse(p.x,p.y,4,2).fill({color:0x779d51,alpha:.65});}}
  let pendingArrival:WorldEntity|null=null;
  function arrive() {
    const target=destination;destination=null;
    if(target){
      if(target.seat && working && cell.x===target.seat.cell.x && cell.y===target.seat.cell.y){seatedAt=target;facing=target.seat.facing;}
      else if(target.interaction?.action==='adventure.exit')facing=exitFacing(scene,target);
      else facing=facingFor(target.position.x-cell.x,target.position.y-cell.y,facing);
      if(target.kind==='person')conversation=target.id;
    }
    onStatus(seatedAt?'En tu puesto de trabajo':'Has llegado');
    if(target&&purpose==='interact')pendingArrival=target;
  }
  function schedule(targets:Cell[],e:WorldEntity|null,reason:'interact'|'work'='interact') {
    pendingArrival=null;
    // Replan from the last reached tile, so rapid clicks cannot cut through obstacles.
    const nextTile=route[0];
    const path=findPath(scene,nextTile??cell,targets);if(path===null){onStatus('No hay un camino libre hasta ese lugar');return;}
    if(seatedAt)standingUntil=time+.3;seatedAt=null;conversation=null;purpose=reason;
    route=nextTile?[nextTile,...path]:path;destination=e;drawRoute();
    if(!route.length)arrive();else onStatus(e?`Caminando hacia ${e.label}…`:'Explorando el espacio…');
  }
  function moveTo(p:Cell) {selectedEntity='';refreshLabels();schedule([p],null);}
  function goTo(id:string) {const e=scene.entities.find(e=>e.id===id);if(e){selectedEntity=e.id;refreshLabels();if(e.interaction)schedule(interactionCells(scene,e),e);}}
  function keyboard(event:KeyboardEvent) {
    if(editor)return;
    const dirs:Record<string,Cell>={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};
    const d=dirs[event.key];
    if(d){event.preventDefault();if(!route.length)moveTo({x:cell.x+d.x,y:cell.y+d.y});}
    if(event.key==='Enter'){event.preventDefault();const e=scene.entities.find(e=>e.interaction&&interactionCells(scene,e).some(p=>p.x===cell.x&&p.y===cell.y));if(e)if(!editor&&!gestures.blocked())goTo(e.id);}
  }
  host.addEventListener('keydown',keyboard);
  app.ticker.add(tick=>{
    const dt=Math.min(tick.deltaMS,50)/1000;time+=dt;
    const next=time>=standingUntil?route[0]:undefined;
    if(next){facing=facingFor(next.x-px,next.y-py,facing);const distance=Math.hypot(next.x-px,next.y-py);const step=Math.min(tick.deltaMS,50)*.0045;if(distance<=step||reduceMotion){px=next.x;py=next.y;cell={...next};route.shift();drawRoute();if(!route.length)arrive();}else{px+=(next.x-px)/distance*step;py+=(next.y-py)/distance*step;}}
    const seated=seatedAt?.seat?seatPlacement(seatedAt.seat):null;
    badge.visible=playerHovered&&!seated;
    const actorPoint=projectSurface(scene,{x:px+.5,y:py+.5});
    const fadedGroups=new Set<string>();
    for(const {wall:w,group} of wallViews){
      const a=project(w),b=project({x:w.x+(w.axis==='x'?1:0),y:w.y+(w.axis==='y'?1:0)});a.y-=wallHeight(scene,w);b.y-=wallHeight(scene,w);
      const t=(actorPoint.x-a.x)/(b.x-a.x),base=a.y+(b.y-a.y)*t;
      const occludes=t>=-.2&&t<=1.2&&actorPoint.y<base&&actorPoint.y>base-85;
      if(occludes)fadedGroups.add(group);
    }
    for(const {wall,view,group} of wallViews){
      const opacity=editor?(editor.wallOpacity??.7):fadedGroups.has(group)?.22:1;
      const target=wall.kind==='wall'&&wall.material==='glass'?Math.min(opacity,.38):opacity;
      view.alpha+=(target-view.alpha)*Math.min(1,dt*10);
    }
    const drawX=seated?.x??px,drawY=seated?.y??py;
    const p=projectSurface(scene,{x:drawX+.5,y:drawY+.5});avatar.position.set(Math.round(p.x),Math.round(p.y));
    const bounds=depthItems.map(i=>i.bounds()),key=JSON.stringify(bounds);
    if(key!==lastDepth){const fixed=bounds.slice(0,-1),staticKey=JSON.stringify(fixed);if(staticKey!==lastStaticDepth){staticOrder=depthOrder(fixed);lastStaticDepth=staticKey;}insertMovingDepth(fixed,staticOrder,bounds.at(-1)!).forEach((index,z)=>depthItems[index].view.zIndex=z);lastDepth=key;}
    for(const [id,label] of labels){const view=entityViews.get(id);if(view)label.position.copyFrom(view.position);}
    badge.position.set(avatar.x,avatar.y+14);
    const pose:ActorPose=time<celebrationUntil?'celebrate':next?'walk':seatedAt?(working?'work':'sit'):conversation?'talk':'idle';
    player.update(time,dt,pose,facing,reduceMotion);
    for(const [id,actor] of occupants){const entity=scene.entities.find(e=>e.id===id)!;actor.update(time,dt,conversation===id?'talk':'idle',conversation===id?facingFor(px-entity.position.x,py-entity.position.y):'se',reduceMotion);}
    if(pendingArrival){const target=pendingArrival;pendingArrival=null;app.renderer.render(app.stage);onArrive(target);}
    host.dataset.pose=pose;host.dataset.facing=facing;host.dataset.cell=`${cell.x},${cell.y}`;

  });
  const displayedCompletion=new Map(scene.entities.map(e=>[e.id,!!e.completed]));
  return {
    setCompleted(ids:string[]){
      const completed=new Set(ids);
      for(const e of scene.entities){
        if(e.kind!=='goal'||e.interaction?.action==='adventure.exit'||displayedCompletion.get(e.id)===completed.has(e.id))continue;
        const view=entityViews.get(e.id);if(!view)continue;
        const updated=entityArt({...e,completed:completed.has(e.id)},outdoor,art,scene);
        for(const child of view.removeChildren())child.destroy({children:true});
        view.hitArea=updated.hitArea;view.addChild(...updated.removeChildren());updated.destroy();displayedCompletion.set(e.id,completed.has(e.id));
      }
    },
    setEditor(value:WorldEditor|undefined){editor=value;panCursor();highlight(editor?.selectedId??'');},
    goTo, zoom(delta:number){zoomLevel=Math.max(.65,Math.min(3,zoomLevel+delta));fit();},recenter(){cameraBaseScale=undefined;zoomLevel=1;panX=0;panY=0;fit();},
    setPanMode(enabled:boolean){panMode=enabled;panCursor();},
    panBy(x:number,y:number){panX+=x;panY+=y;fit();},
    getPan(){return {x:panX,y:panY};},
    getFacing(){return facing;},
    getCamera(){return {zoom:zoomLevel,scale:cameraScale};},
    restoreCamera(camera:{zoom:number;scale:number}){zoomLevel=camera.zoom;cameraBaseScale=camera.scale/camera.zoom;fit();},
    captureFrame(){app.renderer.render({container:app.stage});return app.canvas.toDataURL('image/png');},
    setFacing(value:Facing){facing=value;player.update(time,0,'idle',facing,reduceMotion);host.dataset.facing=facing;},
    setWorking(value:boolean){
      if(working===value)return;working=value;badge.text=working?'Tú · Trabajando':'Tú';
      if(value){const desk=scene.entities.find(e=>e.seat);if(desk?.seat)schedule([desk.seat.cell],desk,'work');}
      else {if(purpose==='work'){route=[];destination=null;drawRoute();}seatedAt=null;standingUntil=time+.3;}
    },
    celebrate(){celebrationUntil=time+1.5;seatedAt=null;conversation=null;route=[];destination=null;px=cell.x;py=cell.y;drawRoute();},
    setConversation(id:string|null){conversation=id;if(id){const e=scene.entities.find(e=>e.id===id);if(e)facing=facingFor(e.position.x-px,e.position.y-py,facing);}},
    destroy(){app.canvas.removeEventListener('pointermove',edgeHover);app.canvas.removeEventListener('pointerdown',edgeDown,true);gestures.destroy();app.canvas.removeEventListener('pointerdown',panDown,true);window.removeEventListener('pointermove',panMove,true);window.removeEventListener('pointerup',panEnd,true);window.removeEventListener('pointercancel',panEnd,true);host.removeEventListener('keydown',spaceDown);window.removeEventListener('keyup',spaceUp);window.removeEventListener('blur',clearPan);host.removeEventListener('blur',clearPan);app.canvas.removeEventListener('pointerdown',paintDown,true);window.removeEventListener('pointermove',paintMove,true);window.removeEventListener('pointerup',paintEnd,true);window.removeEventListener('pointercancel',paintEnd,true);window.removeEventListener('pointermove',dragMove);window.removeEventListener('pointerup',endDrag);window.removeEventListener('pointercancel',endDrag);destroyed=true;observer.disconnect();host.removeEventListener('keydown',keyboard);app.destroy(true,{children:true});}
  };
}
