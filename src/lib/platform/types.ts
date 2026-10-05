export type Role='superadmin'|'admin';
export interface Limits {adventures:number;published:number;storageMB:number;images:number;videos:number}
export interface Permissions {publish:boolean;images:boolean;videos:boolean}
export const defaultLimits:Limits={adventures:10,published:3,storageMB:500,images:100,videos:20};
export const defaultPermissions:Permissions={publish:true,images:true,videos:false};
export interface Identity {id:string;username:string;role:Role;tenantId:string|null}
export interface Principal {actor:Identity;user:Identity;tenant:{id:string;name:string;enabled:boolean;limits:Limits;permissions:Permissions}|null;impersonating:boolean;sessionId:string}
export const isSuper=(p:Principal)=>p.actor.role==='superadmin'&&!p.impersonating;
export interface PublicAdventure {slug:string;name:string;description:string;tenantName:string;publishedAt:string}
