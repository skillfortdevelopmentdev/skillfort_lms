import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X, Award } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.action ? 8000 : 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const Icon =
    toast.type === 'error' ? AlertCircle : toast.type === 'info' ? Award : CheckCircle;
  const borderColor =
    toast.type === 'error'
      ? 'border-red-500/30'
      : toast.type === 'info'
        ? 'border-[#F89A15]/40'
        : 'border-emerald-500/30';
  const iconColor =
    toast.type === 'error'
      ? 'text-red-400'
      : toast.type === 'info'
        ? 'text-[#F89A15]'
        : 'text-emerald-400';

  return (
    <div className="fixed bottom-6 right-6 z-[100] max-w-sm">
      <div
        className={`bg-[#111111] border ${borderColor} rounded-xl p-4 shadow-2xl flex gap-3 items-start`}
        role="status"
        aria-live="polite"
      >
        <Icon size={20} className={`${iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 space-y-2 min-w-0">
          <p className="text-xs text-white leading-relaxed">{toast.message}</p>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick();
                onDismiss();
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-[#F89A15] hover:text-white transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-gray-500 hover:text-white shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', action?: ToastAction) => {
      setToast({ id: Date.now(), message, type, action });
    },
    []
  );

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}
