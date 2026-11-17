import { useEffect, useState } from 'react';
import { ArrowRight, Check, Star } from 'lucide-react';
import type { Course, LandingBannerConfig, LandingBannerLinkTarget } from '../types';
import { apiFetch } from '../api/client';
import { resolveMediaUrl } from '../api/config';
import {
  INSTITUTE_CONTACT,
  INSTITUTE_HERO_IMAGE,
  INSTITUTE_TESTIMONIALS,
  POPULAR_COURSES_STATIC,
  WHY_CHOOSE_SKILLFORT,
} from '../data/skillfortInstituteLanding';
import MncPlacementCarousel from './MncPlacementCarousel';
import SkillFortInstituteAbout from './SkillFortInstituteAbout';
import WallOfSuccessCarousel from './WallOfSuccessCarousel';

type HomeTheme = {
  textWhite: string;
  textMuted: string;
  card: string;
  cardHover: string;
  border: string;
};

interface SkillFortInstituteHomeProps {
  courses: Course[];
  theme: HomeTheme;
  onSelectCourse: (courseId: string) => void;
  onGoToCourses: (search?: string) => void;
  onGoToContact: () => void;
  onEnrollNow: () => void;
}

function findCourseByKeyword(courses: Course[], keyword: string): Course | undefined {
  const q = keyword.toLowerCase();
  return courses.find(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
  );
}

function defaultBanner(): LandingBannerConfig {
  return {
    heroImageUrl: INSTITUTE_HERO_IMAGE,
    linkTarget: 'courses',
    updatedAt: '',
  };
}

export default function SkillFortInstituteHome({
  courses,
  theme,
  onSelectCourse,
  onGoToCourses,
  onGoToContact,
  onEnrollNow,
}: SkillFortInstituteHomeProps) {
  const [banner, setBanner] = useState<LandingBannerConfig>(defaultBanner);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await apiFetch('/api/landing-banner');
        if (!resp.ok) return;
        const data = await resp.json();
        setBanner(data as LandingBannerConfig);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const handleBannerClick = () => {
    if (banner.linkTarget === 'courses') onGoToCourses();
    else if (banner.linkTarget === 'contact') onGoToContact();
    else onEnrollNow();
  };

  const handlePopularCourse = (search: string) => {
    const match = findCourseByKeyword(courses, search);
    if (match) {
      onSelectCourse(match.id);
      return;
    }
    onGoToCourses(search);
  };

  return (
    <div className="pb-20">
      {/* Full-width clickable banner — image only */}
      <section className="w-full border-b border-slate-200 bg-slate-100">
        <button
          type="button"
          onClick={handleBannerClick}
          className="block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F89A15] focus-visible:ring-inset"
          aria-label="Open courses and purchase"
        >
          <img
            src={resolveMediaUrl(banner.heroImageUrl)}
            alt="SkillFort promotional offer"
            className="w-full h-auto min-h-[160px] max-h-[min(92vh,900px)] object-cover object-center"
            loading="eager"
          />
        </button>
      </section>

      <MncPlacementCarousel />

      {/* Contact us (landing placement) */}
      <section id="contact" className="border-y border-slate-200 bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-6 sm:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3 text-left">
              <p className="text-[11px] font-mono tracking-widest uppercase text-[#F89A15] font-bold">Contact us</p>
              <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
                SkillFort Software Training and Placement
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Talk to our counsellors for course guidance, batch details, and placement support.
              </p>
              <button
                type="button"
                onClick={onGoToContact}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F89A15] px-6 py-3 text-xs font-bold text-black transition-all hover:bg-slate-900 hover:text-white"
              >
                Contact Us <ArrowRight size={14} />
              </button>
            </div>
            <div className={`rounded-2xl border ${theme.border} ${theme.card} p-6 text-left space-y-3`}>
              <p className={`text-xs ${theme.textMuted}`}>Phone</p>
              <p className={`text-sm font-bold ${theme.textWhite}`}>{INSTITUTE_CONTACT.phone}</p>
              <p className={`text-xs ${theme.textMuted} pt-2`}>Email</p>
              <p className={`text-sm font-bold ${theme.textWhite}`}>{INSTITUTE_CONTACT.email}</p>
              <p className={`text-xs ${theme.textMuted} pt-2`}>Working Hours</p>
              <p className={`text-sm ${theme.textWhite}`}>{INSTITUTE_CONTACT.hours}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular courses */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl space-y-10 px-6 sm:px-12">
          <h2 className="text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Popular Courses
          </h2>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent" />
            <div className="flex gap-6 overflow-x-auto pb-2 snap-x snap-mandatory scroll-px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {POPULAR_COURSES_STATIC.map((course) => (
              <article
                key={course.title}
                className={`group min-w-[280px] sm:min-w-[320px] lg:min-w-[360px] max-w-[360px] snap-start overflow-hidden rounded-2xl border ${theme.border} ${theme.card} ${theme.cardHover} transition-all hover:-translate-y-1`}
              >
                <div className="aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={course.image}
                    alt={course.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="space-y-3 p-6">
                  <h3 className={`font-display text-lg font-bold ${theme.textWhite}`}>{course.title}</h3>
                  <p className={`text-sm leading-relaxed ${theme.textMuted}`}>{course.description}</p>
                  <button
                    type="button"
                    onClick={() => handlePopularCourse(course.search)}
                    className="inline-flex items-center gap-1 text-sm font-bold text-[#F89A15] hover:underline"
                  >
                    View Course <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">Swipe to explore more popular courses</p>
          </div>
        </div>
      </section>

      {/* About us — same content as About Us menu page */}
      <SkillFortInstituteAbout embedded />

      {/* Why choose */}
      <section className="border-y border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 sm:px-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Why Choose SkillFort?</h2>
            <p className="text-sm text-slate-600">
              Job-oriented IT courses with 100% placement support from industry experts.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {WHY_CHOOSE_SKILLFORT.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                <Check size={16} className="mt-0.5 shrink-0 text-[#F89A15]" strokeWidth={3} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Join CTA */}
      <section className="bg-slate-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-3xl space-y-6 px-6 text-center sm:px-12">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Join SkillFort</h2>
          <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
            Whether you&apos;re a student, fresher, or working professional aiming to build or upgrade your
            career, SkillFort Software Training and Placements is the right place to begin your journey.
            Let&apos;s work together to create a future filled with growth, opportunities, and success.
          </p>
          <button
            type="button"
            onClick={onEnrollNow}
            className="rounded-xl bg-[#F89A15] px-8 py-3.5 text-sm font-bold text-black transition-all hover:bg-white"
          >
            Enroll Now
          </button>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl space-y-10 px-6 sm:px-12">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">Student Testimonials</h2>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <span className="font-bold text-emerald-600">EXCELLENT</span>
              <span className="flex text-yellow-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" />
                ))}
              </span>
              <span>Based on 125 Google reviews</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {INSTITUTE_TESTIMONIALS.map((item) => (
              <blockquote
                key={item.name}
                className={`rounded-2xl border ${theme.border} ${theme.card} p-6 space-y-4`}
              >
                <div className="flex text-yellow-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className={`text-sm italic leading-relaxed ${theme.textMuted}`}>
                  &ldquo;{item.comment}&rdquo;
                </p>
                <footer>
                  <p className={`text-sm font-bold ${theme.textWhite}`}>{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.source}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <WallOfSuccessCarousel />
    </div>
  );
}
