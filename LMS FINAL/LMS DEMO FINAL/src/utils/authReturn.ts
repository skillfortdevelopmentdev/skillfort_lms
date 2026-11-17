const RETURN_KEY = 'skillfort_auth_return';
const CHECKOUT_KEY = 'skillfort_pending_checkout';
const CART_CHECKOUT_KEY = 'skillfort_pending_cart_checkout';

export function setAuthReturn(path: string): void {
  sessionStorage.setItem(RETURN_KEY, path);
}

export function consumeAuthReturn(fallback: string): string {
  const path = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  return path && path.startsWith('/') ? path : fallback;
}

export function setPendingCheckout(courseId: string): void {
  sessionStorage.setItem(CHECKOUT_KEY, courseId);
}

export function consumePendingCheckout(): string | null {
  const courseId = sessionStorage.getItem(CHECKOUT_KEY);
  sessionStorage.removeItem(CHECKOUT_KEY);
  return courseId;
}

export function setPendingCartCheckout(): void {
  sessionStorage.setItem(CART_CHECKOUT_KEY, '1');
}

export function consumePendingCartCheckout(): boolean {
  const pending = sessionStorage.getItem(CART_CHECKOUT_KEY);
  sessionStorage.removeItem(CART_CHECKOUT_KEY);
  return pending === '1';
}

/** After login/register: honour pending checkout before generic return URL. */
export function resolvePostAuthDestination(
  role: 'admin' | 'student',
  fallback: string
): string {
  if (role === 'student' && sessionStorage.getItem(CART_CHECKOUT_KEY)) {
    sessionStorage.removeItem(CART_CHECKOUT_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return '/student/cart?checkout=1';
  }
  const pending = sessionStorage.getItem(CHECKOUT_KEY);
  if (role === 'student' && pending) {
    sessionStorage.removeItem(CHECKOUT_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return `/student/dashboard?buy=${encodeURIComponent(pending)}`;
  }
  return consumeAuthReturn(fallback);
}
