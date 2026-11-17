import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import { Course } from '../types';
import {
  addGuestCartId,
  clearGuestCart,
  readGuestCartIds,
  removeGuestCartId,
  writeGuestCartIds,
} from '../utils/guestCart';

type UseCartOptions = {
  isAuthenticatedStudent: boolean;
  courses: Course[];
};

function resolveCartItems(courseIds: string[], courses: Course[]): Course[] {
  return courseIds
    .map((id) => courses.find((c) => c.id === id))
    .filter((c): c is Course => Boolean(c));
}

export function useCart({ isAuthenticatedStudent, courses }: UseCartOptions) {
  const [cartItems, setCartItems] = useState<Course[]>([]);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const mergedGuestRef = useRef(false);

  const syncGuestState = useCallback(
    (ids: string[]) => {
      setCourseIds(ids);
      setCartItems(resolveCartItems(ids, courses));
    },
    [courses]
  );

  const refreshServer = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/cart');
      if (resp.ok) {
        const data = await resp.json();
        const ids: string[] = data.courseIds ?? [];
        setCourseIds(ids);
        setCartItems(data.items ?? resolveCartItems(ids, courses));
      }
    } finally {
      setLoading(false);
    }
  }, [courses]);

  const refresh = useCallback(async () => {
    if (isAuthenticatedStudent) {
      await refreshServer();
      return;
    }
    syncGuestState(readGuestCartIds());
  }, [isAuthenticatedStudent, refreshServer, syncGuestState]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticatedStudent) {
      mergedGuestRef.current = false;
      syncGuestState(readGuestCartIds());
      return;
    }

    const guestIds = readGuestCartIds();
    if (guestIds.length === 0 || mergedGuestRef.current) {
      return;
    }

    mergedGuestRef.current = true;

    (async () => {
      try {
        const resp = await apiFetch('/api/cart');
        let serverIds: string[] = [];
        if (resp.ok) {
          const data = await resp.json();
          serverIds = data.courseIds ?? [];
        }
        const merged = [...new Set([...serverIds, ...guestIds])];
        const putResp = await apiFetch('/api/cart', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseIds: merged }),
        });
        if (putResp.ok) {
          clearGuestCart();
        }
        await refreshServer();
      } catch {
        mergedGuestRef.current = false;
      }
    })();
  }, [isAuthenticatedStudent, refreshServer, syncGuestState]);

  const addToCart = useCallback(
    async (courseId: string) => {
      if (isAuthenticatedStudent) {
        const resp = await apiFetch('/api/cart/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Could not add to cart');
        const ids: string[] = data.courseIds ?? [];
        setCourseIds(ids);
        setCartItems(data.items ?? resolveCartItems(ids, courses));
        return data;
      }

      const ids = addGuestCartId(courseId);
      syncGuestState(ids);
      return { courseIds: ids, items: resolveCartItems(ids, courses) };
    },
    [isAuthenticatedStudent, courses, syncGuestState]
  );

  const removeFromCart = useCallback(
    async (courseId: string) => {
      if (isAuthenticatedStudent) {
        const resp = await apiFetch(`/api/cart/${encodeURIComponent(courseId)}`, {
          method: 'DELETE',
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Could not remove from cart');
        const ids: string[] = data.courseIds ?? [];
        setCourseIds(ids);
        setCartItems(data.items ?? resolveCartItems(ids, courses));
        return data;
      }

      const ids = removeGuestCartId(courseId);
      syncGuestState(ids);
      return { courseIds: ids, items: resolveCartItems(ids, courses) };
    },
    [isAuthenticatedStudent, courses, syncGuestState]
  );

  const replaceGuestCart = useCallback(
    (ids: string[]) => {
      writeGuestCartIds(ids);
      syncGuestState(ids);
    },
    [syncGuestState]
  );

  return {
    cartItems,
    courseIds,
    cartCount: courseIds.length,
    loading,
    refresh,
    addToCart,
    removeFromCart,
    replaceGuestCart,
  };
}
