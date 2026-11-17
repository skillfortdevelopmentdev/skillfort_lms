import * as fs from 'fs';
import * as path from 'path';
import { saveImageDataUrl } from './saveImage';

export const COURSE_BANNER_MAX_BYTES = 5 * 1024 * 1024;

export function getCourseBannerUploadDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'course-banners');
}

export function ensureCourseBannerUploadDir(): void {
  fs.mkdirSync(getCourseBannerUploadDir(), { recursive: true });
}

export async function saveCourseBannerDataUrl(
  dataUrl: string
): Promise<{ url: string; filename: string }> {
  return saveImageDataUrl(dataUrl, {
    maxBytes: COURSE_BANNER_MAX_BYTES,
    localSubdir: 'course-banners',
    filePrefix: 'banner',
    cloudinaryFolder: 'skillfort-lms/course-banners',
  });
}
