import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { parseImageDataUrl } from './imageDataUrl';
import {
  deleteCloudinaryAsset,
  isCloudinaryAssetUrl,
  isCloudinaryConfigured,
  uploadImageToCloudinary,
} from './cloudinaryStorage';
import {
  deleteMediaBlob,
  saveMediaBlob,
  shouldPersistMediaInDatabase,
  uploadsPathToStorageKey,
} from '../mediaBlobs';

export interface SaveImageOptions {
  maxBytes: number;
  localSubdir: string;
  filePrefix: string;
  cloudinaryFolder: string;
}

export interface SavedImage {
  url: string;
  filename: string;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function mimeFromExt(ext: string): string {
  const entry = Object.entries(MIME_TO_EXT).find(([, value]) => value === ext);
  return entry?.[0] ?? 'application/octet-stream';
}

export async function saveImageDataUrl(
  dataUrl: string,
  options: SaveImageOptions
): Promise<SavedImage> {
  const { mime, buffer, ext } = parseImageDataUrl(dataUrl, options.maxBytes);

  if (isCloudinaryConfigured()) {
    return uploadImageToCloudinary(
      buffer,
      options.cloudinaryFolder,
      options.filePrefix,
      ext
    );
  }

  const filename = `${options.filePrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const url = `/uploads/${options.localSubdir}/${filename}`;
  const storagePath = `${options.localSubdir}/${filename}`;

  if (shouldPersistMediaInDatabase()) {
    await saveMediaBlob(storagePath, buffer, mime);
    return { url, filename };
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', options.localSubdir);
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, filename), buffer);

  return { url, filename };
}

export function deleteLocalUploadFile(imageUrl: string, localSubdir: string): void {
  const prefix = `/uploads/${localSubdir}/`;
  if (!imageUrl.startsWith(prefix)) {
    return;
  }
  const basename = path.basename(imageUrl);
  if (!basename || basename.includes('..')) {
    return;
  }
  const filePath = path.join(process.cwd(), 'public', 'uploads', localSubdir, basename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export async function deleteStoredImage(
  imageUrl: string,
  localSubdir: string,
  publicId?: string
): Promise<void> {
  if (isCloudinaryAssetUrl(imageUrl)) {
    await deleteCloudinaryAsset(imageUrl);
    return;
  }
  if (publicId && isCloudinaryConfigured()) {
    await deleteCloudinaryAsset(publicId);
  }

  const storageKey = uploadsPathToStorageKey(imageUrl);
  if (storageKey) {
    await deleteMediaBlob(storageKey);
  }

  deleteLocalUploadFile(imageUrl, localSubdir);
}
