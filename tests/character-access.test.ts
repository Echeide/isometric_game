import { describe, expect, it } from 'vitest';
import { allowCharacterApi, authorizeWorkshop, workshopAccessConfigured } from '../src/lib/server/character-access';
const config = { user: 'artist', password: 'long-test-password-not-a-real-secret', origin: 'https://game.example' };
const auth = `Basic ${Buffer.from(`${config.user}:${config.password}`).toString('base64')}`;
const url = new URL(`${config.origin}/api/characters/images`);
describe('production character workshop access', () => {
  it('requires a configured password of at least ten characters and a canonical HTTPS origin', () => {
    expect(workshopAccessConfigured(config)).toBe(true);
    for (const change of [{password:''},{password:'short'},{password:'123456789'},{origin:'http://game.example'},{origin:'https://game.example/path'},{origin:'https://user:pass@game.example'},{user:'a:b'}]) expect(workshopAccessConfigured({...config,...change})).toBe(false);
  });
  it('accepts a ten-character password including a literal asterisk', () => {
    const shortConfig = { ...config, password: 'Sample123*' };
    const header = `Basic ${Buffer.from(`${shortConfig.user}:${shortConfig.password}`).toString('base64')}`;
    expect(workshopAccessConfigured(shortConfig)).toBe(true);
    expect(authorizeWorkshop(shortConfig, url, header)).toBe(true);
    expect(authorizeWorkshop(shortConfig, url, header + '?')).toBe(false);
  });
  it('accepts only correct credentials for the configured deployment', () => {
    expect(authorizeWorkshop(config,url,auth)).toBe(true);
    for (const header of [null,'Basic !!!','Bearer token',`Basic ${Buffer.from('artist:wrong').toString('base64')}`]) expect(authorizeWorkshop(config,url,header)).toBe(false);
    expect(authorizeWorkshop(config,new URL('https://other.example'),auth)).toBe(false);
    expect(authorizeWorkshop({},url,auth)).toBe(false);
  });
  it('enables production API only after authentication and enforces same-origin paid requests', () => {
    expect(allowCharacterApi(false,'',url,url.origin,true)).toBe(true);
    expect(allowCharacterApi(false,'',url,undefined,true)).toBe(true);
    expect(allowCharacterApi(false,'',url,url.origin,false)).toBe(false);
    expect(allowCharacterApi(false,'',url,null,true)).toBe(false);
    expect(allowCharacterApi(false,'',url,'https://evil.example',true)).toBe(false);
    expect(allowCharacterApi(false,'',new URL('http://game.example'),undefined,true)).toBe(false);
  });
  it('preserves loopback restrictions in development regardless of the authorization flag', () => {
    const local = new URL('http://127.0.0.1:5173/api/characters/images');
    expect(allowCharacterApi(true,'127.0.0.1',local,local.origin)).toBe(true);
    expect(allowCharacterApi(true,'192.168.1.10',local,local.origin,true)).toBe(false);
    expect(allowCharacterApi(true,'127.0.0.1',local,'https://evil.example')).toBe(false);
  });
});
