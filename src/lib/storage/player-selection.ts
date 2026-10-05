import {localAdventures,type AdventureRepository} from './local-adventures';

/** Change only the stored graphics selection; unsaved map drafts belong to the editor. */
export async function selectMainPlayer(adventureId:string,playerId:string,repository:Pick<AdventureRepository,'load'|'pack'|'save'>=localAdventures,expectedRevision?:number){
 const library=await repository.load(),adventure=library.adventures.find(a=>a.id===adventureId);
 if(!adventure)throw new Error('No se encuentra la aventura.');
 if(expectedRevision!==undefined&&(adventure as { _revision?:number })._revision!==expectedRevision)throw new Error('La aventura ha cambiado en otra sesión. Exporta tus cambios y vuelve a cargarla.');
 const current=await repository.pack(adventureId);
 if(playerId!=='default'&&!Object.hasOwn(current.players??{},playerId))throw new Error('Este jugador ya no está en el catálogo. Actualiza la lista.');
 const pack={...current};
 if(playerId==='default')delete pack.activePlayer;else pack.activePlayer=playerId;
 await repository.save(adventure,{pack,blobs:{}});
 return playerId==='default'?'Explorador original':pack.players![playerId].name;
}
