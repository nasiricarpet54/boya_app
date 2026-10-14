import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, resolve, sep, extname } from 'path';
import { randomUUID } from 'crypto';

import { PERSIAN_ERRORS } from '../../common/persian-errors';

/**
 * Shape of a multer file in memory storage.
 *
 * Declared locally rather than referencing `Express.Multer.File`, so this module
 * type-checks even though multer reaches node_modules only as a transitive of
 * `@nestjs/platform-express` (there is no `@types/multer` here). The real multer
 * value structurally satisfies this interface, and the service only touches the
 * four fields below, so the approximation is safe.
 */
export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Where uploaded files are written and served from. */
export const UPLOAD_DIR_DEFAULT = join(process.cwd(), 'uploads');

/** Content types accepted by `POST /upload/image`. */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Extensions kept from the client filename; anything else falls back to .jpg. */
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * The folder tier under `uploads/{tenantId}/{category}/`. An allow-list rather
 * than a free string: the category becomes a path segment, so an unvalidated
 * value is a directory-traversal vector, and a closed list is also what makes
 * the gallery predictable for the admin review.
 */
const ALLOWED_CATEGORIES = ['cover', 'specialist', 'portfolio', 'general'];

/** 5 MB — the limit the form advertises and the service enforces. */
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Local-storage image backend for the beta (ADR: local volume instead of S3, for
 * speed of iteration; the interface — return a URL, delete by URL — is shaped so
 * an S3 swap is a service-internal change).
 *
 * Files are partitioned by tenant: `uploads/{tenantId}/{category}/{uuid}.{ext}`.
 * The tenant id comes from the verified token, never from the request body, so
 * one salon cannot write into another's directory.
 */
@Injectable()
export class UploadService {
  private readonly uploadDir = process.env.UPLOAD_DIR || UPLOAD_DIR_DEFAULT;

  /**
   * Validates and stores one image, returning the public URL the client should
   * persist (the salon stores *that* string; the file itself is addressable by
   * it alone).
   */
  async saveImage(
    file: UploadedImageFile | undefined,
    tenantId: string,
    category: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(PERSIAN_ERRORS.IMAGE_MISSING);
    }

    // MIME is what the client actually sends and the only thing the browser will
    // try to render, so it — not the extension — is the gate.
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(PERSIAN_ERRORS.IMAGE_FORMAT_UNSUPPORTED);
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException(PERSIAN_ERRORS.IMAGE_TOO_LARGE);
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new BadRequestException(PERSIAN_ERRORS.IMAGE_CATEGORY_INVALID);
    }

    // The uuid is the whole filename; the client extension is kept only for a
    // readable URL and clamped to the image set, so nothing executable or
    // double-suffixed can land in the served directory.
    const ext = extname(file.originalname).toLowerCase();
    const filename = `${randomUUID()}${ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpg'}`;
    const dir = join(this.uploadDir, tenantId, category);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, filename), file.buffer);

    return `/uploads/${tenantId}/${category}/${filename}`;
  }

  /**
   * Removes a previously stored image by its URL. Anything not under this
   * service's prefix is ignored, and the resolved path is checked to be inside
   * the upload root — a crafted `..` URL must not reach outside it.
   */
  async deleteImage(url: string): Promise<void> {
    if (!url.startsWith('/uploads/')) return;

    const relativePath = url.slice('/uploads/'.length);
    const root = resolve(this.uploadDir);
    const fullPath = resolve(join(root, relativePath));
    if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) return;

    try {
      await fs.unlink(fullPath);
    } catch {
      // Already gone, or never there (a URL from before local storage, for
      // instance). Nothing the caller can do about it, and the caller's
      // contract is "the image is no longer referenced".
    }
  }
}
