import type {Adventure} from '../../src/lib/demo/adventure';
export function unreachableAdventure():Adventure{return {
 kind:'isometric-adventure',version:1,id:'unreachable-draft',name:'Borrador',startMap:'calle',items:[],
 maps:[{schemaVersion:1,id:'calle',name:'Calle',theme:'outdoors',width:4,height:4,spawn:{x:1,y:0},blocked:Array.from({length:4},(_,x)=>({x,y:1})),entities:[{id:'exit',kind:'goal',visualId:'pixel.goal',label:'Salida a Plaza Grande',position:{x:0,y:3},solid:false,interaction:{label:'Viajar',action:'adventure.exit',resourceId:'to-plaza'}}]},
 {schemaVersion:1,id:'plaza',name:'Plaza Grande',theme:'outdoors',width:4,height:4,spawn:{x:0,y:0},entities:[]}],
 exits:[{id:'to-plaza',fromMap:'calle',entityId:'exit',toMap:'plaza',arrival:{x:0,y:0}}]
};}
