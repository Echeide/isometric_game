import {expect,it} from 'vitest';
import {resourceSignature} from '../src/lib/workshop/resource-signature';
it('accepts an unchanged resource after database JSON key reordering and optional-field serialization',()=>{
 const source={objects:{palace:{image:'asset:palace',width:320,height:180,origin:[160,170],frame:[0,0,320,180],originalImage:undefined}},tiles:{grass:'grass.png',path:'path.png'}};
 const reordered={tiles:{path:'path.png',grass:'grass.png'},objects:{palace:{frame:[0,0,320,180],origin:[160,170],height:180,width:320,image:'asset:palace'}}};
 expect(resourceSignature(source)).toBe(resourceSignature(reordered));
 expect(resourceSignature(source)).toBe(resourceSignature(JSON.parse(JSON.stringify(source))));
});
it('still detects edits, deleted fields and changes in ordered arrays',()=>{
 const source={image:'asset:palace',origin:[160,170],frame:[0,0,320,180]};
 for(const edited of [{...source,image:'asset:other'},{...source,origin:[170,160]},{...source,frame:[1,0,320,180]},{origin:source.origin,frame:source.frame}])expect(resourceSignature(edited)).not.toBe(resourceSignature(source));
});
