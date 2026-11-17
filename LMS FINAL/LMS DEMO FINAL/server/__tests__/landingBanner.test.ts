import { getDefaultLandingBanner, getLandingBanner, saveLandingBanner } from '../landingBanner';
import type { DBStore } from '../../src/types';
import { INITIAL_SETTINGS } from '../../src/data';

function makeStore(): DBStore {
  return {
    settings: { ...INITIAL_SETTINGS },
    users: [],
    passwords: {},
    courses: [],
    modules: [],
    lessons: [],
    progress: [],
    enrollments: [],
    coupons: [],
    payments: [],
    certificates: [],
    platformKv: {},
  };
}

describe('landingBanner', () => {
  test('returns image-only defaults', () => {
    const db = makeStore();
    const banner = getLandingBanner(db);
    expect(banner.heroImageUrl).toContain('85265');
    expect(banner.linkTarget).toBe('courses');
  });

  test('saves link target for purchase flow', () => {
    const db = makeStore();
    const result = saveLandingBanner(db, { linkTarget: 'register' });
    expect(result.ok).toBe(true);
    expect(getLandingBanner(db).linkTarget).toBe('register');
  });

  test('migrates legacy banner config', () => {
    const db = makeStore();
    db.platformKv.skillfort_landing_banner = {
      heroImageUrl: '/uploads/landing-banner/hero-test.webp',
      primaryCtaTarget: 'contact',
      eyebrow: 'Old field',
    };
    const loaded = getLandingBanner(db);
    expect(loaded.heroImageUrl).toBe('/uploads/landing-banner/hero-test.webp');
    expect(loaded.linkTarget).toBe('contact');
  });

  test('reset uses defaults for missing fields', () => {
    const db = makeStore();
    saveLandingBanner(db, { linkTarget: 'courses' });
    expect(getLandingBanner(db).linkTarget).toBe('courses');
    expect(getDefaultLandingBanner().linkTarget).toBe('courses');
  });
});
