import { deleteStoredImage, saveImageDataUrl } from './saveImage';

export const LANDING_BANNER_MAX_BYTES = 8 * 1024 * 1024;

export function getLandingBannerUploadDir(): string {
  return 'landing-banner';
}

export async function saveLandingBannerDataUrl(
  dataUrl: string
): Promise<{ url: string; filename: string }> {
  return saveImageDataUrl(dataUrl, {
    maxBytes: LANDING_BANNER_MAX_BYTES,
    localSubdir: 'landing-banner',
    filePrefix: 'hero',
    cloudinaryFolder: 'skillfort-lms/landing-banner',
  });
}

export async function deleteLandingBannerFile(imageUrl: string): Promise<void> {
  await deleteStoredImage(imageUrl, 'landing-banner');
}
