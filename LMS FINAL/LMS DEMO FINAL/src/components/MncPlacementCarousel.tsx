import { INSTITUTE_MNC_LOGOS } from '../data/skillfortInstituteLanding';

export default function MncPlacementCarousel() {
  const marqueeItems = [...INSTITUTE_MNC_LOGOS, ...INSTITUTE_MNC_LOGOS];

  return (
    <section
      className="border-y border-dotted border-slate-300 bg-white py-10 sm:py-12"
      aria-label="Top MNC placement partners"
    >
      <div className="mx-auto max-w-7xl space-y-8 px-6 sm:px-12">
        <h2 className="text-center font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Top MNCs Where SkillFort Students Are Placed
        </h2>

        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-20" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-20" />

          <div className="mnc-marquee-track flex w-max items-center gap-8 sm:gap-12 md:gap-16">
            {marqueeItems.map((company, index) => (
              <div
                key={`${company.name}-${index}`}
                className="flex h-12 w-24 shrink-0 items-center justify-center sm:h-14 sm:w-28 md:w-32"
                title={company.name}
              >
                <img
                  src={company.logo}
                  alt={`${company.name} logo`}
                  className="max-h-9 w-auto max-w-full object-contain opacity-90 transition-opacity duration-300 hover:opacity-100 sm:max-h-11"
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
