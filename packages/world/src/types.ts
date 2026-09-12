export const tileKinds = ['office','grass','path','parquet','asphalt','sidewalk','cobble','sand','dirt'] as const;
export type TileKind = typeof tileKinds[number];
export type WallMaterial = 'white'|'glass'|'stone'|'cobble';
export type Wall = {x:number;y:number;axis:'x'|'y';kind:'wall'|'door';exitId?:string;material?:WallMaterial};
export type MapBrush = TileKind | 'void' | 'erase' | `height:${number}` | `stairs:${Facing}` | 'stairs:erase';
export type Cell = { x: number; y: number };
export type Facing = 'ne' | 'se' | 'sw' | 'nw';
export type ActorPose = 'idle' | 'walk' | 'sit' | 'work' | 'talk' | 'celebrate';
export type EntityKind = 'desk' | 'board' | 'person' | 'plant' | 'sofa' | 'table' | 'goal' | 'tree' | 'cabinet' | 'bookshelf' | 'printer' | 'chair' | 'bench' | 'bin' | 'bollard' | 'lamp' | 'rock' | 'bush' | 'flowers' | 'pine';
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
  theme: 'office' | 'castle' | 'outdoors' | 'rock' | 'beach';
  width: number;
  height: number;
  spawn: Cell;
  entities: WorldEntity[];
  blocked?: Cell[];
  tiles?: Record<string,TileKind|'void'>;
  walls?: Wall[];
  elevations?: Record<string,number>;
  stairs?: Record<string,Facing>;
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
  brush?: MapBrush;
  wallTool?: 'wall'|'door'|'remove';
  onwall?: (wall:Wall)=>void;
  wallOpacity?:number;
  onpaint?: (cells:Cell[],tile:MapBrush)=>void;
  onselect: (id: string) => void;
  onmove: (id: string, position: Cell) => boolean;
}
