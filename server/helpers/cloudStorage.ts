/**
 * server/helpers/cloudStorage.ts
 *
 * Cloud Object Storage abstraction (Cloudflare R2 / AWS S3) for Aura Music Player.
 * Preserves HTTP 206 Range requests, zero-RAM stream piping, and local development fallback.
 *
 * Server-only module: uses server environment variables (R2_*, AWS_*), never exposed to client.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

export type StorageProvider = 'local' | 'r2' | 's3';

let s3ClientInstance: S3Client | null = null;

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
  if (provider === 'r2' || provider === 's3') {
    return provider;
  }
  return 'local';
}

export function isCloudStorageConfigured(): boolean {
  const provider = getStorageProvider();
  if (provider === 'r2') {
    return Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    );
  }
  if (provider === 's3') {
    return Boolean(
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET_NAME
    );
  }
  return false;
}

function getS3Client(): { client: S3Client; bucket: string } | null {
  if (!isCloudStorageConfigured()) return null;

  const provider = getStorageProvider();
  const bucket = (provider === 'r2' ? process.env.R2_BUCKET_NAME : process.env.AWS_S3_BUCKET_NAME) || '';

  if (!s3ClientInstance) {
    if (provider === 'r2') {
      const accountId = process.env.R2_ACCOUNT_ID;
      s3ClientInstance = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      });
    } else {
      s3ClientInstance = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });
    }
  }

  return { client: s3ClientInstance, bucket };
}

export interface CloudAudioStreamResult {
  statusCode: number;
  headers: Record<string, string | number>;
  stream: Readable;
}

/**
 * Stream an audio file from Cloud Object Storage using HTTP 206 Partial Content
 * or HTTP 200 without buffering the whole file in memory.
 */
export async function streamCloudAudio(
  key: string,
  rangeHeader?: string
): Promise<CloudAudioStreamResult | null> {
  const s3 = getS3Client();
  if (!s3) return null;

  const normalizedKey = key.replace(/^[\\/]+/, '').replace(/\\/g, '/');

  try {
    const command = new GetObjectCommand({
      Bucket: s3.bucket,
      Key: normalizedKey,
      Range: rangeHeader || undefined,
    });

    const response = await s3.client.send(command);
    if (!response.Body) {
      return null;
    }

    const headers: Record<string, string | number> = {
      'Accept-Ranges': 'bytes',
      'Content-Type': response.ContentType || 'audio/mpeg',
    };

    if (response.ContentRange) {
      headers['Content-Range'] = response.ContentRange;
    }
    if (response.ContentLength !== undefined) {
      headers['Content-Length'] = response.ContentLength;
    }
    if (response.ETag) {
      headers['ETag'] = response.ETag;
    }

    const statusCode = rangeHeader && response.ContentRange ? 206 : 200;

    return {
      statusCode,
      headers,
      stream: response.Body as Readable,
    };
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error(`[cloudStorage] Error streaming key "${normalizedKey}":`, err.message || err);
    throw err;
  }
}
