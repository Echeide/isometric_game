import { Application, Container, Graphics, Text, Sprite, Polygon } from 'pixi.js';
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
function entityArt(e: WorldEntity, outdoor: boolean, art?:LoadedPixelArt) {
  const c = new Container(), drawing=new Container(); const g = new Graphics(); drawing.addChild(g);c.addChild(drawing);
  drawing.scale.x=e.flipX?-1:1;
  const footprintSize=e.size??{x:1,y:1};
  const size=e.flipX?{x:footprintSize.y,y:footprintSize.x}:footprintSize;
  const custom=art?pixelObject(art,e.visualId==='pixel.goal'&&e.completed&&art.pack.objects['pixel.goal-completed']?'pixel.goal-completed':e.visualId??''):null;
  if(custom){drawing.addChild(custom);}
  else if(e.kind === 'desk' || e.kind === 'table') {
    const wood = {top:0xd6b18a,left:0xad8462,right:0x967052};
    for (const [x,y] of [[.1,.1],[size.x-.15,.1],[.1,size.y-.15],[size.x-.15,size.y-.15]]) box(g,x,y,.09,.09,23,{top:0x51635f,left:0x52615d,right:0x374b47},23);
    box(g,0,0,size.x,size.y,5,wood,27);
    if(e.kind === 'desk') {
      box(g,.6,.28,.65,.12,23,{top:0x4d666b,left:0x293f49,right:0x1c323c},52);
      const p = project({x:.6,y:.4});
      poly(g,[p.x+3,p.y-49,p.x+19,p.y-41,p.x+19,p.y-25,p.x+3,p.y-33],0x91cbd0);
      box(g,.5,.7,.6,.25,1,{top:0xe4e9df,left:0x7f9690,right:0x7f9690},29);
      box(g,1.6,.3,.15,.15,7,{top:0xffffff,left:0xe7e4d8,right:0xd7dacc},34);
    } else box(g,.5,.4,.5,.4,2,{top:0xecefe4,left:0xbfc4b4,right:0xa9b5a6},30);
  } else if (e.kind === 'plant' || e.kind === 'tree') {
    const p = project({x:.5,y:.5});
    if(e.kind === 'tree') {
      box(g,.35,.35,.22,.22,35,{top:0x876b4a,left:0x796344,right:0x5e5138},35);
      for(const [x,y,r] of [[0,-58,25],[-15,-42,21],[17,-43,22],[0,-30,20]]) g.circle(p.x+x,p.y+y,r).fill(x<0?0x66886b:0x7b9e6c);
    } else {
      box(g,.2,.2,.6,.6,15,{top:0xe6ddd0,left:0xc6b4a0,right:0xa89580},15);
      g.moveTo(p.x,p.y-12).lineTo(p.x,p.y-48).stroke({color:0x427057,width:3});
      for(let i=0;i<5;i++) g.ellipse(p.x+(i%2?8:-8),p.y-22-i*5,10,5).fill(i%2?0x5f8b68:0x83a97b);
    }
  } else if(e.kind==='person') {
    // Animated occupants are added by the scene controller.
  } else if(e.kind==='board') {
    box(g,.1,.35,.08,.15,50,palette,50); box(g,2.6,.35,.08,.15,50,palette,50);
    box(g,0,.3,2.9,.13,43,{top:0x77938b,left:0xf4f5ee,right:0xa6b9b1},80);
    for(let i=0;i<3;i++) for(let j=0;j<2;j++) box(g,.3+i*.8,.44,.48,.01,9,{top:0xffffff,left:[0xbbd3ed,0xf1d99b,0xbcd7a6][i],right:0xb0c2b1},69-j*15);
  } else if(e.kind==='sofa') {
    const colors={top:0x759a8b,left:0x618678,right:0x446f61};
    box(g,0,0,size.x,size.y,15,colors,18);
    box(g,0,0,size.x,.25,22,colors,38);
    box(g,0,0,.25,size.y,15,colors,30);box(g,size.x-.25,0,.25,size.y,15,colors,30);
  } else if(e.kind==='goal') {
    const p=project({x:.5,y:.5});
    box(g,0,0,1,1,10,{top:e.completed?0xa6c877:0xd8d9c5,left:0x879e78,right:0x6c8769},3);
    g.moveTo(p.x,p.y-6).lineTo(p.x,p.y-65).stroke({color:0x5d7768,width:4});
    g.poly([p.x+2,p.y-65,p.x+29,p.y-58,p.x+2,p.y-48]).fill(e.completed?0xaada66:e.color??0xebad64);
    if(e.completed) g.moveTo(p.x+6,p.y-58).lineTo(p.x+10,p.y-53).lineTo(p.x+18,p.y-59).stroke({color:0x32583a,width:2});
  }
  if(e.interaction) {
    const p=project({x:footprintSize.x/2,y:footprintSize.y/2});
    const label=new Text({text:e.label,style:{fontFamily:'system-ui',fontSize:12,fontWeight:'600',fill:outdoor?0x385648:0x344a4e}});
    label.anchor.set(.5,0); label.position.set(p.x,p.y+15);
    const back=new Graphics().roundRect(p.x-label.width/2-8,p.y+12,label.width+16,23,7).fill({color:0xffffff,alpha:.92});
    c.addChild(back,label);
  }
  return c;
}
export async function createWorld(host: HTMLElement, scene: WorldScene, onArrive: (e: WorldEntity) => void, onStatus: (s:string) => void, initialEditor?: WorldEditor, graphics?:PixelArtPack) {
  const art=graphics?await loadPixelArt(graphics):undefined;
  const app = new Application();
  await app.init({backgroundAlpha:0,antialias:!art,resolution:Math.min(window.devicePixelRatio||1,2),autoDensity:true,width:host.clientWidth,height:host.clientHeight});
  host.appendChild(app.canvas);
  const world=new Container(); const floor=new Container(); const objects=new Container(); objects.sortableChildren=true;
  world.addChild(floor,objects); app.stage.addChild(world);
  let editor=initialEditor;
  const outdoor=scene.theme==='outdoors';
  const foundation = new Graphics();
  box(foundation,0,0,scene.width,scene.height,18,outdoor?{top:0xb5cba4,left:0x8d9e78,right:0x768b69}:palette);
  floor.addChild(foundation);
  const tileDrawers=new Map<string,(kind:import('./types').TileKind)=>void>();
  for(let x=0;x<scene.width;x++) for(let y=0;y<scene.height;y++) {
    const p=project({x,y}); const tile=new Graphics();
    let textureTile:Sprite|undefined;
    const drawTile=(kind:import('./types').TileKind)=>{
      tile.clear();
      if(art){
        const texture=art.textures.get(art.pack.tiles[kind])!;
        if(!textureTile){textureTile=new Sprite(texture);textureTile.position.set(p.x-32,p.y);textureTile.width=64;textureTile.height=32;textureTile.eventMode='none';textureTile.roundPixels=true;tile.addChild(textureTile);}
        else textureTile.texture=texture;
      }else poly(tile,[p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16],kind==='office'?0xdee6df:kind==='grass'?0xb7cda6:0xdacfb0);
      tile.hitArea=new Polygon([p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16]);
    };
    drawTile(tileAt(scene,{x,y}));tileDrawers.set(`${x},${y}`,drawTile);
    if(walkable(scene,{x,y})) {
      tile.eventMode='static';tile.cursor='pointer';
      tile.on('pointertap',()=>{host.focus({preventScroll:true});if(!editor)moveTo({x,y});});
      tile.on('pointerover',()=>{tile.tint=0xd0e8b6;});tile.on('pointerout',()=>{tile.tint=0xffffff;});
    }
    floor.addChild(tile);
  }
  if(!outdoor) {
    const walls=new Graphics();
    box(walls,0,0,scene.width,.12,65,{top:0xf1f2e7,left:0xc1d2cd,right:0xb3c6c0},65);
    box(walls,0,0,.12,scene.height,65,{top:0xf1f2e7,left:0xd4ded5,right:0xb2c8c1},65);
    // Windows are functional scene geometry, rendered with the room.
    for(let i=2;i<scene.width-1;i+=3) box(walls,i,.14,1.8,.02,36,{top:0xf5f9ee,left:0xa0c7cf,right:0x739da7},53);
    floor.addChild(walls);
  }
  const entityViews=new Map<string,Container>();
  const occupants=new Map<string,ReturnType<typeof createActor>>();
  for(const e of scene.entities) {
    const view=entityArt(e,outdoor,art);const p=project(e.position);view.position.set(p.x,p.y);view.zIndex=(e.position.x+e.position.y+(e.size?.x??1)/2+(e.size?.y??1)/2)*100;
    {view.eventMode='static';view.cursor='pointer';view.on('pointertap',()=>{host.focus({preventScroll:true});if(!editor)goTo(e.id);});view.on('pointerover',()=>{view.alpha=.8;});view.on('pointerout',()=>{view.alpha=1;});}
    if(e.kind==='person'){const actor=createActor(e.color??0xd79875,false,e.visualId==='pixel.person'?art:undefined);const at=project({x:.5,y:.5});actor.view.position.set(at.x,at.y);actor.view.scale.x=e.flipX?-1:1;view.addChildAt(actor.view,0);occupants.set(e.id,actor);}
    if(e.seat){
      const placement=seatPlacement(e.seat),p=project(placement);
      const base=art?pixelObject(art,'pixel.chair-base'):null;
      const back=art?pixelObject(art,`pixel.chair-back-${e.seat.facing}`):null;
      if(base&&back){
        for(const [sprite,z] of [[base,0],[back,placement.backInFront?2:0]] as const){
          const layer=new Container();layer.position.set(p.x,p.y);layer.addChild(sprite);
          layer.zIndex=(placement.x+placement.y+1)*100+z;objects.addChild(layer);
        }
      }else{
        const chair=new Graphics();const x=placement.x,y=placement.y;
        box(chair,x+.15,y+.15,.7,.7,6,{top:0x86a39a,left:0x577a6b,right:0x456b60},19);
        box(chair,x+.15,y+(e.seat.facing==='ne'?.75:.15),.65,.1,17,{top:0x86a39a,left:0x577a6b,right:0x456b60},37);
        objects.addChild(chair);chair.zIndex=(x+y+1)*100;
      }
    }
    view.on('pointerdown',event=>{
      if(!editor || event.button!==0 || drag)return;
      host.focus({preventScroll:true});editor.onselect(e.id);
      const start=world.toLocal(event.global);
      drag={id:e.id,pointerId:event.pointerId,start,original:{...e.position},position:{...e.position}};
      app.canvas.setPointerCapture(event.pointerId);view.cursor='grabbing';
      highlight(e.id,e.position);
    });
    objects.addChild(view);entityViews.set(e.id,view);
  }
  const selection=new Graphics();selection.eventMode='none';floor.addChild(selection);
  let drag:{id:string;pointerId:number;start:{x:number;y:number};original:Cell;position:Cell}|null=null;
  function highlight(id:string,position?:Cell){
    selection.clear();
    for(const [key,view]of entityViews){view.tint=editor&&key===id?0xe3ffc8:0xffffff;view.cursor=editor?'grab':scene.entities.find(e=>e.id===key)?.interaction?'pointer':'default';}
    host.dataset.selected=editor?id:'';
    const e=scene.entities.find(e=>e.id===id);if(!e||!editor)return;
    const p=project(position??e.position),w=(e.size?.x??1)*32,h=(e.size?.y??1)*32;
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
    const at=project(drag.position);entityViews.get(drag.id)?.position.set(at.x,at.y);highlight(drag.id,drag.position);
  }
  function endDrag(event:PointerEvent){
    if(!drag||event.pointerId!==drag.pointerId)return;
    const finished=drag;drag=null;
    if(app.canvas.hasPointerCapture(event.pointerId))app.canvas.releasePointerCapture(event.pointerId);
    const at=project(finished.original);entityViews.get(finished.id)?.position.set(at.x,at.y);
    highlight(finished.id,finished.original);
    if(event.type!=='pointercancel'&&(finished.position.x!==finished.original.x||finished.position.y!==finished.original.y))editor?.onmove(finished.id,finished.position);
  }
  let panX=0,panY=0,panMode=false,spaceHeld=false;
  let panGesture:{id:number;x:number;y:number}|null=null;
  function panCursor(){app.canvas.style.setProperty('cursor',panGesture?'grabbing':panMode||spaceHeld?'grab':'auto',panGesture||panMode||spaceHeld?'important':'');app.canvas.style.touchAction=editor||panMode?'none':'';}
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
  app.canvas.addEventListener('pointerdown',panDown,true);
  window.addEventListener('pointermove',panMove,{capture:true,passive:false});window.addEventListener('pointerup',panEnd,true);window.addEventListener('pointercancel',panEnd,true);
  host.addEventListener('keydown',spaceDown);window.addEventListener('keyup',spaceUp);window.addEventListener('blur',clearPan);host.addEventListener('blur',clearPan);
  let stroke:{pointerId:number;brush:NonNullable<WorldEditor['brush']>;cells:Map<string,Cell>;last:Cell}|null=null;
  function paintCell(event:PointerEvent):Cell{
    const rect=app.canvas.getBoundingClientRect();const p=world.toLocal({x:(event.clientX-rect.left)*app.screen.width/rect.width,y:(event.clientY-rect.top)*app.screen.height/rect.height});
    return {x:Math.floor(p.x/64+p.y/32),y:Math.floor(p.y/32-p.x/64)};
  }
  function addPaint(cell:Cell){
    if(!stroke||cell.x<0||cell.y<0||cell.x>=scene.width||cell.y>=scene.height)return;
    const key=`${cell.x},${cell.y}`;stroke.cells.set(key,cell);
    tileDrawers.get(key)?.(stroke.brush==='erase'?defaultTile(scene,cell):stroke.brush);
  }
  function paintDown(event:PointerEvent){
    if(!editor?.brush||!editor.onpaint||event.button!==0||stroke)return;
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
    event.preventDefault();event.stopImmediatePropagation();const finished=stroke;stroke=null;
    if(app.canvas.hasPointerCapture(event.pointerId))app.canvas.releasePointerCapture(event.pointerId);
    // Restore before committing, so a rejected stroke also leaves the preview unchanged.
    for(const [key,cell] of finished.cells)tileDrawers.get(key)?.(tileAt(scene,cell));
    if(event.type!=='pointercancel'&&finished.cells.size)editor?.onpaint?.([...finished.cells.values()],finished.brush);
  }
  app.canvas.addEventListener('pointerdown',paintDown,true);
  window.addEventListener('pointermove',paintMove,{capture:true,passive:false});
  window.addEventListener('pointerup',paintEnd,true);window.addEventListener('pointercancel',paintEnd,true);
  window.addEventListener('pointermove',dragMove,{passive:false});window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);
  if(editor)app.canvas.style.touchAction='none';
  highlight(editor?.selectedId??'');
  const player=createActor(0x728da5,true,art);const avatar=player.view;objects.addChild(avatar);
  const badge=new Text({text:'Tú',style:{fontFamily:'system-ui',fontSize:12,fontWeight:'600',fill:0x345249}});badge.anchor.set(.5,0);badge.y=14;avatar.addChild(badge);
  const routeView=new Graphics();floor.addChild(routeView);
  let cell={...scene.spawn};let px=cell.x,py=cell.y;let route:Cell[]=[];let destination:WorldEntity|null=null;let zoomLevel=1;let destroyed=false;
  let time=0,celebrationUntil=0,standingUntil=0;let facing:Facing='se';let working=false;let seatedAt:WorldEntity|null=null;let conversation:string|null=null;let purpose:'interact'|'work'='interact';
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit() {if(destroyed)return;const w=host.clientWidth,h=host.clientHeight;app.renderer.resize(w,h);const scale=Math.min(w/((scene.width+scene.height)*32+100),(h-55)/((scene.width+scene.height)*16+135))*zoomLevel;world.scale.set(Math.max(.2,scale));world.position.set(w/2-(scene.width-scene.height)*16*scale,h/2-(scene.width+scene.height)*8*scale+35*scale+panY);world.x+=panX;host.dataset.pan=`${Math.round(panX)},${Math.round(panY)}`;}
  const observer=new ResizeObserver(fit);observer.observe(host);fit();
  function drawRoute() {routeView.clear();for(const c of route){const p=project({x:c.x+.5,y:c.y+.5});routeView.ellipse(p.x,p.y,4,2).fill({color:0x779d51,alpha:.65});}}
  function arrive() {
    const target=destination;destination=null;
    if(target){
      if(target.seat && working && cell.x===target.seat.cell.x && cell.y===target.seat.cell.y){seatedAt=target;facing=target.seat.facing;}
      else facing=facingFor(target.position.x-cell.x,target.position.y-cell.y,facing);
      if(target.kind==='person')conversation=target.id;
    }
    onStatus(seatedAt?'En tu puesto de trabajo':'Has llegado');
    if(target&&purpose==='interact')onArrive(target);
  }
  function schedule(targets:Cell[],e:WorldEntity|null,reason:'interact'|'work'='interact') {
    // Replan from the last reached tile, so rapid clicks cannot cut through obstacles.
    const nextTile=route[0];
    const path=findPath(scene,nextTile??cell,targets);if(path===null){onStatus('No hay un camino libre hasta ese lugar');return;}
    if(seatedAt)standingUntil=time+.3;seatedAt=null;conversation=null;purpose=reason;
    route=nextTile?[nextTile,...path]:path;destination=e;drawRoute();
    if(!route.length)arrive();else onStatus(e?`Caminando hacia ${e.label}…`:'Explorando el espacio…');
  }
  function moveTo(p:Cell) {schedule([p],null);}
  function goTo(id:string) {const e=scene.entities.find(e=>e.id===id);if(e?.interaction)schedule(interactionCells(scene,e),e);}
  function keyboard(event:KeyboardEvent) {
    if(editor)return;
    const dirs:Record<string,Cell>={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};
    const d=dirs[event.key];
    if(d){event.preventDefault();if(!route.length)moveTo({x:cell.x+d.x,y:cell.y+d.y});}
    if(event.key==='Enter'){event.preventDefault();const e=scene.entities.find(e=>e.interaction&&interactionCells(scene,e).some(p=>p.x===cell.x&&p.y===cell.y));if(e)if(!editor)goTo(e.id);}
  }
  host.addEventListener('keydown',keyboard);
  app.ticker.add(tick=>{
    const dt=Math.min(tick.deltaMS,50)/1000;time+=dt;
    const next=time>=standingUntil?route[0]:undefined;
    if(next){facing=facingFor(next.x-px,next.y-py,facing);const distance=Math.hypot(next.x-px,next.y-py);const step=Math.min(tick.deltaMS,50)*.0045;if(distance<=step||reduceMotion){px=next.x;py=next.y;cell={...next};route.shift();drawRoute();if(!route.length)arrive();}else{px+=(next.x-px)/distance*step;py+=(next.y-py)/distance*step;}}
    const seated=seatedAt?.seat?seatPlacement(seatedAt.seat):null;
    badge.visible=!seated;
    const drawX=seated?.x??px,drawY=seated?.y??py;
    const p=project({x:drawX+.5,y:drawY+.5});avatar.position.set(art?Math.round(p.x):p.x,art?Math.round(p.y):p.y);avatar.zIndex=(drawX+drawY+1)*100+1;
    const pose:ActorPose=time<celebrationUntil?'celebrate':next?'walk':seatedAt?(working?'work':'sit'):conversation?'talk':'idle';
    player.update(time,dt,pose,facing,reduceMotion);
    for(const [id,actor] of occupants){const entity=scene.entities.find(e=>e.id===id)!;actor.update(time,dt,conversation===id?'talk':'idle',conversation===id?facingFor(px-entity.position.x,py-entity.position.y):'se',reduceMotion);}
    host.dataset.pose=pose;host.dataset.facing=facing;host.dataset.cell=`${cell.x},${cell.y}`;

  });
  return {
    setEditor(value:WorldEditor|undefined){editor=value;panCursor();highlight(editor?.selectedId??'');},
    goTo, zoom(delta:number){zoomLevel=Math.max(.65,Math.min(1.6,zoomLevel+delta));fit();},recenter(){zoomLevel=1;panX=0;panY=0;fit();},
    setPanMode(enabled:boolean){panMode=enabled;panCursor();},
    panBy(x:number,y:number){panX+=x;panY+=y;fit();},
    getPan(){return {x:panX,y:panY};},
    setWorking(value:boolean){
      if(working===value)return;working=value;badge.text=working?'Tú · Trabajando':'Tú';
      if(value){const desk=scene.entities.find(e=>e.seat);if(desk?.seat)schedule([desk.seat.cell],desk,'work');}
      else {if(purpose==='work'){route=[];destination=null;drawRoute();}seatedAt=null;standingUntil=time+.3;}
    },
    celebrate(){celebrationUntil=time+1.5;seatedAt=null;conversation=null;route=[];destination=null;px=cell.x;py=cell.y;drawRoute();},
    setConversation(id:string|null){conversation=id;if(id){const e=scene.entities.find(e=>e.id===id);if(e)facing=facingFor(e.position.x-px,e.position.y-py,facing);}},
    destroy(){app.canvas.removeEventListener('pointerdown',panDown,true);window.removeEventListener('pointermove',panMove,true);window.removeEventListener('pointerup',panEnd,true);window.removeEventListener('pointercancel',panEnd,true);host.removeEventListener('keydown',spaceDown);window.removeEventListener('keyup',spaceUp);window.removeEventListener('blur',clearPan);host.removeEventListener('blur',clearPan);app.canvas.removeEventListener('pointerdown',paintDown,true);window.removeEventListener('pointermove',paintMove,true);window.removeEventListener('pointerup',paintEnd,true);window.removeEventListener('pointercancel',paintEnd,true);window.removeEventListener('pointermove',dragMove);window.removeEventListener('pointerup',endDrag);window.removeEventListener('pointercancel',endDrag);destroyed=true;observer.disconnect();host.removeEventListener('keydown',keyboard);app.destroy(true,{children:true});}
  };
}
