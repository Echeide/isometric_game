export interface PlayerAccount {id:string;username:string}
export interface PlayerPrincipal extends PlayerAccount {sessionId:string}
export function playerReturnPath(value:unknown){
 if(typeof value!=='string'||value.includes('\\')||!/^\/(?:play\/[^/?#]+(?:\?[^#]*)?|preview(?:\?[^#]*)?)?$/.test(value))return '/';
 return value;
}
