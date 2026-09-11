import {createAdventure,readAdventure,type Adventure} from './adventure';
import {readMaps} from './saved-maps';
import {office,outdoors} from './scenes';
/** The editor and player resolve the same document, without overwriting legacy saves. */
export function loadPlayableAdventure(storage:Pick<Storage,'getItem'>):Adventure {
 const saved=readAdventure(storage);if(saved)return saved;
 const legacy=readMaps(storage);
 const maps=[structuredClone(legacy.maps.checkpoint??office),structuredClone(legacy.maps.routingtales??outdoors)];
 if(maps[0].id===maps[1].id)maps[1].id+='-outdoors';
 const adventure=createAdventure(maps);
 adventure.startMap=maps[legacy.active==='routingtales'?1:0].id;
 return adventure;
}
export const objectiveKey=(mapId:string,entityId:string)=>JSON.stringify([mapId,entityId]);
