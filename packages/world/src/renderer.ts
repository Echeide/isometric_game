import {shouldFollow,mobileCamera} from './follow-camera';
import {prepareWallOcclusion,wallOccludesActor} from './wall-occlusion';
import 'pixi.js/prepare';
import {advanceRoute} from './movement';
import {environments} from './environments';
import {terrainCellAt,topContains,levelAt,stairAt,stairDirections,STAIR_STEPS,LEVEL_HEIGHT,projectSurface,surfaceHeight,wallHeight} from './elevation';
import {exitFacing} from './exits';
import {alphaHitArea} from './alpha-hit';
import {depthOrder,movingDepthIndex,type DepthItem} from './depth';
import {sceneWalls,wallCells,hasTile,wallEndExposed} from './walls';
import type {Wall} from './types';
import { cameraGestures } from './camera-gestures';
import { Application, Container, Graphics, Text, Sprite, Polygon, Rectangle } from 'pixi.js';
import { loadPixelArt, pixelObject, type LoadedPixelArt, type PixelArtPack } from './pixelart';
import { createActor, facingFor } from './actor';
import {tileAt,defaultTile} from './terrain';
import { seatPlacement } from './seating';
import type { WorldEditor, ActorPose, Facing, Cell, WorldEntity, WorldScene } from './types';
import { createNavigator, interactionCells, project, walkable } from './navigation';

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
export async function createWorld(host: HTMLElement, scene: WorldScene, onArrive: (e: WorldEntity) => void, onStatus: (s:string) => void, initialEditor: WorldEditor|undefined, graphics:PixelArtPack,existingApp?:Application) {
  const art=await loadPixelArt(graphics);
  const navigation=createNavigator(scene);
  const app = existingApp??new Application();
  if(!existingApp){
  const touchDevice=window.matchMedia('(pointer: coarse)').matches;
  await app.init({backgroundAlpha:0,antialias:false,resolution:Math.min(window.devicePixelRatio||1,touchDevice?1.5:2),autoDensity:true,width:host.clientWidth,height:host.clientHeight});
  if(touchDevice)app.ticker.maxFPS=60;
  host.appendChild(app.canvas);
  }
  const world=new Container(); const floor=new Container(); const objects=new Container(); objects.sortableChildren=true;
  const labelLayer=new Container();labelLayer.eventMode='none';
  world.addChild(floor,objects,labelLayer);
  let editor=initialEditor;
  let paused=false;
  const environment=environments[scene.theme];
  const outdoor=environment.outdoor;
  const groundPalette=environment.ground;
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
    let grassLight:Graphics|undefined;
    const drawTile=(kind:import('./types').TileKind|'void')=>{
      tile.clear();
      if(textureTile)textureTile.visible=kind!=='void';
      if(kind==='void'){if(editor)tile.poly([p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16]).stroke({color:0x829d7a,alpha:.25,width:1});return;}
      if(z>minimumHeight)box(tile,x,y,1,1,z-minimumHeight,groundPalette,z);
      {
        const texture=art.textures.get(art.pack.tiles[kind])!;
        if(!textureTile){textureTile=new Sprite(texture);textureTile.position.set(p.x-32,p.y);textureTile.width=64;textureTile.height=32;textureTile.eventMode='none';textureTile.roundPixels=true;tile.addChild(textureTile);}
        else textureTile.texture=texture;
        // Lighten the grass top without lifting the darker vertical faces.
        if(!grassLight){grassLight=new Graphics().poly([32,0,64,16,32,32,0,16]).fill({color:0xfff9df,alpha:.30});grassLight.eventMode='none';textureTile.addChild(grassLight);}
        grassLight.visible=kind==='grass';
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
  const exitBadges=new Map<string,Graphics>();
  let lastIndicators='';
  const hovered=new Set<string>();
  let hiddenEntities=new Set<string>();
  let selectedEntity=editor?.selectedId??'';
  function refreshLabels(){for(const [id,label] of labels)label.visible=!hiddenEntities.has(id)&&(id===selectedEntity||hovered.has(id));}
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
  let followEnabled=false,followSuspended=false,followInitialized=false,fitScale=1;
  let panGesture:{id:number;x:number;y:number}|null=null;
  function panCursor(){app.canvas.style.setProperty('cursor',panGesture?'grabbing':panMode||spaceHeld?'grab':'auto',panGesture||panMode||spaceHeld?'important':'');app.canvas.style.touchAction='none';}
  function isMapBackground(event:PointerEvent){
    const rect=app.canvas.getBoundingClientRect();
    const screen={x:(event.clientX-rect.left)*app.screen.width/rect.width,y:(event.clientY-rect.top)*app.screen.height/rect.height};
    const local=world.toLocal(screen),cell=terrainCellAt(scene,local);
    if(hasTile(scene,cell))return false;
    // Preserve painting empty cells inside the editor's working rectangle.
    if(editor?.brush){const base=terrainCellAt(scene,local,true);if(base.x>=0&&base.y>=0&&base.x<scene.width&&base.y<scene.height)return false;}
    // Tall objects/walls may protrude past the floor silhouette.
    for(const view of [...entityViews.values(),...wallViews.map(w=>w.view)]){
      if(!view.visible)continue;const b=view.getBounds();if(screen.x>=b.x&&screen.y>=b.y&&screen.x<=b.x+b.width&&screen.y<=b.y+b.height)return false;
    }
    if(avatar.visible){const b=avatar.getBounds();if(screen.x>=b.x&&screen.y>=b.y&&screen.x<=b.x+b.width&&screen.y<=b.y+b.height)return false;}
    return true;
  }
  function panDown(event:PointerEvent){
    if(panGesture||drag||stroke||!(event.button===1||(event.button===0&&(panMode||spaceHeld||isMapBackground(event)))))return;
    event.preventDefault();event.stopImmediatePropagation();host.focus({preventScroll:true});
    followSuspended=true;panGesture={id:event.pointerId,x:event.clientX,y:event.clientY};app.canvas.setPointerCapture(event.pointerId);panCursor();
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
      followSuspended=true;const local=world.toLocal(point);
      zoomLevel=Math.max(.65,Math.min(3,zoomLevel*factor));fit();
      const moved=world.toGlobal(local);
      panX+=(to.x-rect.left)*app.screen.width/rect.width-moved.x;
      panY+=(to.y-rect.top)*app.screen.height/rect.height-moved.y;fit();
    }
  });
  app.canvas.addEventListener('pointerdown',panDown,true);
  window.addEventListener('pointermove',panMove,{capture:true,passive:false});window.addEventListener('pointerup',panEnd,true);window.addEventListener('pointercancel',panEnd,true);
  host.addEventListener('keydown',spaceDown);window.addEventListener('keyup',spaceUp);window.addEventListener('blur',clearPan);host.addEventListener('blur',clearPan);
  const levelBrush=()=>!!editor?.brush&&(editor.brush.startsWith('height:')||editor.brush.startsWith('stairs:'));
  const baseBrush=()=>!!editor?.brush?.startsWith('height:');
  const zeroGrid=new Graphics();zeroGrid.eventMode='none';world.addChild(zeroGrid);
  for(let x=0;x<=scene.width;x++){const a=project({x,y:0}),b=project({x,y:scene.height});zeroGrid.moveTo(a.x,a.y).lineTo(b.x,b.y);}
  for(let y=0;y<=scene.height;y++){const a=project({x:0,y}),b=project({x:scene.width,y});zeroGrid.moveTo(a.x,a.y).lineTo(b.x,b.y);}
  zeroGrid.stroke({color:0x47663c,alpha:.22,width:1});zeroGrid.visible=baseBrush();
  const paintHover=new Graphics();paintHover.eventMode='none';world.addChild(paintHover);
  const levelHint=new Text({text:'',style:{fontFamily:'system-ui',fontSize:12,fontWeight:'600',fill:0x284333,stroke:{color:0xffffff,width:4}}});levelHint.anchor.set(.5,1);levelHint.eventMode='none';levelHint.visible=false;world.addChild(levelHint);
  function showLevel(cell:Cell){levelHint.visible=levelBrush();if(!levelHint.visible)return;const p=baseBrush()?project(cell):projectSurface(scene,cell),level=levelAt(scene,cell);levelHint.text=hasTile(scene,cell)?`Nivel ${level>0?'+':''}${level}`:'Vacío';levelHint.position.set(p.x,p.y-6);}
  function hoverTerrain(event:PointerEvent){
    if(stroke)return;paintHover.clear();levelHint.visible=false;if(!editor?.brush||panMode||spaceHeld)return;
    const cell=paintCell(event);if(cell.x<0||cell.y<0||cell.x>=scene.width||cell.y>=scene.height)return;
    const p=baseBrush()?project(cell):projectSurface(scene,cell);showLevel(cell);
    paintHover.poly([p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16]).fill({color:0xa9df6c,alpha:.3}).stroke({color:0x356225,width:2});
  }
  const leaveTerrain=()=>{paintHover.clear();levelHint.visible=false;};
  app.canvas.addEventListener('pointermove',hoverTerrain);app.canvas.addEventListener('pointerleave',leaveTerrain);
  let stroke:{pointerId:number;brush:NonNullable<WorldEditor['brush']>;cells:Map<string,Cell>;last:Cell}|null=null;
  function paintCell(event:PointerEvent):Cell{
    const rect=app.canvas.getBoundingClientRect();const p=world.toLocal({x:(event.clientX-rect.left)*app.screen.width/rect.width,y:(event.clientY-rect.top)*app.screen.height/rect.height});
    return terrainCellAt(scene,p,baseBrush());
  }
  function addPaint(cell:Cell){
    if(!stroke||cell.x<0||cell.y<0||cell.x>=scene.width||cell.y>=scene.height)return;
    const key=`${cell.x},${cell.y}`;stroke.cells.set(key,cell);
    if(!stroke.brush.includes(':'))tileDrawers.get(key)?.(stroke.brush==='erase'?defaultTile(scene,cell):stroke.brush as import('./types').TileKind|'void');
    else {const p=baseBrush()?project(cell):projectSurface(scene,cell);showLevel(cell);paintHover.poly([p.x,p.y,p.x+32,p.y+16,p.x,p.y+32,p.x-32,p.y+16]).fill({color:0x79b550,alpha:.4});}
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
    event.preventDefault();event.stopImmediatePropagation();const finished=stroke;stroke=null;selection.clear();paintHover.clear();levelHint.visible=false;
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
  const player=createActor(0x728da5,true,art);const avatar=player.view;objects.addChild(avatar);avatar.visible=!editor;
  const badge=new Text({text:'Tú',style:{fontFamily:'system-ui',fontSize:12,fontWeight:'600',fill:0x345249}});badge.anchor.set(.5,0);badge.y=14;badge.visible=false;badge.eventMode='none';labelLayer.addChild(badge);
  let playerHovered=false;avatar.eventMode=editor?'none':'static';avatar.on('pointerover',event=>{if(event.pointerType!=='touch')playerHovered=true;});avatar.on('pointerout',()=>{playerHovered=false;});
  depthItems.push({view:avatar,bounds:()=>{const p=seatedAt?.seat?seatPlacement(seatedAt.seat):{x:px,y:py};return {x:p.x+.35,y:p.y+.35,width:.3,height:.3,tie:1};}});
  let lastDepth='',lastDragDepth='';let fixedDepth:DepthItem[]=[];let staticOrder:number[]=[];
  const routeView=new Graphics();floor.addChild(routeView);
  let cell={...scene.spawn};let px=cell.x,py=cell.y;let route:Cell[]=[];let destination:WorldEntity|null=null;let zoomLevel=1;let cameraScale=1;let cameraBaseScale:number|undefined;let destroyed=false;
  let time=0,celebrationUntil=0,standingUntil=0;let facing:Facing='se';let working=false;let seatedAt:WorldEntity|null=null;let conversation:string|null=null;let purpose:'interact'|'work'='interact';
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit() {if(destroyed)return;const w=host.clientWidth,h=host.clientHeight;if(app.screen.width!==w||app.screen.height!==h)app.renderer.resize(w,h);fitScale=Math.min(w/((scene.width+scene.height)*32+100),(h-55)/((scene.width+scene.height)*16+135+Math.max(0,...Object.values(scene.elevations??{}))*LEVEL_HEIGHT-minimumHeight));const scale=(cameraBaseScale??fitScale)*zoomLevel;world.scale.set(Math.max(.2,scale));cameraScale=world.scale.x;world.position.set(w/2-(scene.width-scene.height)*16*scale,h/2-(scene.width+scene.height)*8*scale+35*scale+panY);world.x+=panX;host.dataset.pan=`${Math.round(panX)},${Math.round(panY)}`;host.dataset.zoom=String(zoomLevel);host.dataset.scale=String(world.scale.x);}
  function followPlayer(snap=false,dt=0){
    const active=shouldFollow(followEnabled,!!editor,followSuspended||!!panGesture||gestures.blocked(),cameraScale,fitScale);
    host.dataset.follow=active?'active':followSuspended?'paused':'off';
    if(!active)return;
    const point=projectSurface(scene,{x:px+.5,y:py+.5});
    const targetX=app.screen.width/2-point.x*cameraScale;
    // Centre the body rather than the feet, leaving room for the mobile HUD.
    const targetY=app.screen.height/2-(point.y-28)*cameraScale;
    const amount=snap||reduceMotion?1:1-Math.exp(-dt*10);
    const dx=(targetX-world.x)*amount,dy=(targetY-world.y)*amount;
    panX+=dx;panY+=dy;world.x+=dx;world.y+=dy;
    host.dataset.pan=`${Math.round(panX)},${Math.round(panY)}`;
  }
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
    const path=navigation.findPath(nextTile??cell,targets);if(path===null){onStatus('No hay un camino libre hasta ese lugar');return;}
    followSuspended=false;
    if(seatedAt)standingUntil=time+.3;seatedAt=null;conversation=null;purpose=reason;
    route=nextTile?[nextTile,...path]:path;destination=e;drawRoute();
    if(!route.length)arrive();else onStatus(e?`Caminando hacia ${e.label}…`:'Explorando el espacio…');
  }
  function moveTo(p:Cell) {selectedEntity='';refreshLabels();schedule([p],null);}
  function goTo(id:string) {if(hiddenEntities.has(id))return;const e=scene.entities.find(e=>e.id===id);if(e){selectedEntity=e.id;refreshLabels();if(e.interaction||e.description)schedule(interactionCells(scene,e),e);}}
  function keyboard(event:KeyboardEvent) {
    if(editor)return;
    const dirs:Record<string,Cell>={ArrowUp:{x:0,y:-1},w:{x:0,y:-1},ArrowDown:{x:0,y:1},s:{x:0,y:1},ArrowLeft:{x:-1,y:0},a:{x:-1,y:0},ArrowRight:{x:1,y:0},d:{x:1,y:0}};
    const d=dirs[event.key];
    if(d){event.preventDefault();if(!route.length)moveTo({x:cell.x+d.x,y:cell.y+d.y});}
    if(event.key==='Enter'){event.preventDefault();const e=scene.entities.find(e=>!hiddenEntities.has(e.id)&&(e.interaction||e.description)&&interactionCells(scene,e).some(p=>p.x===cell.x&&p.y===cell.y));if(e)if(!editor&&!gestures.blocked())goTo(e.id);}
  }
  host.addEventListener('keydown',keyboard);
  const wallOccluders=wallViews.map(({wall,group})=>({...prepareWallOcclusion(scene,wall),group}));
  const fadedGroups=new Set<string>();
  let occlusionX=NaN,occlusionY=NaN,occlusionCellX=NaN,occlusionCellY=NaN;
  const occupantActors=[...occupants].map(([id,actor])=>({id,actor,entity:scene.entities.find(e=>e.id===id)!}));
  const updateFrame=(tick:import('pixi.js').Ticker)=>{
    if(paused)return;
    const dt=Math.min(tick.deltaMS,50)/1000;time+=dt;
    const next=time>=standingUntil?route[0]:undefined;
    if(next){
      if(!panGesture&&!gestures.blocked())followSuspended=false;
      const moved=advanceRoute({x:px,y:py},route,dt*4.5,facing);
      px=moved.x;py=moved.y;facing=moved.facing;
      if(moved.reached){cell={...moved.reached};drawRoute();if(!route.length)arrive();}
    }
    const seated=seatedAt?.seat?seatPlacement(seatedAt.seat):null;
    avatar.visible=!editor;avatar.eventMode=editor?'none':'static';badge.visible=!editor&&playerHovered&&!seated;
    const actorCell={x:(seated?.x??px)+.5,y:(seated?.y??py)+.5};
    const actorPoint=projectSurface(scene,actorCell);
    if(actorPoint.x!==occlusionX||actorPoint.y!==occlusionY||actorCell.x!==occlusionCellX||actorCell.y!==occlusionCellY){
      fadedGroups.clear();occlusionX=actorPoint.x;occlusionY=actorPoint.y;occlusionCellX=actorCell.x;occlusionCellY=actorCell.y;
      if(!editor)for(const w of wallOccluders){
        if(wallOccludesActor(w,actorCell,actorPoint))fadedGroups.add(w.group);
      }
    }
    for(const {wall,view,group} of wallViews){
      const opacity=editor?(editor.wallOpacity??.7):fadedGroups.has(group)?.22:1;
      const target=wall.kind==='wall'&&wall.material==='glass'?Math.min(opacity,.38):opacity;
      if(view.alpha!==target)view.alpha=Math.abs(target-view.alpha)<.001?target:view.alpha+(target-view.alpha)*Math.min(1,dt*10);
    }
    const drawX=seated?.x??px,drawY=seated?.y??py;
    const p=projectSurface(scene,{x:drawX+.5,y:drawY+.5});avatar.position.set(p.x,p.y);followPlayer(false,dt);
    const dragKey=drag?`${drag.id}:${drag.position.x},${drag.position.y}`:'';
    if(!fixedDepth.length||dragKey!==lastDragDepth){fixedDepth=depthItems.slice(0,-1).map(i=>i.bounds());staticOrder=depthOrder(fixedDepth);staticOrder.forEach((index,z)=>depthItems[index].view.zIndex=z*2);lastDragDepth=dragKey;lastDepth='';}
    const moving=depthItems.at(-1)!.bounds(),key=`${moving.x},${moving.y}:${dragKey}`;
    if(key!==lastDepth){avatar.zIndex=movingDepthIndex(fixedDepth,staticOrder,moving)*2-1;lastDepth=key;}

    for(const [id,label] of labels){if(!label.visible)continue;const view=entityViews.get(id);if(view)label.position.copyFrom(view.position);}
    badge.position.set(avatar.x,avatar.y+14);
    const pose:ActorPose=time<celebrationUntil?'celebrate':next?'walk':seatedAt?(working?'work':'sit'):conversation?'talk':'idle';
    player.update(time,dt,pose,facing,reduceMotion);
    for(const {id,actor,entity} of occupantActors){actor.update(time,dt,conversation===id?'talk':'idle',conversation===id?facingFor(px-entity.position.x,py-entity.position.y):'se',reduceMotion);}
    if(pendingArrival){const target=pendingArrival;pendingArrival=null;app.renderer.render(app.stage);onArrive(target);}
    if(host.dataset.pose!==pose)host.dataset.pose=pose;if(host.dataset.facing!==facing)host.dataset.facing=facing;const cellLabel=`${cell.x},${cell.y}`;if(host.dataset.cell!==cellLabel)host.dataset.cell=cellLabel;



  };
  const displayedCompletion=new Map(scene.entities.map(e=>[e.id,!!e.completed]));
  const engine = {
    application:app,
    setPaused(value:boolean){paused=value;},
    getPlayerAnchor(){const bounds=avatar.getBounds(),rect=app.canvas.getBoundingClientRect();return {x:rect.left+(bounds.x+bounds.width/2)*rect.width/app.screen.width,y:rect.top+bounds.y*rect.height/app.screen.height};},
    getEntityAnchor(id:string){const view=entityViews.get(id);if(!view)return null;const bounds=view.getBounds(),rect=app.canvas.getBoundingClientRect();return {x:rect.left+(bounds.x+bounds.width/2)*rect.width/app.screen.width,y:rect.top+bounds.y*rect.height/app.screen.height};},
    renderFrame(){updateFrame(app.ticker);app.renderer.render(app.stage);},
    setExitIndicators(indicators:Record<string,import('./types').ExitIndicator>){
      const signature=JSON.stringify(indicators);if(signature===lastIndicators)return;lastIndicators=signature;
      for(const e of scene.entities){
        if(e.interaction?.action!=='adventure.exit')continue;
        const indicator=indicators[e.id],view=entityViews.get(e.id),label=labels.get(e.id);if(!view||!label)continue;
        const text=label.children[1] as Text,back=label.children[0] as Graphics;
        text.text=indicator?`${e.label} · ${indicator.label}`:e.label;
        back.clear().roundRect(text.x-text.width/2-8,text.y-3,text.width+16,23,7).fill({color:0xffffff,alpha:.92});
        let badge=exitBadges.get(e.id);
        if(!badge){badge=new Graphics();badge.eventMode='none';labelLayer.addChild(badge);exitBadges.set(e.id,badge);}
        badge.clear();badge.visible=!!indicator;if(!indicator)continue;
        const at=projectSurface(scene,{x:e.position.x+.5,y:e.position.y+.5});badge.position.set(at.x,at.y-(scene.walls?.some(w=>w.exitId===e.id)?72:25));
        const color=indicator.state==='locked'?0x88552f:0x3d744d;
        badge.roundRect(-13,-15,26,29,7).fill({color:0xfffef8,alpha:.96});
        badge.roundRect(-7,-2,14,11,2).fill(color);
        if(indicator.state==='locked')badge.moveTo(-4,-2).lineTo(-4,-7).quadraticCurveTo(0,-13,4,-7).lineTo(4,-2).stroke({color,width:2});
        else badge.moveTo(-4,-2).lineTo(-4,-7).quadraticCurveTo(0,-13,5,-7).stroke({color,width:2});
        badge.circle(0,2,1.5).fill(0xfffef8);
      }
    },
    setHidden(ids:string[]){hiddenEntities=new Set(ids);for(const [id,view] of entityViews){view.visible=!ids.includes(id);if(ids.includes(id)){hovered.delete(id);const label=labels.get(id);if(label)label.visible=false;}}},
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
    setEditor(value:WorldEditor|undefined){editor=value;paintHover.clear();levelHint.visible=false;zeroGrid.visible=baseBrush();avatar.visible=!editor;avatar.eventMode=editor?'none':'static';if(editor){badge.visible=false;playerHovered=false;}panCursor();highlight(editor?.selectedId??'');},
    goTo, zoom(delta:number){zoomLevel=Math.max(.65,Math.min(3,zoomLevel+delta));fit();followPlayer(true);},recenter(){followSuspended=false;cameraBaseScale=undefined;zoomLevel=1;panX=0;panY=0;fit();},
    setFollowCamera(enabled:boolean){
      followEnabled=enabled;
      if(enabled&&!editor&&!followInitialized){followInitialized=true;
        if(window.matchMedia('(max-width: 700px)').matches){const initial=mobileCamera(fitScale);cameraBaseScale=initial.base;zoomLevel=initial.zoom;fit();followPlayer(true);}
      }
    },
    focusPlayer(){if(editor)return;followSuspended=false;panMode=false;panCursor();
      if(cameraScale<.75||cameraScale<=fitScale*1.2){cameraBaseScale=Math.max(fitScale,1/3);zoomLevel=Math.min(3,Math.max(1.35,1/cameraBaseScale));fit();}
      followPlayer(true);
    },
    setPanMode(enabled:boolean){panMode=enabled;if(enabled)followSuspended=true;panCursor();},
    panBy(x:number,y:number){followSuspended=true;panX+=x;panY+=y;fit();},
    getPan(){return {x:panX,y:panY};},
    getFacing(){return facing;},
    getCamera(){return {zoom:zoomLevel,scale:cameraScale};},
    restoreCamera(camera:{zoom:number;scale:number}){zoomLevel=camera.zoom;cameraBaseScale=camera.scale/camera.zoom;fit();followPlayer(true);},
    captureFrame(){app.renderer.render({container:app.stage});return app.canvas.toDataURL('image/png');},
    setFacing(value:Facing){facing=value;player.update(time,0,'idle',facing,reduceMotion);host.dataset.facing=facing;},
    setWorking(value:boolean){
      if(working===value)return;working=value;badge.text=working?'Tú · Trabajando':'Tú';
      if(value){const desk=scene.entities.find(e=>e.seat);if(desk?.seat)schedule([desk.seat.cell],desk,'work');}
      else {if(purpose==='work'){route=[];destination=null;drawRoute();}seatedAt=null;standingUntil=time+.3;}
    },
    celebrate(){celebrationUntil=time+1.5;seatedAt=null;conversation=null;route=[];destination=null;px=cell.x;py=cell.y;drawRoute();},
    setConversation(id:string|null){conversation=id;if(id){const e=scene.entities.find(e=>e.id===id);if(e)facing=facingFor(e.position.x-px,e.position.y-py,facing);}},
    destroy(keepApplication=false){app.canvas.removeEventListener('pointermove',hoverTerrain);app.canvas.removeEventListener('pointerleave',leaveTerrain);app.ticker.remove(updateFrame);app.canvas.removeEventListener('pointermove',edgeHover);app.canvas.removeEventListener('pointerdown',edgeDown,true);gestures.destroy();app.canvas.removeEventListener('pointerdown',panDown,true);window.removeEventListener('pointermove',panMove,true);window.removeEventListener('pointerup',panEnd,true);window.removeEventListener('pointercancel',panEnd,true);host.removeEventListener('keydown',spaceDown);window.removeEventListener('keyup',spaceUp);window.removeEventListener('blur',clearPan);host.removeEventListener('blur',clearPan);app.canvas.removeEventListener('pointerdown',paintDown,true);window.removeEventListener('pointermove',paintMove,true);window.removeEventListener('pointerup',paintEnd,true);window.removeEventListener('pointercancel',paintEnd,true);window.removeEventListener('pointermove',dragMove);window.removeEventListener('pointerup',endDrag);window.removeEventListener('pointercancel',endDrag);destroyed=true;observer.disconnect();host.removeEventListener('keydown',keyboard);if(keepApplication){world.removeFromParent();world.destroy({children:true});}else app.destroy(true,{children:true});}
  };
  // Upload shared image sheets only. Queuing each tile/label separately adds a
  // frame-budget delay proportional to map size; geometry is warmed by renderFrame.
  try{await app.renderer.prepare.upload([...art.textures.values()]);}
  catch(error){engine.destroy(!!existingApp);throw error;}
  app.stage.addChild(world);
  app.ticker.add(updateFrame);
  return engine;
}
