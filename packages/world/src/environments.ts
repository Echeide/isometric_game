import type {WorldScene,TileKind,WallMaterial} from './types';

type Environment={label:string;outdoor:boolean;tile:TileKind;wall:WallMaterial;ground:{top:number;left:number;right:number}};
export const environments:Record<WorldScene['theme'],Environment>={
 office:{label:'Interior oficina',outdoor:false,tile:'office',wall:'white',ground:{top:0xdce6e4,left:0xb1c5c2,right:0x91aaa7}},
 castle:{label:'Interior castillo',outdoor:false,tile:'cobble',wall:'stone',ground:{top:0xb7b9ae,left:0x92978b,right:0x777f73}},
 outdoors:{label:'Exterior verde',outdoor:true,tile:'grass',wall:'white',ground:{top:0xb5cba4,left:0x8d9e78,right:0x768b69}},
 rock:{label:'Exterior roca',outdoor:true,tile:'cobble',wall:'stone',ground:{top:0xb4b5ab,left:0x92958c,right:0x747a73}},
 beach:{label:'Exterior playa',outdoor:true,tile:'sand',wall:'white',ground:{top:0xe8d6aa,left:0xc9b688,right:0xae976e}},
};
