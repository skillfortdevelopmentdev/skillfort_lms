import { DBStore } from '../src/types';

export function cartKey(userId: string): string {
  return `skillfort_cart_${userId}`;
}

export function readCartIds(db: DBStore, userId: string): string[] {
  const raw = db.platformKv[cartKey(userId)];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string');
}

export function writeCartIds(db: DBStore, userId: string, courseIds: string[]): void {
  db.platformKv[cartKey(userId)] = [...new Set(courseIds)];
  db.platformKv[`skillfort_cart_meta_${userId}`] = {
    updatedAt: new Date().toISOString(),
  };
}

export function addToCart(db: DBStore, userId: string, courseId: string): string[] {
  const next = readCartIds(db, userId);
  if (!next.includes(courseId)) next.push(courseId);
  writeCartIds(db, userId, next);
  return next;
}

export function removeFromCart(db: DBStore, userId: string, courseId: string): string[] {
  const next = readCartIds(db, userId).filter((id) => id !== courseId);
  writeCartIds(db, userId, next);
  return next;
}

export function clearPurchasedFromCart(
  db: DBStore,
  userId: string,
  purchasedIds: string[]
): string[] {
  const purchased = new Set(purchasedIds);
  const next = readCartIds(db, userId).filter((id) => !purchased.has(id));
  writeCartIds(db, userId, next);
  return next;
}
