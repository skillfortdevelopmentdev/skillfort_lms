import type { Course, DBStore, SystemSettings, User } from '../src/types';
import { saveDB } from './db/index';
import { readCartIds } from './cart';
import { notifyAbandonedCart, notifyAbandonedWishlist } from './mail/send';

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;

interface ReminderMeta {
  updatedAt: string;
  reminderSentAt?: string;
}

function cartMetaKey(userId: string): string {
  return `skillfort_cart_meta_${userId}`;
}

function wishlistMetaKey(userId: string): string {
  return `skillfort_wishlist_meta_${userId}`;
}

function wishlistKey(userId: string): string {
  return `skillfort_wishlist_${userId}`;
}

function readMeta(db: DBStore, key: string): ReminderMeta | null {
  const raw = db.platformKv[key];
  if (!raw || typeof raw !== 'object') return null;
  const meta = raw as ReminderMeta;
  if (typeof meta.updatedAt !== 'string') return null;
  return meta;
}

function writeMeta(db: DBStore, key: string, meta: ReminderMeta): void {
  db.platformKv[key] = meta;
}

export function touchCartMeta(db: DBStore, userId: string): void {
  writeMeta(db, cartMetaKey(userId), {
    updatedAt: new Date().toISOString(),
  });
}

export function touchWishlistMeta(db: DBStore, userId: string): void {
  writeMeta(db, wishlistMetaKey(userId), {
    updatedAt: new Date().toISOString(),
  });
}

function readWishlistIds(db: DBStore, userId: string): string[] {
  const raw = db.platformKv[wishlistKey(userId)];
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === 'string');
}

function shouldSendReminder(meta: ReminderMeta | null, now: number): boolean {
  if (!meta?.updatedAt) return false;
  if (meta.reminderSentAt) return false;
  const updatedAt = new Date(meta.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return now - updatedAt >= REMINDER_AFTER_MS;
}

export async function checkAbandonedReminders(
  db: DBStore,
  user: User,
  settings: SystemSettings
): Promise<void> {
  const now = Date.now();
  const userId = user.id;
  let dirty = false;

  const cartIds = readCartIds(db, userId);
  if (cartIds.length > 0) {
    const cartMeta = readMeta(db, cartMetaKey(userId));
    if (shouldSendReminder(cartMeta, now)) {
      const courses = cartIds
        .map((id) => db.courses.find((c) => c.id === id))
        .filter((c): c is Course => Boolean(c));
      if (courses.length > 0) {
        await notifyAbandonedCart(settings, user, courses);
        writeMeta(db, cartMetaKey(userId), {
          updatedAt: cartMeta!.updatedAt,
          reminderSentAt: new Date().toISOString(),
        });
        dirty = true;
      }
    }
  }

  const wishlistIds = readWishlistIds(db, userId);
  if (wishlistIds.length > 0) {
    const wishlistMeta = readMeta(db, wishlistMetaKey(userId));
    if (shouldSendReminder(wishlistMeta, now)) {
      const courses = wishlistIds
        .map((id) => db.courses.find((c) => c.id === id))
        .filter((c): c is Course => Boolean(c));
      if (courses.length > 0) {
        await notifyAbandonedWishlist(settings, user, courses);
        writeMeta(db, wishlistMetaKey(userId), {
          updatedAt: wishlistMeta!.updatedAt,
          reminderSentAt: new Date().toISOString(),
        });
        dirty = true;
      }
    }
  }

  if (dirty) {
    await saveDB(db);
  }
}
