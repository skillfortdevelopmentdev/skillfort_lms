import {
  addWallOfSuccessEntry,
  getWallOfSuccessEntries,
  removeWallOfSuccessEntry,
  WALL_OF_SUCCESS_KV_KEY,
} from '../wallOfSuccess';
import type { DBStore } from '../../src/types';
import { INITIAL_SETTINGS } from '../../src/data';

function makeStore(): DBStore {
  return {
    settings: { ...INITIAL_SETTINGS },
    users: [],
    passwords: {},
    courses: [],
    modules: [],
    lessons: [],
    progress: [],
    enrollments: [],
    coupons: [],
    payments: [],
    certificates: [],
    platformKv: {},
  };
}

describe('wallOfSuccess', () => {
  test('adds and lists entries newest first', () => {
    const db = makeStore();
    const first = addWallOfSuccessEntry(db, '/uploads/placements/a.jpg', 'a.jpg');
    const second = addWallOfSuccessEntry(db, '/uploads/placements/b.jpg', 'b.jpg');

    expect(second.createdAt >= first.createdAt).toBe(true);

    const list = getWallOfSuccessEntries(db);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(second.id);
    expect(list[1].id).toBe(first.id);
    expect(db.platformKv[WALL_OF_SUCCESS_KV_KEY]).toHaveLength(2);
  });

  test('removes entry from store', async () => {
    const db = makeStore();
    const entry = addWallOfSuccessEntry(db, '/uploads/placements/c.jpg', 'c.jpg');
    await expect(removeWallOfSuccessEntry(db, entry.id)).resolves.toBe(true);
    expect(getWallOfSuccessEntries(db)).toHaveLength(0);
    await expect(removeWallOfSuccessEntry(db, 'missing')).resolves.toBe(false);
  });
});
