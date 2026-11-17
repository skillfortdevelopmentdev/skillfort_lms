const GUEST_CART_KEY = 'skillfort_guest_cart';

export function readGuestCartIds(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

export function writeGuestCartIds(courseIds: string[]): void {
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify([...new Set(courseIds)]));
}

export function addGuestCartId(courseId: string): string[] {
  const next = readGuestCartIds();
  if (!next.includes(courseId)) next.push(courseId);
  writeGuestCartIds(next);
  return next;
}

export function removeGuestCartId(courseId: string): string[] {
  const next = readGuestCartIds().filter((id) => id !== courseId);
  writeGuestCartIds(next);
  return next;
}

export function clearGuestCart(): void {
  localStorage.removeItem(GUEST_CART_KEY);
}
