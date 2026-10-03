import {describe,expect,it,vi} from 'vitest';
import {selectMainPlayer} from '../src/lib/storage/player-selection';
import {createAdventure} from '../src/lib/demo/adventure';
import {office} from '../src/lib/demo/scenes';
import {graphics} from '../src/lib/demo/pixelart';

function setup(){
 const adventure=createAdventure([structuredClone(office)]),pack=structuredClone(graphics);
 pack.players={'custom.hero':{name:'Mi protagonista',character:structuredClone(pack.character)}};
 pack.players['custom.hero'].character.image='asset:stored-player-image';
 const library={version:1 as const,activeId:adventure.id,adventures:[adventure]};
 const repository={load:vi.fn(async()=>library),pack:vi.fn(async()=>pack),save:vi.fn(async()=>library)};
 return {adventure,pack,repository};
}
describe('editor main player selection',()=>{
 it('stores only the requested graphics choice, preserving the latest maps, assets and player catalogue',async()=>{
  const {adventure,pack,repository}=setup();
  const before=structuredClone(pack);
  adventure.name='Nombre actualizado desde otro editor';
  expect(await selectMainPlayer(adventure.id,'custom.hero',repository)).toBe('Mi protagonista');
  expect(repository.pack).toHaveBeenCalledWith(adventure.id);
  expect(repository.save).toHaveBeenCalledWith(adventure,{pack:{...before,activePlayer:'custom.hero'},blobs:{}});
  expect(pack).toEqual(before);
 });
 it('restores the original player without deleting imported players or their graphics',async()=>{
  const {adventure,pack,repository}=setup();pack.activePlayer='custom.hero';
  expect(await selectMainPlayer(adventure.id,'default',repository)).toBe('Explorador original');
  expect(repository.save).toHaveBeenCalledWith(adventure,{pack:expect.not.objectContaining({activePlayer:expect.anything()}),blobs:{}});
  expect(repository.save).toHaveBeenCalledWith(adventure,{pack:expect.objectContaining({players:pack.players}),blobs:{}});
  expect(pack.activePlayer).toBe('custom.hero');
 });
 it('rejects absent adventures or players without writing changes',async()=>{
  const {adventure,repository}=setup();
  await expect(selectMainPlayer('missing','default',repository)).rejects.toThrow('aventura');
  await expect(selectMainPlayer(adventure.id,'custom.missing',repository)).rejects.toThrow('catálogo');
  expect(repository.save).not.toHaveBeenCalled();
 });
});
