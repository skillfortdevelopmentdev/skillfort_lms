import * as crypto from 'crypto';
import type { DBStore, WallOfSuccessEntry } from '../src/types';
import { deletePlacementSuccessFile } from './uploads/placementSuccess';

export const WALL_OF_SUCCESS_KV_KEY = 'skillfort_wall_of_success';

function isEntry(value: unknown): value is WallOfSuccessEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as WallOfSuccessEntry;
  return (
    typeof row.id === 'string' &&
    typeof row.imageUrl === 'string' &&
    typeof row.filename === 'string' &&
    typeof row.createdAt === 'string'
  );
}

export function getWallOfSuccessEntries(db: DBStore): WallOfSuccessEntry[] {
  const raw = db.platformKv[WALL_OF_SUCCESS_KV_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isEntry).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addWallOfSuccessEntry(
  db: DBStore,
  imageUrl: string,
  filename: string
): WallOfSuccessEntry {
  const entry: WallOfSuccessEntry = {
    id: `placement-${crypto.randomBytes(8).toString('hex')}`,
    imageUrl,
    filename,
    createdAt: new Date().toISOString(),
  };
  const existing = getWallOfSuccessEntries(db);
  db.platformKv[WALL_OF_SUCCESS_KV_KEY] = [entry, ...existing];
  return entry;
}

export async function removeWallOfSuccessEntry(db: DBStore, id: string): Promise<boolean> {
  const existing = getWallOfSuccessEntries(db);
  const target = existing.find((e) => e.id === id);
  if (!target) {
    return false;
  }
  db.platformKv[WALL_OF_SUCCESS_KV_KEY] = existing.filter((e) => e.id !== id);
  void deletePlacementSuccessFile(target.imageUrl, target.filename);
  return true;
}
