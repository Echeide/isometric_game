import {expect,it} from 'vitest';
import {seatPlacement} from '../packages/world/src/seating';
it('tucks the chair toward its facing direction without changing its navigation cell',()=>{
 const cell={x:3,y:6};
 expect(seatPlacement({cell,facing:'ne'})).toEqual({x:3,y:5.7,backInFront:true});
 expect(seatPlacement({cell,facing:'sw'})).toEqual({x:3,y:6.3,backInFront:false});
 expect(seatPlacement({cell,facing:'se'})).toEqual({x:3.3,y:6,backInFront:false});
 expect(seatPlacement({cell,facing:'nw'})).toEqual({x:2.7,y:6,backInFront:true});
 expect(cell).toEqual({x:3,y:6});
});
