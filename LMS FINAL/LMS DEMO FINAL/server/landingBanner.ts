import type { DBStore, LandingBannerConfig, LandingBannerLinkTarget } from '../src/types';
import { INSTITUTE_HERO_IMAGE } from '../src/data/skillfortInstituteLanding';
import { deleteLandingBannerFile } from './uploads/landingBanner';
import { isCloudinaryAssetUrl } from './uploads/cloudinaryStorage';

export const LANDING_BANNER_KV_KEY = 'skillfort_landing_banner';

const LINK_TARGETS = new Set<LandingBannerLinkTarget>(['courses', 'contact', 'register']);

export function getDefaultLandingBanner(): LandingBannerConfig {
  return {
    heroImageUrl: INSTITUTE_HERO_IMAGE,
    linkTarget: 'courses',
    updatedAt: new Date().toISOString(),
  };
}

function parseLinkTarget(value: unknown): LandingBannerLinkTarget | null {
  if (value === 'courses' || value === 'contact' || value === 'register') {
    return value;
  }
  return null;
}

function normalizeConfig(raw: unknown): LandingBannerConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.heroImageUrl !== 'string' || !row.heroImageUrl.trim()) {
    return null;
  }

  const linkTarget =
    parseLinkTarget(row.linkTarget) ??
    parseLinkTarget(row.primaryCtaTarget) ??
    'courses';

  return {
    heroImageUrl: row.heroImageUrl.trim(),
    linkTarget,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
  };
}

export function getLandingBanner(db: DBStore): LandingBannerConfig {
  const raw = db.platformKv[LANDING_BANNER_KV_KEY];
  return normalizeConfig(raw) ?? getDefaultLandingBanner();
}

export function saveLandingBanner(
  db: DBStore,
  input: Partial<LandingBannerConfig>
): { ok: true; config: LandingBannerConfig } | { ok: false; error: string } {
  const current = getLandingBanner(db);
  const nextHeroImageUrl =
    typeof input.heroImageUrl === 'string' && input.heroImageUrl.trim()
      ? input.heroImageUrl.trim()
      : current.heroImageUrl;

  if (
    current.heroImageUrl !== nextHeroImageUrl &&
    (current.heroImageUrl.startsWith('/uploads/landing-banner/') ||
      isCloudinaryAssetUrl(current.heroImageUrl))
  ) {
    void deleteLandingBannerFile(current.heroImageUrl);
  }

  const linkTarget = parseLinkTarget(input.linkTarget) ?? current.linkTarget;

  const config: LandingBannerConfig = {
    heroImageUrl: nextHeroImageUrl,
    linkTarget,
    updatedAt: new Date().toISOString(),
  };

  db.platformKv[LANDING_BANNER_KV_KEY] = config;
  return { ok: true, config };
}
