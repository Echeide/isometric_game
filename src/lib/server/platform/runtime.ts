import {dev} from '$app/environment';
import {env} from '$env/dynamic/private';
import {resolve} from 'node:path';
import {Database} from './database';
import {Auth,PlatformError} from './auth';
import {PlatformStore} from './store';
import {configuredStorage} from './object-storage';
import {PlayerAuth} from './players';
import {GameSaves} from './game-saves';
let runtime:{database:Database;auth:Auth;store:PlatformStore;players:PlayerAuth;saves:GameSaves}|undefined;
export function platform(){if(!env.DATABASE_URL)throw new PlatformError(503,'Configura DATABASE_URL y crea la cuenta inicial para activar la gestión.');if(!dev&&!env.PLATFORM_STORAGE_DIR)throw new PlatformError(503,'Configura PLATFORM_STORAGE_DIR en un volumen persistente.');if(!runtime){const database=new Database(env.DATABASE_URL);runtime={database,auth:new Auth(database),players:new PlayerAuth(database),saves:new GameSaves(database),store:new PlatformStore(database,resolve(env.PLATFORM_STORAGE_DIR||'.platform-storage'),resolve('static/pixelart'),configuredStorage(resolve(env.PLATFORM_STORAGE_DIR||'.platform-storage'),env))};}return runtime;}
