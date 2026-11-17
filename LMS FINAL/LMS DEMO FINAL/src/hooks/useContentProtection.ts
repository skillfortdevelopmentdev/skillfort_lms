import { useCallback, useEffect, useState, type MouseEvent } from 'react';

const BLOCKED_COMBOS = new Set([
  'p', // print
  's', // save
  'u', // view source
  'c', // copy (with ctrl)
  'a', // select all
]);

export interface UseContentProtectionOptions {
  enabled: boolean;
  onShield?: () => void;
  onUnshield?: () => void;
}

/**
 * Deters casual capture: shields content when the tab loses focus or
 * visibility, and blocks common copy/print shortcuts while active.
 * Cannot stop OS-level screenshots or external cameras (same as any web app).
 */
export function useContentProtection({
  enabled,
  onShield,
  onUnshield,
}: UseContentProtectionOptions) {
  const [shielded, setShielded] = useState(false);

  const shield = useCallback(() => {
    setShielded(true);
    onShield?.();
  }, [onShield]);

  const unshield = useCallback(() => {
    setShielded(false);
    onUnshield?.();
  }, [onUnshield]);

  useEffect(() => {
    if (!enabled) {
      setShielded(false);
      return;
    }

    const handleVisibility = () => {
      if (document.hidden) {
        shield();
      } else {
        unshield();
      }
    };

    const handleBlur = () => {
      shield();
    };

    const handleFocus = () => {
      if (!document.hidden) {
        unshield();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;

      if (key === 'printscreen' || event.keyCode === 44) {
        event.preventDefault();
        shield();
        return;
      }

      if (meta && BLOCKED_COMBOS.has(key)) {
        event.preventDefault();
        return;
      }

      if (event.ctrlKey && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
        event.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, shield, unshield]);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      if (!enabled) return;
      event.preventDefault();
    },
    [enabled]
  );

  return { shielded, handleContextMenu };
}
