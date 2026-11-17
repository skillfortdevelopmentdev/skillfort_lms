import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getCourseBannerUploadDir,
  saveCourseBannerDataUrl,
} from '../uploads/courseBanner';

describe('saveCourseBannerDataUrl', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillfort-banner-'));
    process.chdir(tempDir);
    fs.mkdirSync(path.join(tempDir, 'public', 'uploads', 'course-banners'), { recursive: true });
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves a valid PNG data URL and returns a public path', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    const result = await saveCourseBannerDataUrl(dataUrl);

    expect(result.url).toMatch(/^\/uploads\/course-banners\/banner-/);
    expect(fs.existsSync(path.join(getCourseBannerUploadDir(), result.filename))).toBe(true);
  });

  it('rejects invalid data URLs', async () => {
    await expect(saveCourseBannerDataUrl('not-an-image')).rejects.toThrow(/Invalid image format/);
  });
});
