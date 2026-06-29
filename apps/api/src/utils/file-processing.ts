import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/** PDFs are capped at a rigid 2.0 MB. */
export const PDF_MAX_BYTES = 2 * 1024 * 1024;
/** Images are transcoded to WebP at this quality (cost & space optimization). */
export const WEBP_QUALITY = 80;

/** Raster image types we transcode to WebP. SVG is left as-is (vector). */
const TRANSCODE_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/tiff', 'image/bmp', 'image/gif',
]);

export interface ProcessedUpload {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  /** true when the original was transcoded to WebP. */
  transcoded: boolean;
}

/**
 * Normalize an uploaded file before it hits storage:
 *  - PDF  → enforce the 2.0 MB limit (reject if larger).
 *  - image → transcode to WebP @ 80% quality (smaller, cheaper, uniform).
 *  - other → stored as-is (the controller already caps overall size at 10 MB).
 */
export async function processUpload(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<ProcessedUpload> {
  const mime = (file.mimetype || '').toLowerCase();

  if (mime === 'application/pdf') {
    if (file.buffer.length > PDF_MAX_BYTES) {
      const mb = (file.buffer.length / 1048576).toFixed(2);
      throw new BadRequestException(`PDF exceeds the 2.0 MB limit (got ${mb} MB). Please compress the PDF.`);
    }
    return { buffer: file.buffer, fileName: file.originalname, contentType: mime, transcoded: false };
  }

  if (mime.startsWith('image/') && TRANSCODE_MIME.has(mime)) {
    try {
      const out = await sharp(file.buffer, { animated: mime === 'image/gif' })
        .rotate() // honor EXIF orientation
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      const base = file.originalname.replace(/\.[^.]+$/, '') || 'image';
      return { buffer: out, fileName: `${base}.webp`, contentType: 'image/webp', transcoded: true };
    } catch {
      // A corrupt/undecodable image is stored as-is rather than failing the upload.
      return { buffer: file.buffer, fileName: file.originalname, contentType: mime, transcoded: false };
    }
  }

  return { buffer: file.buffer, fileName: file.originalname, contentType: mime, transcoded: false };
}
