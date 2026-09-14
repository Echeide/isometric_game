export { default as World } from './World.svelte';
export type { Cell, WorldScene, WorldEntity, WorldInteraction, WorldAdapter, WorldController, EntityKind, CameraAction, CameraState } from './types';
export { findPath, walkable, interactionCells, project } from './navigation';

export { parseScene, visualCatalog } from './scene';
export {isCustomVisual,validateCustomCatalog,validateCatalogOverrides,resolveVisualCatalog} from './scene';
export type {VisualAsset,ObjectCategory,VisualCatalogOverrides} from './scene';
export type {ObjectSprite,NpcClip} from './pixelart';
export {actorPoses} from './character';
export {validateGraphics} from './graphics-validation';
export type {ImageSize} from './graphics-validation';
export type { Facing, ActorPose, WorldEditor } from './types';

export type { PixelArtPack } from './pixelart';

export { characterImage, characterVariants } from './character';
export type { CharacterPack, CharacterClip } from './character';

export type { TileKind, BuiltinTileKind, CustomTileKind } from './types';
export { tileKinds, isTileKind, isCustomTile } from './types';
export { validateSceneTiles } from './terrain';

export type {Wall,MapBrush} from './types';

export type {WallMaterial} from './types';

export {environments} from './environments';
