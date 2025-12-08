// ============================================
// FILE: backend/src/services/imageService.js
// Low-compute image processing with Sharp
// ============================================
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { PassThrough } from 'stream';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadToS3, deleteFromS3 } from './s3Service.js';

class ImageService {
  constructor() {
    this.maxFileSize = parseInt(config.image.maxSize, 10);
    this.allowedMimeTypes = config.image.allowedTypes;
    this.quality = parseInt(config.image.quality, 10);
    this.maxWidth = parseInt(config.image.maxWidth, 10);
    this.maxHeight = parseInt(config.image.maxHeight, 10);
    this.thumbnailSize = parseInt(config.image.thumbnailSize, 10);
    this.storageType = config.image.storage;
    this.uploadDir = config.image.uploadDir;
    
    // Concurrency limiter
    this.processing = 0;
    this.maxConcurrent = parseInt(config.image.parallel, 10);
    this.queue = [];
  }

  /**
   * Validate file before processing
   */
  async validateFile(file) {
    // Size check
    if (file.size > this.maxFileSize) {
      throw ApiError.badRequest(
        `File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    // MIME type check
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw ApiError.badRequest(
        `Invalid file type. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }

    // Magic bytes check (verify actual file type)
    const buffer = file.buffer.slice(0, 12);
    const signatures = {
      'image/jpeg': [[0xFF, 0xD8, 0xFF]],
      'image/png': [[0x89, 0x50, 0x4E, 0x47]],
      'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF
      'image/gif': [[0x47, 0x49, 0x46]],
    };

    const matchesSignature = signatures[file.mimetype]?.some(sig =>
      sig.every((byte, i) => buffer[i] === byte)
    );

    if (!matchesSignature) {
      throw ApiError.badRequest('File content does not match declared type');
    }

    return true;
  }

  /**
   * Sanitize filename to prevent directory traversal
   */
  sanitizeFilename(filename) {
    // Remove path separators and dangerous characters
    const sanitized = filename
      .replace(/[\/\\]/g, '')
      .replace(/['"<>|:*?]/g, '')
      .replace(/\.\./g, '')
      .trim();

    if (!sanitized || sanitized.length === 0) {
      return `file_${Date.now()}.webp`;
    }

    return sanitized;
  }

  /**
   * Generate unique filename
   */
  generateFilename(originalName, suffix = '') {
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(originalName) || '.webp';
    const safe = this.sanitizeFilename(path.basename(originalName, ext));
    return `${safe}_${timestamp}_${hash}${suffix}${ext}`;
  }

  /**
   * Process image with streaming to minimize memory
   */
  async processImage(fileBuffer, options = {}) {
    const {
      maxWidth = this.maxWidth,
      maxHeight = this.maxHeight,
      quality = this.quality,
      generateThumbnail = true,
    } = options;

    try {
      // Create Sharp instance with streaming
      const image = sharp(fileBuffer, {
        failOnError: false,
        density: 72, // Reduce DPI for web
        limitInputPixels: 268402689, // ~16k x 16k limit
      });

      // Get metadata
      const metadata = await image.metadata();

      // Configure processing pipeline
      let pipeline = image
        .rotate() // Auto-rotate based on EXIF
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality,
          effort: 2, // Low CPU effort (0-6, where 0 is fastest)
          smartSubsample: true,
        })
        .withMetadata({
          // Strip most EXIF but keep orientation
          orientation: metadata.orientation,
        });

      // Process main image
      const processed = await pipeline.toBuffer({ resolveWithObject: true });

      let thumbnail = null;
      if (generateThumbnail) {
        thumbnail = await sharp(fileBuffer)
          .rotate()
          .resize(this.thumbnailSize, this.thumbnailSize, {
            fit: 'cover',
            position: 'center',
          })
          .webp({ quality: quality - 10, effort: 2 })
          .toBuffer({ resolveWithObject: true });
      }

      return {
        main: {
          buffer: processed.data,
          info: processed.info,
        },
        thumbnail: thumbnail ? {
          buffer: thumbnail.data,
          info: thumbnail.info,
        } : null,
        originalMetadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          size: fileBuffer.length,
        },
      };
    } catch (error) {
      logger.error('Image processing error', { error: error.message });
      throw ApiError.badRequest('Failed to process image: ' + error.message);
    }
  }

  /**
   * Save to local storage
   */
  async saveLocal(buffer, filename) {
    const uploadPath = path.join(process.cwd(), this.uploadDir);
    
    // Ensure directory exists
    if (!existsSync(uploadPath)) {
      await fs.mkdir(uploadPath, { recursive: true });
    }

    const filePath = path.join(uploadPath, filename);
    await fs.writeFile(filePath, buffer);

    return `/${this.uploadDir}/${filename}`;
  }

  /**
   * Save to S3
   */
  async saveS3(buffer, filename, contentType = 'image/webp') {
    return await uploadToS3(buffer, filename, contentType);
  }

  /**
   * Acquire processing slot (concurrency control)
   */
  async acquireSlot() {
    while (this.processing >= this.maxConcurrent) {
      await new Promise(resolve => {
        this.queue.push(resolve);
      });
    }
    this.processing++;
  }

  /**
   * Release processing slot
   */
  releaseSlot() {
    this.processing--;
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      resolve();
    }
  }

  /**
   * Main upload handler
   */
  async upload(file, options = {}) {
    // Validate
    await this.validateFile(file);

    // Acquire concurrency slot
    await this.acquireSlot();

    try {
      // Process image
      const { main, thumbnail, originalMetadata } = await this.processImage(
        file.buffer,
        options
      );

      // Generate filenames
      const mainFilename = this.generateFilename(file.originalname);
      const thumbFilename = thumbnail
        ? this.generateFilename(file.originalname, '_thumb')
        : null;

      // Save based on storage type
      let mainUrl, thumbnailUrl;

      if (this.storageType === 's3') {
        mainUrl = await this.saveS3(main.buffer, mainFilename);
        if (thumbnail) {
          thumbnailUrl = await this.saveS3(thumbnail.buffer, thumbFilename);
        }
      } else {
        mainUrl = await this.saveLocal(main.buffer, mainFilename);
        if (thumbnail) {
          thumbnailUrl = await this.saveLocal(thumbnail.buffer, thumbFilename);
        }
      }

      logger.info('Image uploaded successfully', {
        mainUrl,
        thumbnailUrl,
        originalSize: originalMetadata.size,
        processedSize: main.info.size,
        compression: ((1 - main.info.size / originalMetadata.size) * 100).toFixed(1) + '%',
      });

      return {
        image_url: mainUrl,
        thumbnail_url: thumbnailUrl,
        width: main.info.width,
        height: main.info.height,
        size_bytes: main.info.size,
        format: 'webp',
        original: originalMetadata,
      };
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Delete image
   */
  async delete(imageUrl) {
    if (this.storageType === 's3') {
      await deleteFromS3(imageUrl);
    } else {
      const filename = path.basename(imageUrl);
      const filePath = path.join(process.cwd(), this.uploadDir, filename);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        logger.warn('Failed to delete local file', { error: error.message });
      }
    }
  }
}

export default new ImageService();
