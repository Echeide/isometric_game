import type { WorldEntity } from './types';
/** Chair centre is slightly tucked toward the desk; navigation still uses the free cell. */
export function seatPlacement(seat: NonNullable<WorldEntity['seat']>) {
 const direction={ne:{x:0,y:-1},sw:{x:0,y:1},se:{x:1,y:0},nw:{x:-1,y:0}}[seat.facing];
 return {x:seat.cell.x+direction.x*.3,y:seat.cell.y+direction.y*.3,backInFront:seat.facing==='ne'||seat.facing==='nw'};
}
