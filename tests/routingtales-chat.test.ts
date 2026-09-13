import {describe,it,expect} from 'vitest';
import {parseChat,chatUrl,chatProgressKey,resumeNode} from '../src/lib/chat/routingtales';
const chat={avatar:'/avatar.svg',chatNodes:[{id:'start',messages:[['Hola'],['De nuevo']],options:[{text:'Sí',target:'success'}]},{id:'success',messages:['Listo'],options:[{text:'Volver',home:true}]}]};
describe('RoutingTales chat compatibility',()=>{
 it('preserves native branching and repeated messages',()=>{expect(parseChat(chat)).toBe(chat);});
 it('rejects broken targets and duplicate nodes before loading the module',()=>{expect(()=>parseChat({...chat,chatNodes:[chat.chatNodes[0]]})).toThrow();expect(()=>parseChat({...chat,chatNodes:[...chat.chatNodes,chat.chatNodes[0]]})).toThrow();});
 it('validates messages and missing content',()=>{expect(()=>parseChat({})).toThrow();expect(()=>parseChat({chatNodes:[{id:'x',messages:12}]})).toThrow();});
 it('resumes only nodes still present in the conversation',()=>{expect(resumeNode(chat,'success')).toBe('success');expect(resumeNode(chat,'removed')).toBeUndefined();});
 it('isolates progress by adventure, map and entity',()=>{expect(chatProgressKey('a','m','e','c')).not.toBe(chatProgressKey('b','m','e','c'));expect(chatProgressKey('a','m','e','c')).not.toBe(chatProgressKey('a','n','e','c'));});
 it('loads built-in chats or local JSON resources without silent fallback',()=>{expect(chatUrl('lucia')).toBe('/chats/lucia.json');expect(chatUrl('/games/G-004/chats/h001.json')).toBe('/games/G-004/chats/h001.json');expect(()=>chatUrl('unknown')).toThrow();expect(()=>chatUrl('//example.com/chat.json')).toThrow();});
});
