import * as crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
      process.env.CLOUDINARY_API_KEY?.trim() &&
      process.env.CLOUDINARY_API_SECRET?.trim()
  );
}

function ensureCloudinaryConfig(): void {
  if (configured || !isCloudinaryConfigured()) {
    return;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
    api_key: process.env.CLOUDINARY_API_KEY!.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
    secure: true,
  });
  configured = true;
}

export interface CloudinaryUploadResult {
  url: string;
  filename: string;
}

export async function uploadImageToCloudinary(
  buffer: Buffer,
  folder: string,
  filePrefix: string,
  ext: string
): Promise<CloudinaryUploadResult> {
  ensureCloudinaryConfig();
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }

  const publicId = `${filePrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const result = await new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        format: ext,
        resource_type: 'image',
      },
      (error, uploadResult) => {
        if (error || !uploadResult?.secure_url) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({
          url: uploadResult.secure_url,
          filename: uploadResult.public_id,
        });
      }
    );
    uploadStream.end(buffer);
  });

  return result;
}

export function isCloudinaryAssetUrl(url: string): boolean {
  return url.includes('res.cloudinary.com/');
}

export async function deleteCloudinaryAsset(urlOrPublicId: string): Promise<void> {
  if (!urlOrPublicId || !isCloudinaryConfigured()) {
    return;
  }
  ensureCloudinaryConfig();

  let publicId = urlOrPublicId;
  if (isCloudinaryAssetUrl(urlOrPublicId)) {
    const withoutQuery = urlOrPublicId.split('?')[0];
    const uploadIndex = withoutQuery.indexOf('/upload/');
    if (uploadIndex === -1) {
      return;
    }
    const afterUpload = withoutQuery.slice(uploadIndex + '/upload/'.length);
    const segments = afterUpload.split('/');
    const versionIdx = segments[0]?.startsWith('v') && /^v\d+$/.test(segments[0]) ? 1 : 0;
    const pathPart = segments.slice(versionIdx).join('/');
    publicId = pathPart.replace(/\.[a-zA-Z0-9]+$/, '');
  }

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch {
    // Best-effort cleanup — missing assets are fine.
  }
}
