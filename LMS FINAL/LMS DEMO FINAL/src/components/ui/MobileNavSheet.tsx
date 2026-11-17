import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileNavSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  isDarkMode?: boolean;
  children: React.ReactNode;
}

export default function MobileNavSheet({
  open,
  onClose,
  title = 'Menu',
  isDarkMode = true,
  children,
}: MobileNavSheetProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop — blur + dim so page content shows through instead of a flat wash */}
      <button
        type="button"
        aria-label="Close menu"
        className="absolute inset-0 bg-black/70 backdrop-blur-[6px] transition-opacity"
        onClick={onClose}
      />
      <div
        className={`absolute inset-y-0 right-0 flex w-[min(100vw-2rem,20rem)] flex-col shadow-2xl ${
          isDarkMode
            ? 'border-l border-[#222222] bg-[#0A0A0A]'
            : 'border-l border-slate-200 bg-white'
        }`}
      >
        <div
          className={`flex h-14 shrink-0 items-center justify-between border-b px-4 ${
            isDarkMode ? 'border-[#222222]' : 'border-slate-200'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-widest text-[#F89A15]">{title}</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className={`rounded-lg border p-2 transition-colors ${
              isDarkMode
                ? 'border-[#222222] text-gray-400 hover:text-white'
                : 'border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
      </div>
    </div>
  );
}
