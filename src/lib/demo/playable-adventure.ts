import {loadAdventureLibrary} from './adventure-library';
import type {Adventure} from './adventure';
export function loadPlayableAdventure(storage:Pick<Storage,'getItem'>):Adventure {const library=loadAdventureLibrary(storage);return library.adventures.find(a=>a.id===library.activeId)!;}
export const objectiveKey=(mapId:string,entityId:string)=>JSON.stringify([mapId,entityId]);
