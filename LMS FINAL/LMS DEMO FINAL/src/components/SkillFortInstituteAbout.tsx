import { Check } from 'lucide-react';
import {
  INSTITUTE_ABOUT,
  INSTITUTE_ABOUT_INTRO_IMAGE,
  INSTITUTE_ABOUT_PAGE,
  INSTITUTE_ABOUT_TRAINING_IMAGE,
} from '../data/skillfortInstituteLanding';

interface SkillFortInstituteAboutProps {
  /** When true, omits standalone page title — for embedding on the home landing page */
  embedded?: boolean;
}

export default function SkillFortInstituteAbout({ embedded = false }: SkillFortInstituteAboutProps) {
  return (
    <div className={`bg-white text-slate-800 ${embedded ? '' : 'pb-20'}`} id={embedded ? 'about' : undefined}>
      {!embedded && (
        <section className="border-b border-slate-200 bg-white py-12 sm:py-14">
          <div className="mx-auto max-w-7xl px-6 sm:px-12">
            <h1 className="text-center font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {INSTITUTE_ABOUT_PAGE.pageTitle}
            </h1>
          </div>
        </section>
      )}

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 sm:px-12 lg:grid-cols-2 lg:gap-14">
          <div className="order-2 lg:order-1">
            <img
              src={INSTITUTE_ABOUT_INTRO_IMAGE}
              alt="SkillFort Software Training and Placements"
              className="w-full rounded-2xl border border-slate-200 object-cover shadow-lg"
              loading="eager"
            />
          </div>
          <div className="order-1 space-y-5 lg:order-2">
            <h2 className="font-display text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
              {INSTITUTE_ABOUT_PAGE.introHeading}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {INSTITUTE_ABOUT.welcome}
            </p>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {INSTITUTE_ABOUT.founded}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto max-w-4xl space-y-5 px-6 text-center sm:px-12">
          <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            {INSTITUTE_ABOUT_PAGE.whoWeAre.title}
          </h2>
          {INSTITUTE_ABOUT_PAGE.whoWeAre.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 sm:px-12 lg:grid-cols-2 lg:gap-14">
          <div className="space-y-5">
            <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              {INSTITUTE_ABOUT_PAGE.whatWeDo.title}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {INSTITUTE_ABOUT_PAGE.whatWeDo.intro}
            </p>
            <ul className="space-y-2.5">
              {INSTITUTE_ABOUT_PAGE.whatWeDo.courses.map((course) => (
                <li
                  key={course}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <Check size={16} className="mt-0.5 shrink-0 text-[#F89A15]" strokeWidth={3} />
                  <span>{course}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {INSTITUTE_ABOUT_PAGE.whatWeDo.outro}
            </p>
          </div>
          <div>
            <img
              src={INSTITUTE_ABOUT_TRAINING_IMAGE}
              alt="SkillFort training and placement programs"
              className="w-full rounded-2xl border border-slate-200 object-cover shadow-lg"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 sm:px-12 md:grid-cols-2 md:gap-14">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {INSTITUTE_ABOUT_PAGE.vision.title}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              {INSTITUTE_ABOUT_PAGE.vision.text}
            </p>
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="font-display text-2xl font-bold text-slate-900">
              {INSTITUTE_ABOUT_PAGE.mission.title}
            </h2>
            <ul className="space-y-3">
              {INSTITUTE_ABOUT_PAGE.mission.items.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                  <Check size={16} className="mt-0.5 shrink-0 text-[#F89A15]" strokeWidth={3} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
