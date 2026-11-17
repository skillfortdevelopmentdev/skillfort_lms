import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useContentProtection } from '../hooks/useContentProtection';

interface ContentProtectionShellProps {
  enabled: boolean;
  watermarkText: string;
  onShield?: () => void;
  children: React.ReactNode;
  className?: string;
}

export default function ContentProtectionShell({
  enabled,
  watermarkText,
  onShield,
  children,
  className = '',
}: ContentProtectionShellProps) {
  const { shielded, handleContextMenu } = useContentProtection({
    enabled,
    onShield,
  });

  return (
    <div
      className={`content-protected-root relative select-none ${className}`}
      onContextMenu={handleContextMenu}
      data-content-protection={enabled ? 'on' : 'off'}
    >
      {children}

      {enabled && (
        <div
          className="content-protection-watermark pointer-events-none absolute inset-0 z-[20] overflow-hidden"
          aria-hidden
        >
          {Array.from({ length: 8 }).map((_, row) => (
            <div
              key={row}
              className="whitespace-nowrap text-[11px] font-mono font-semibold tracking-wider text-white/[0.07]"
              style={{
                transform: 'rotate(-24deg)',
                marginTop: row * 72 - 24,
                marginLeft: -40,
              }}
            >
              {Array.from({ length: 6 }).map((__, col) => (
                <span key={col} className="mx-16 inline-block">
                  {watermarkText}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {enabled && shielded && (
        <div className="content-protection-shield absolute inset-0 z-[30] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl">
          <ShieldAlert size={40} className="mb-3 text-[#F89A15]" />
          <p className="font-display text-sm font-bold text-white">Content protected</p>
          <p className="mt-1 max-w-xs px-6 text-center text-[11px] text-gray-400">
            Video is hidden while you switch tabs or record the screen. Return to this tab to
            continue learning.
          </p>
        </div>
      )}
    </div>
  );
}
