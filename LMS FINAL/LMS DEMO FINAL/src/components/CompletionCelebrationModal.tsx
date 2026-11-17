import React, { useEffect, useRef } from 'react';
import { Award, Download, PartyPopper, Sparkles, X } from 'lucide-react';
import type { Certificate } from '../types';

interface CompletionCelebrationModalProps {
  certificate: Certificate;
  onViewCertificate: () => void;
  onDownloadCertificate?: () => void;
  onClose: () => void;
}

type ConfettiPiece = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  vx: number;
  vy: number;
  opacity: number;
};

const CONFETTI_COLORS = ['#F89A15', '#FFD166', '#22C55E', '#FFFFFF', '#F97316', '#A855F7'];

function launchConfetti(canvas: HTMLCanvasElement, durationMs = 4500) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const pieces: ConfettiPiece[] = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * -0.5 - 20,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 2.5,
    vy: 2 + Math.random() * 4,
    opacity: 0.85 + Math.random() * 0.15,
  }));

  let frameId = 0;
  const startedAt = performance.now();

  const tick = (now: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const piece of pieces) {
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.vy += 0.04;
      piece.rotation += piece.rotationSpeed;

      if (piece.y > canvas.height + 30) {
        piece.y = -20;
        piece.x = Math.random() * canvas.width;
        piece.vy = 2 + Math.random() * 3;
      }

      ctx.save();
      ctx.globalAlpha = piece.opacity;
      ctx.translate(piece.x, piece.y);
      ctx.rotate((piece.rotation * Math.PI) / 180);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    }

    if (now - startedAt < durationMs) {
      frameId = requestAnimationFrame(tick);
    }
  };

  frameId = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
  };
}

export default function CompletionCelebrationModal({
  certificate,
  onViewCertificate,
  onDownloadCertificate,
  onClose,
}: CompletionCelebrationModalProps) {
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return undefined;
    return launchConfetti(canvas);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <>
      <canvas
        ref={confettiCanvasRef}
        className="pointer-events-none fixed inset-0 z-[110]"
        aria-hidden
      />

      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-celebration-title"
      >
        <div className="relative w-full max-w-lg animate-[celebrationPop_0.55s_cubic-bezier(0.22,1,0.36,1)] rounded-3xl border border-[#F89A15]/35 bg-gradient-to-b from-[#161616] via-[#0d0d0d] to-black p-8 text-center shadow-2xl shadow-[#F89A15]/20">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close celebration"
          >
            <X size={18} />
          </button>

          <div className="pointer-events-none absolute -top-8 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-[#F89A15]/20 blur-2xl" />

          <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#F89A15]/10" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#F89A15]/50 bg-[#F89A15]/15 shadow-lg shadow-[#F89A15]/20">
              <Award size={42} className="animate-[celebrationBounce_1.2s_ease-in-out_infinite] text-[#F89A15]" />
            </div>
          </div>

          <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#F89A15]">
            <PartyPopper size={14} className="animate-pulse" />
            Course completed
            <Sparkles size={14} className="animate-pulse" />
          </div>

          <h2
            id="completion-celebration-title"
            className="mb-2 font-display text-3xl font-black text-white"
          >
            Congratulations, {certificate.userName.split(' ')[0]}!
          </h2>

          <p className="mb-1 text-sm leading-relaxed text-gray-400">
            You successfully completed
          </p>
          <p className="mb-2 text-base font-bold text-white">{certificate.courseTitle}</p>
          <p className="mb-7 font-mono text-[11px] text-[#F89A15]">
            Certificate #{certificate.certificateNumber}
          </p>
          <p className="mb-7 text-[11px] text-gray-500">{certificate.issueDate}</p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onViewCertificate}
              className="flex-1 rounded-xl bg-[#F89A15] py-3.5 text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-white"
            >
              View certificate
            </button>
            {onDownloadCertificate && (
              <button
                type="button"
                onClick={onDownloadCertificate}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-emerald-400"
              >
                <Download size={14} /> Download
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl border border-[#222222] py-3 text-xs font-bold uppercase tracking-wider text-gray-400 transition-all hover:border-[#F89A15]/40 hover:text-white"
          >
            Keep learning
          </button>
        </div>
      </div>

      <style>{`
        @keyframes celebrationPop {
          0% { opacity: 0; transform: scale(0.82) translateY(24px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes celebrationBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </>
  );
}
