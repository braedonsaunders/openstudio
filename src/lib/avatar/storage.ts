// Avatar image storage utilities

import { uploadUserAvatarImage } from '@/lib/storage/r2';

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload a user's avatar image (full-body, headshot, or thumbnail)
 */
export async function uploadAvatarImage(
  userId: string,
  dataUrl: string,
  imageType: 'full-body' | 'headshot' | 'thumb-xs' | 'thumb-sm' | 'thumb-md' | 'thumb-lg'
): Promise<UploadResult> {
  return uploadUserAvatarImage(userId, dataUrl, imageType);
}
