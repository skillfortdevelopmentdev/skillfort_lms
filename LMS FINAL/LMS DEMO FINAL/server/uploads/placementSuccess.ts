import { deleteStoredImage, saveImageDataUrl } from './saveImage';

export const PLACEMENT_SUCCESS_MAX_BYTES = 8 * 1024 * 1024;

export function getPlacementSuccessUploadDir(): string {
  return 'placements';
}

export async function savePlacementSuccessDataUrl(
  dataUrl: string
): Promise<{ url: string; filename: string }> {
  return saveImageDataUrl(dataUrl, {
    maxBytes: PLACEMENT_SUCCESS_MAX_BYTES,
    localSubdir: 'placements',
    filePrefix: 'placement',
    cloudinaryFolder: 'skillfort-lms/placements',
  });
}

export async function deletePlacementSuccessFile(
  imageUrl: string,
  publicId?: string
): Promise<void> {
  await deleteStoredImage(imageUrl, 'placements', publicId);
}
