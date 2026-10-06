export interface AdventurePalette { version:1; name:string; colors:string[] }
/** Original preset: shared darks and eight ramps for common game materials. */
const ramps=[
 '20202b 343443 50505e 6e7078 92959b b6b9b9 d9dcce f4f1dd',
 '192c46 263e60 36567d 48739c 6594b3 8ab8ca b8d8dc e2eee7',
 '192e2d 284638 3e6040 578149 76a052 9cbb6b c3d690 e4eaba',
 '35352c 50503a 6a6945 88854e aaa35d c8bd77 ded395 eee5be',
 '35282d 503735 704b3b 906447 b18358 c6a477 dbc59a eedecc',
 '483035 68423e 8b5850 ad7765 cb967b e2b397 efceb1 f8e4cc',
 '422534 623341 84454b a55b55 c57764 db9981 ebb9a3 f3d6c3',
 '30243e 483451 654968 825f81 a07e9d bba1b8 d5c4d2 eae0e5'
];
export function defaultAdventurePalette():AdventurePalette {return {version:1,name:'Aventura 64',colors:ramps.flatMap(r=>r.split(' ').map(c=>'#'+c))};}
export function validateAdventurePalette(value:unknown):AdventurePalette {
 const p=value as AdventurePalette;
 if(!p||p.version!==1||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Array.isArray(p.colors)||p.colors.length!==64||p.colors.some(c=>typeof c!=='string'||!/^#[\da-f]{6}$/i.test(c))||new Set(p.colors.map(c=>c.toLowerCase())).size!==64)throw Error('La paleta necesita un nombre y 64 colores HEX distintos.');
 return {version:1,name:p.name.trim(),colors:p.colors.map(c=>c.toLowerCase())};
}
export function paletteRGB(p:AdventurePalette):[number,number,number][] {return validateAdventurePalette(p).colors.map(c=>[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);}
export function importPalette(text:string):AdventurePalette {
 try {return validateAdventurePalette(JSON.parse(text));}catch{ /* Also accept a plain HEX list. */ }
 const colors=text.match(/#?[\da-f]{6}\b/gi)?.map(c=>'#'+c.replace('#',''))??[];
 return validateAdventurePalette({version:1,name:'Paleta importada',colors});
}
