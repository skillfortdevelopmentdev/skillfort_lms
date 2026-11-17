import { useEffect, useMemo, useState } from 'react';
import type { WallOfSuccessEntry } from '../types';
import { apiFetch } from '../api/client';
import { resolveMediaUrl } from '../api/config';

export default function WallOfSuccessCarousel() {
  const [entries, setEntries] = useState<WallOfSuccessEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch('/api/wall-of-success');
        const data = await resp.json();
        if (!cancelled && resp.ok && Array.isArray(data)) {
          setEntries(data);
        }
      } catch {
        /* public section — hide on failure */
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const marqueeItems = useMemo(() => {
    if (entries.length === 0) return [];
    return [...entries, ...entries];
  }, [entries]);

  if (!loaded || entries.length === 0) {
    return null;
  }

  const durationSeconds = Math.max(80, entries.length * 8);

  return (
    <section
      className="border-y border-dotted border-slate-300 bg-white py-12 sm:py-14"
      aria-label="Wall of Success"
    >
      <div className="mx-auto max-w-7xl space-y-8 px-6 sm:px-12">
        <h2 className="text-center font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Wall of Success
        </h2>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-20" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-20" />

          <div
            className="wall-success-marquee-track flex w-max items-center gap-8 sm:gap-12 md:gap-16"
            style={{ animationDuration: `${durationSeconds}s` }}
          >
            {marqueeItems.map((entry, index) => (
              <div
                key={`${entry.id}-${index}`}
                className="flex h-56 w-44 shrink-0 items-center justify-center sm:h-64 sm:w-52 md:h-72 md:w-60 lg:h-80 lg:w-64"
              >
                <img
                  src={resolveMediaUrl(entry.imageUrl)}
                  alt="SkillFort placement success story"
                  className="h-full w-full object-contain opacity-95 transition-opacity duration-300 hover:opacity-100"
                  loading="lazy"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
