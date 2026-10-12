export { default as World } from './World.svelte';
export type {MapDecoration} from './types';
export type { Cell, WorldScene, WorldEntity, WorldInteraction, WorldAdapter, WorldController, EntityKind, CameraAction, CameraState } from './types';
export { findPath, walkable, interactionCells, project } from './navigation';

export { parseScene, visualCatalog } from './scene';
export {isCustomVisual,validateCustomCatalog,validateCatalogOverrides,resolveVisualCatalog,compatibleVisualKind} from './scene';
export type {VisualAsset,ObjectCategory,VisualCatalogOverrides} from './scene';
export type {ObjectSprite,NpcClip} from './pixelart';
export {actorPoses} from './character';
export {validateGraphics,validateCharacterGraphics} from './graphics-validation';
export type {ImageSize} from './graphics-validation';
export type { Facing, ActorPose, WorldEditor } from './types';

export type { PixelArtPack } from './pixelart';
export type {TileFamily,TileFamilies} from './tile-families';
export type {ObjectFamily,ObjectFamilies} from './object-families';

export { characterFps, characterImage, characterVariants } from './character';
export type { CharacterPack, CharacterClip } from './character';

export type { TileKind, BuiltinTileKind, CustomTileKind } from './types';
export { tileKinds, isTileKind, isCustomTile } from './types';
export { validateSceneTiles } from './terrain';

export type {Wall,MapBrush} from './types';

export {wallBodyHeight} from './walls';
export type {RailingStyle,WallMaterial} from './types';

export {terrainAt,terrainTileAt} from './terrain';
export {terrainSides,terrainMasks,terrainMaskLabel,interiorMembers} from './tile-families';
export {environments} from './environments';
export {resolveEnvironment,shadedGround} from './environments';
export {changeMapEnvironment,changeWallDefault,resizeMapWalls} from './map-appearance';
export {tileSurfaceColor} from './tile-color';

export * from './railing-families';
