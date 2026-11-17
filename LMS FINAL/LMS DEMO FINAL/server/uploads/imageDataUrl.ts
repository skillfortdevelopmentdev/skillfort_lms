const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface ParsedImageDataUrl {
  mime: string;
  ext: string;
  buffer: Buffer;
}

export function parseImageDataUrl(dataUrl: string, maxBytes: number): ParsedImageDataUrl {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) {
    throw new Error('Invalid image format. Use JPG, PNG, WebP, or GIF.');
  }

  const mime = match[1].toLowerCase();
  const ext = MIME_TO_EXT[mime];
  if (!ext) {
    throw new Error('Unsupported image type.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`Image must be ${maxMb} MB or smaller.`);
  }

  return { mime, ext, buffer };
}
