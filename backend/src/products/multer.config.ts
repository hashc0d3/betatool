import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const uploadDir = join(process.cwd(), 'uploads', 'products');

export const productImageStorage = diskStorage({
  destination: (_req, _file, cb) => {
    mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

export function imageFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  if (!file.mimetype.startsWith('image/')) {
    cb(new Error('Только изображения'), false);
    return;
  }
  cb(null, true);
}
