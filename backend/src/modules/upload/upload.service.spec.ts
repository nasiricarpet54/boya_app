import { promises as fs } from 'fs';
import os from 'os';
import { join } from 'path';

import { UploadService, UploadedImageFile } from './upload.service';
import { PERSIAN_ERRORS } from '../../common/persian-errors';

/**
 * Unit coverage for the local-storage upload backend.
 *
 * Nothing here reaches the database, and the disk it touches is a private
 * temp directory (`UPLOAD_DIR` is pointed there for the duration of the
 * suite), so a run leaves no files behind in the checkout. Each case asserts
 * the exact Persian message / public URL the app consumes downstream.
 */
describe('UploadService', () => {
  let service: UploadService;
  let uploadDir: string;
  let previousUploadDir: string | undefined;

  const mockFile: UploadedImageFile = {
    originalname: 'portrait.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('abc'),
  };

  beforeAll(async () => {
    previousUploadDir = process.env.UPLOAD_DIR;
    uploadDir = await fs.mkdtemp(join(os.tmpdir(), 'boya-upload-'));
    process.env.UPLOAD_DIR = uploadDir;
  });

  afterAll(async () => {
    if (previousUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
    } else {
      process.env.UPLOAD_DIR = previousUploadDir;
    }
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    service = new UploadService();
  });

  it('rejects category strings outside the allow-list', async () => {
    await expect(service.saveImage(mockFile, 'tenant-1', 'avatars')).rejects.toThrow(
      PERSIAN_ERRORS.IMAGE_CATEGORY_INVALID,
    );
  });

  it('rejects non-image MIME types', async () => {
    await expect(
      service.saveImage({ ...mockFile, mimetype: 'image/heic' }, 'tenant-1', 'cover'),
    ).rejects.toThrow(PERSIAN_ERRORS.IMAGE_FORMAT_UNSUPPORTED);
  });

  it('rejects files over the 5 MB cap', async () => {
    await expect(
      service.saveImage({ ...mockFile, size: 5 * 1024 * 1024 + 1 }, 'tenant-1', 'cover'),
    ).rejects.toThrow(PERSIAN_ERRORS.IMAGE_TOO_LARGE);
  });

  it('rejects a missing file', async () => {
    await expect(service.saveImage(undefined, 'tenant-1', 'cover')).rejects.toThrow(
      PERSIAN_ERRORS.IMAGE_MISSING,
    );
  });

  it('stores with the tenant/category prefix and returns the public URL', async () => {
    const url = await service.saveImage(mockFile, 'tenant-1', 'specialist');
    expect(url).toMatch(/^\/uploads\/tenant-1\/specialist\/[0-9a-f-]+\.jpg$/);
    // The file really landed on disk under the temp root.
    const written = url.replace('/uploads/', '');
    await expect(fs.access(join(uploadDir, written))).resolves.toBeUndefined();
  });

  it('normalises an unlisted extension to .jpg', async () => {
    const url = await service.saveImage(
      { ...mockFile, originalname: 'portrait.heic' },
      'tenant-1',
      'cover',
    );
    expect(url).toMatch(/\.jpg$/);
  });

  it('deletes a file inside the upload root', async () => {
    const url = await service.saveImage(mockFile, 'tenant-1', 'cover');
    await service.deleteImage(url);
    const written = url.replace('/uploads/', '');
    await expect(fs.access(join(uploadDir, written))).rejects.toThrow();
  });

  it('ignores a traversal path that escapes the upload root', async () => {
    await expect(service.deleteImage('/uploads/../../etc/passwd')).resolves.toBeUndefined();
  });

  it('ignores URLs that are not under the /uploads/ prefix', async () => {
    await expect(service.deleteImage('/cdn/old.jpg')).resolves.toBeUndefined();
  });
});
