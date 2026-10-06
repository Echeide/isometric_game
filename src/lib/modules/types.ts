/** Available content modules. Add a type here when its editor and runtime exist. */
export const contentModuleTypes=[{id:'chat',label:'Conversación'}] as const;
export type ContentModuleType=typeof contentModuleTypes[number]['id'];
export interface ContentModuleCard {type:ContentModuleType;name:string}
