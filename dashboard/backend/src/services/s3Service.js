// ============================================
// FILE: backend/src/services/s3Service.js (NEW)
// S3 upload/download service
// ============================================
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { ApiError } from '../utils/ApiError.js';

let s3Client = null;

// Initialize S3 client only if S3 storage is enabled
if (config.image.storage === 's3') {
  if (!config.s3.accessKeyId || !config.s3.secretAccessKey || !config.s3.bucket) {
    logger.error('S3 configuration incomplete. Required: accessKeyId, secretAccessKey, bucket');
  } else {
    s3Client = new S3Client({
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      endpoint: config.s3.endpoint || undefined,
      forcePathStyle: config.s3.forcePathStyle,
    });

    logger.info('S3 client initialized', {
      region: config.s3.region,
      bucket: config.s3.bucket,
    });
  }
}

/**
 * Upload file to S3
 */
export async function uploadToS3(buffer, filename, contentType = 'application/octet-stream') {
  if (!s3Client) {
    throw ApiError.internal('S3 client not initialized');
  }

  const key = `uploads/${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read', // Change based on your security requirements
    });

    await s3Client.send(command);

    // Return public URL
    const publicUrl = config.s3.publicUrl
      ? `${config.s3.publicUrl}/${key}`
      : `https://${config.s3.bucket}.s3.${config.s3.region}.amazonaws.com/${key}`;

    logger.info('File uploaded to S3', { key, size: buffer.length });

    return publicUrl;
  } catch (error) {
    logger.error('S3 upload failed', { error: error.message, filename });
    throw ApiError.internal(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(url) {
  if (!s3Client) {
    throw ApiError.internal('S3 client not initialized');
  }

  try {
    // Extract key from URL
    const key = url.split('/').slice(-2).join('/'); // Gets 'uploads/filename.ext'

    const command = new DeleteObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
    });

    await s3Client.send(command);

    logger.info('File deleted from S3', { key });
  } catch (error) {
    logger.error('S3 delete failed', { error: error.message, url });
    throw ApiError.internal(`S3 delete failed: ${error.message}`);
  }
}

export default {
  uploadToS3,
  deleteFromS3,
};
