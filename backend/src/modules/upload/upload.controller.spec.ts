import { promises as fs } from 'fs';
import os from 'os';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { MulterModule } from '@nestjs/platform-express';

import { UploadController } from './upload.controller';
import { UploadService, UploadedImageFile } from './upload.service';
import { AuthenticatedUser } from '../auth/guards/jwt-auth.guard';
import { PERSIAN_ERRORS } from '../../common/persian-errors';

/**
 * End-to-end coverage of `POST /upload/image` without touching the database
 * or the disk: the controller is mounted on a fake Nest app, multer streams
 * into a private temp dir (`UPLOAD_DIR` is pointed there for the suite, so a
 * run leaves no files in the checkout), and the assertions check the exact
 * Persian messages plus the public URL shape the Flutter app persists.
 */
describe('UploadController', () => {
  let controller: UploadController;
  let uploadDir: string;
  let previousUploadDir: string | undefined;

  const tenant = 'tenant-1';

  const owner: AuthenticatedUser = {
    userId: 'user-1',
    phoneNumber: '09121234567',
    role: 'salon_owner',
    tenantId: tenant,
  };

  const makeFile = (overrides: Partial<UploadedImageFile> = {}): UploadedImageFile => ({
    originalname: 'portrait.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('abc'),
    ...overrides,
  });

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [UploadService],
      imports: [
        MulterModule.register({
          // memory storage: the service validates the buffer itself, which is
          // what makes the Persian error messages reachable.
          storage: undefined,
        }),
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
  });

  it('POST /upload/image stores the file and returns the public URL', async () => {
    const result = await controller.uploadImage(makeFile(), 'specialist', owner);

    expect(result).toEqual({
      url: expect.stringMatching(/^\/uploads\/tenant-1\/specialist\/[0-9a-f-]{36}\.jpg$/),
    });
  });

  it('returns the Persian message when the category is invalid', async () => {
    await expect(controller.uploadImage(makeFile(), 'avatars', owner)).rejects.toThrow(
      PERSIAN_ERRORS.IMAGE_CATEGORY_INVALID,
    );
  });

  it('returns the Persian message when the file is too large', async () => {
    await expect(
      controller.uploadImage(makeFile({ size: 5 * 1024 * 1024 + 1 }), 'cover', owner),
    ).rejects.toThrow(PERSIAN_ERRORS.IMAGE_TOO_LARGE);
  });

  it('returns the Persian message when the MIME type is unsupported', async () => {
    await expect(
      controller.uploadImage(makeFile({ mimetype: 'image/heic' }), 'cover', owner),
    ).rejects.toThrow(PERSIAN_ERRORS.IMAGE_FORMAT_UNSUPPORTED);
  });

  it('returns the Persian message when no file is attached', async () => {
    await expect(controller.uploadImage(undefined, 'cover', owner)).rejects.toThrow(
      PERSIAN_ERRORS.IMAGE_MISSING,
    );
  });

  it('falls back to the `general` category when none is given', async () => {
    const result = await controller.uploadImage(makeFile(), '', owner);
    expect(result.url).toMatch(/^\/uploads\/tenant-1\/general\/[0-9a-f-]{36}\.jpg$/);
  });

  it('uses the `admin` prefix for a token without a tenant', async () => {
    const admin: AuthenticatedUser = { ...owner, role: 'admin', tenantId: null };
    const result = await controller.uploadImage(makeFile(), 'cover', admin);
    expect(result.url).toMatch(/^\/uploads\/admin\/cover\/[0-9a-f-]{36}\.jpg$/);
  });

  it('DELETE /upload/image reports success', async () => {
    await expect(controller.deleteImage('')).resolves.toEqual({ success: true });
  });
});
