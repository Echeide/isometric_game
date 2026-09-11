import { parseScene, visualCatalog, type WorldEntity, type WorldScene } from '@isometrico/world';
/** Find a valid free placement rather than stacking every new item at (1,1). */
export function insertEntity(draft: WorldScene, kind: WorldEntity['kind'], id: string, visualId?: string, position?: {x:number;y:number}): WorldScene {
 const base=parseScene(draft);
 const asset=visualCatalog.find(a=>a.kind===kind&&(!visualId||a.id===visualId));
 if(!asset)throw new Error('Este objeto no está en el catálogo.');
 const size={x:kind==='desk'||kind==='table'?2:kind==='board'?3:1,y:kind==='sofa'?3:1};
 if(position){
  return parseScene({...base,entities:[...base.entities,{id,label:asset.label,kind,visualId:asset.id,position,size}]});
 }
 // Prefer the front of the room so new objects are easy to see.
 for(let y=base.height-1;y>=0;y--)for(let x=0;x<=base.width-size.x;x++){
  const entity:WorldEntity={id,label:asset.label,kind,visualId:asset.id,position:{x,y},size};
  try{return parseScene({...base,entities:[...base.entities,entity]});}catch{/* Try another location, preserving entrances and interaction routes. */}
 }
 throw new Error('No queda espacio libre para este objeto sin bloquear el mapa.');
}

/** Move the furniture and its attached interaction/seat coordinates as one edit. */
export function moveEntity(draft: WorldScene, id: string, position: {x:number;y:number}): WorldScene {
 const entity=draft.entities.find(e=>e.id===id);
 if(!entity)throw new Error('No se encuentra el objeto seleccionado.');
 const dx=position.x-entity.position.x,dy=position.y-entity.position.y;
 const translate=(p:{x:number;y:number})=>({x:p.x+dx,y:p.y+dy});
 return parseScene({...draft,entities:draft.entities.map(e=>e.id!==id?e:{...e,position,
  ...(e.seat?{seat:{...e.seat,cell:translate(e.seat.cell)}}:{}),
  ...(e.interactionPoints?{interactionPoints:e.interactionPoints.map(translate)}:{})
 })});
}

/** Reflection across the isometric vertical axis swaps local grid x/y. */
export function flipEntity(draft:WorldScene,id:string):WorldScene {
 const entity=draft.entities.find(e=>e.id===id);
 if(!entity)throw new Error('No se encuentra el objeto seleccionado.');
 const reflect=(p:{x:number;y:number})=>({x:entity.position.x+p.y-entity.position.y,y:entity.position.y+p.x-entity.position.x});
 const facing={ne:'nw',nw:'ne',se:'sw',sw:'se'} as const;
 return parseScene({...draft,entities:draft.entities.map(e=>e.id!==id?e:{...e,flipX:!e.flipX,
  ...(e.size?{size:{x:e.size.y,y:e.size.x}}:{}),
  ...(e.seat?{seat:{cell:reflect(e.seat.cell),facing:facing[e.seat.facing]}}:{}),
  ...(e.interactionPoints?{interactionPoints:e.interactionPoints.map(reflect)}:{})
 })});
}

/** Apply one stroke as a single undoable edit; painting never changes collisions. */
export function paintTiles(draft:WorldScene,cells:import('@isometrico/world').Cell[],tile:import('@isometrico/world').TileKind|'erase'):WorldScene{
 const tiles={...draft.tiles};
 for(const {x,y} of cells){if(tile==='erase')delete tiles[`${x},${y}`];else tiles[`${x},${y}`]=tile;}
 return parseScene({...draft,tiles});
}
