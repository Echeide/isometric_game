export const tileKinds = ['office','grass','path','parquet','asphalt','sidewalk','cobble','sand','dirt'] as const;
export type BuiltinTileKind = typeof tileKinds[number];
export type CustomTileKind = `custom.${string}`;
export type TileKind = BuiltinTileKind | CustomTileKind;
export const isCustomTile=(id:unknown):id is CustomTileKind=>typeof id==='string'&&/^custom\.[a-zA-Z0-9_-]{1,80}$/.test(id);
export const isTileKind=(id:unknown):id is TileKind=>typeof id==='string'&&((tileKinds as readonly string[]).includes(id)||isCustomTile(id));
export type WallMaterial = 'white'|'glass'|'stone'|'cobble';
export type RailingStyle = 'stone'|'metal';
export interface MapFacade {edge:'ne'|'nw';imageId:string;height:number;baseLevel:number;baseMode?:'terrain'|'fixed'}
export type Wall = {x:number;y:number;axis:'x'|'y';kind:'wall'|'door'|'railing';exitId?:string;material?:WallMaterial;railingStyle?:RailingStyle;railingFamily?:string;railingVariant?:string};
export type MapBrush = TileKind | 'void' | 'erase' | `height:${number}` | `stairs:${Facing}` | 'stairs:erase' | `terrain:${string}`;
export type Cell = { x: number; y: number };
export type Facing = 'ne' | 'se' | 'sw' | 'nw';
export type ActorPose = 'idle' | 'walk' | 'sit' | 'work' | 'talk' | 'celebrate';
export type CameraAction = 'fit' | 'player';
export interface CameraState {zoom:number;scale:number;fitScale:number;action:CameraAction}
export type EntityKind = 'object' | 'desk' | 'board' | 'person' | 'plant' | 'sofa' | 'table' | 'goal' | 'tree' | 'cabinet' | 'bookshelf' | 'printer' | 'chair' | 'bench' | 'bin' | 'bollard' | 'lamp' | 'rock' | 'bush' | 'flowers' | 'pine';
export interface WorldEntity {
  id: string;
  label: string;
  description?: string;
  kind: EntityKind;
  position: Cell;
  size?: Cell;
  color?: number;
  interaction?: { label: string; action: string; resourceId: string };
  completed?: boolean;
  pickup?: {itemId:string;quantity:number};
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
  /** Independent appearance settings; omitted fields are initialized from the old theme. */
  environment?: 'interior'|'exterior';
  baseTile?: TileKind;
  wallMaterial?: WallMaterial;
  cutColor?: number;
  /** Generated perimeter segments materialized when walls are edited. */
  automaticWalls?: string[];
  width: number;
  height: number;
  spawn: Cell;
  entities: WorldEntity[];
  blocked?: Cell[];
  tiles?: Record<string,TileKind|'void'>;
  /** Automatic terrain cells; tiles retain a concrete fallback for geometry/imports. */
  terrains?: Record<string,string>;
  baseTerrain?: string;
  walls?: Wall[];
  facades?: MapFacade[];
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
  getPlayerCell?: () => Cell;
  getPlayerAnchor: () => {x:number;y:number};
  getEntityAnchor: (id:string) => {x:number;y:number}|null;
  goTo: (entityId: string) => void;
  zoom: (delta: number) => void;
  recenter: () => void;
  setFollowCamera:(enabled:boolean)=>void;
  focusPlayer:()=>void;
  setPanMode: (enabled:boolean)=>void;
  panBy: (x:number,y:number)=>void;
  getPan: ()=>{x:number;y:number};
  getFacing: () => Facing;
  getCamera: () => CameraState;
  restoreCamera: (camera: { zoom: number; scale: number }) => void;
  captureFrame: () => string;
  setFacing: (facing: Facing) => void;
  celebrate: () => void;
  setConversation: (entityId: string | null) => void;
}

/** Optional authoring hooks. Omit them for normal gameplay. */
export interface WorldEditor {
  facadeEdge?:MapFacade['edge'];
  selectedId: string;
  /** Optional tile picker used when choosing a destination in another map. */
  onpick?: (cell: Cell) => void;
  brush?: MapBrush;
  wallTool?: 'wall'|'door'|'railing'|'remove';
  onwall?: (wall:Wall)=>void;
  /** Select a floor cell separately from the empty canvas background. */
  onselectTerrain?: (cell:Cell)=>void;
  wallOpacity?:number;
  onpaint?: (cells:Cell[],tile:MapBrush)=>void;
  onselect: (id: string) => void;
  onmove: (id: string, position: Cell) => boolean;
}

export type ExitIndicator={state:'locked'|'ready';label:string};
