export type TileKind = 'office' | 'grass' | 'path';
export type Cell = { x: number; y: number };
export type Facing = 'ne' | 'se' | 'sw' | 'nw';
export type ActorPose = 'idle' | 'walk' | 'sit' | 'work' | 'talk' | 'celebrate';
export type EntityKind = 'desk' | 'board' | 'person' | 'plant' | 'sofa' | 'table' | 'goal' | 'tree';
export interface WorldEntity {
  id: string;
  label: string;
  kind: EntityKind;
  position: Cell;
  size?: Cell;
  color?: number;
  interaction?: { label: string; action: string; resourceId: string };
  completed?: boolean;
  visualId?: string;
  /** Horizontal reflection of the artwork; size and attachments describe the reflected footprint. */
  flipX?: boolean;
  solid?: boolean;
  interactionPoints?: Cell[];
  seat?: { cell: Cell; facing: Facing };
}
export interface WorldScene {
  schemaVersion?: 1;
  id: string;
  name: string;
  theme: 'office' | 'outdoors';
  width: number;
  height: number;
  spawn: Cell;
  entities: WorldEntity[];
  blocked?: Cell[];
  tiles?: Record<string,TileKind>;
}
export interface WorldInteraction {
  sceneId: string;
  entityId: string;
  action: string;
  resourceId: string;
}
/** The host owns authorization, domain state, persistence and UI panels. */
export interface WorldAdapter {
  scene: WorldScene;
  interact: (event: WorldInteraction) => void | Promise<void>;
}
export interface WorldController {
  goTo: (entityId: string) => void;
  zoom: (delta: number) => void;
  recenter: () => void;
  setPanMode: (enabled:boolean)=>void;
  panBy: (x:number,y:number)=>void;
  getPan: ()=>{x:number;y:number};
  getFacing: () => Facing;
  getCamera: () => { zoom: number; scale: number };
  restoreCamera: (camera: { zoom: number; scale: number }) => void;
  captureFrame: () => string;
  setFacing: (facing: Facing) => void;
  celebrate: () => void;
  setConversation: (entityId: string | null) => void;
}

/** Optional authoring hooks. Omit them for normal gameplay. */
export interface WorldEditor {
  selectedId: string;
  /** Optional tile picker used when choosing a destination in another map. */
  onpick?: (cell: Cell) => void;
  brush?: TileKind | 'erase';
  onpaint?: (cells:Cell[],tile:TileKind | 'erase')=>void;
  onselect: (id: string) => void;
  onmove: (id: string, position: Cell) => boolean;
}
