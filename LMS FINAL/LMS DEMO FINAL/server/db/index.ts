import fs from 'fs';
import path from 'path';
import type { DBStore } from '../../src/types';
import { migratePlaintextPasswords, repairDatabaseIntegrity } from '../dbIntegrity';
import {
  createFreshJsonStore,
  loadStoreFromJsonFile,
  persistJsonStore,
  loadJsonStoreFromPath,
} from './jsonEngine';
import {
  initPostgres,
  isPostgresEnabled,
  assertPostgresConfigured,
  isPostgresEmpty,
  loadStoreFromPostgres,
  saveStoreToPostgres,
  seedPostgresFromStore,
} from './postgresEngine';

let cache: DBStore | null = null;
let backend: 'postgres' | 'json' = 'json';
let jsonSaveHook: ((store: DBStore) => void) | null = null;

export function registerJsonSaveHook(hook: (store: DBStore) => void): void {
  jsonSaveHook = hook;
}

export function isUsingPostgres(): boolean {
  return backend === 'postgres';
}

export function invalidateCache(): void {
  cache = null;
}

export async function initDatabase(): Promise<'postgres' | 'json'> {
  assertPostgresConfigured();

  if (isPostgresEnabled()) {
    backend = 'postgres';
    await initPostgres();

    if (await isPostgresEmpty()) {
      const jsonPath = path.join(process.cwd(), 'db.json');
      const store = fs.existsSync(jsonPath)
        ? loadJsonStoreFromPath(jsonPath)
        : createFreshJsonStore();

      repairDatabaseIntegrity(store);
      const pwdMigrated = await migratePlaintextPasswords(store);
      if (pwdMigrated) {
        console.log('🔐 Password hashes prepared for PostgreSQL import.');
      }

      await seedPostgresFromStore(store);
      console.log('📥 Seeded PostgreSQL from db.json');
    }

    cache = await loadStoreFromPostgres();
    console.log('💾 Database backend: PostgreSQL');
    return 'postgres';
  }

  backend = 'json';
  cache = loadStoreFromJsonFile();
  console.log('💾 Database backend: db.json (set DATABASE_URL for PostgreSQL)');
  return 'json';
}

export async function loadDB(): Promise<DBStore> {
  if (cache) {
    return cache;
  }

  if (backend === 'postgres') {
    cache = await loadStoreFromPostgres();
  } else {
    cache = loadStoreFromJsonFile();
  }

  return cache;
}

export async function saveDB(store: DBStore): Promise<void> {
  cache = store;

  if (backend === 'postgres') {
    await saveStoreToPostgres(store);
  } else {
    persistJsonStore(store);
    jsonSaveHook?.(store);
  }
}

export async function runDatabaseMaintenance(): Promise<void> {
  invalidateCache();
  const db = await loadDB();
  const pwdMigrated = await migratePlaintextPasswords(db);
  if (pwdMigrated) {
    await saveDB(db);
    console.log('🔐 Password hashes migrated for production security.');
  }
}
