import {expect,it} from 'vitest';
import {characterImage,characterVariants,type CharacterPack} from '../packages/world/src/character';
import catalog from '../static/pixelart/catalog.json';
const character=catalog.character as unknown as CharacterPack;
it('resolves a separate action and its selected character variant',()=>{
 expect(characterImage(character,'walk')).toBe('/pixelart/characters/explorer/walk.png');
 expect(characterImage(character,'walk','ce936a')).toBe('/pixelart/characters/lucia/walk.png');
 expect(characterImage(character,'celebrate','819582')).toBe('/pixelart/characters/marcos/celebrate.png');
 expect(characterImage(character,'walk','unknown')).toBe(characterImage(character,'walk'));
 expect(new Set(characterVariants(character))).toEqual(new Set(['default','ce936a','819582','728da5']));
 for(const pose of Object.keys(character.animations) as (keyof typeof character.animations)[])expect(characterImage(character,pose,'728da5')).toBe(`/pixelart/characters/grey-player-v1/${pose}.png`);
});
it('uses the work sheet as a still seated pose',()=>{
 for(const variant of ['default','ce936a','819582'])expect(characterImage(character,'sit',variant)).toBe(characterImage(character,'work',variant));
 expect(character.animations.sit.frames).toBe(1);
 expect(character.animations.work.frames).toBeGreaterThan(1);
});
it('continues to resolve legacy shared atlases',()=>{
 const legacy:CharacterPack={...character,image:'/old.png',variants:{friend:'/friend.png'},animations:Object.fromEntries(Object.entries(character.animations).map(([name,c])=>[name,{row:c.row,frames:c.frames,fps:c.fps}])) as CharacterPack['animations']};
 expect(characterImage(legacy,'walk')).toBe('/old.png');
 expect(characterImage(legacy,'work','friend')).toBe('/friend.png');
});
