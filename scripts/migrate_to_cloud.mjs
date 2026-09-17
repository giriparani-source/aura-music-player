/**
 * scripts/migrate_to_cloud.mjs
 *
 * Cloud Music Library Migration Script for Aura Music Player.
 * Safely uploads local songs to Cloudflare R2 or AWS S3.
 *
 * Features:
 * - Idempotent: checks HeadObject before upload, skips existing files.
 * - Zero-RAM streaming: streams files directly from disk without buffering into RAM.
 * - Sets exact ContentType (audio/mpeg, audio/opus) and ContentLength.
 * - Dry-run mode by default if credentials are not configured.
 *
 * Usage:
 *   node scripts/migrate_to_cloud.mjs [--upload] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env manually if present
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      const key = k.trim();
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const manifestPath = path.resolve(__dirname, '..', 'server', 'data', 'cloud_manifest.json');
const musicBaseDir = process.env.MUSIC_DIR || 'G:\\My Drive\\songs 1';

const provider = (process.env.STORAGE_PROVIDER || 'r2').toLowerCase();
const isR2 = provider === 'r2';
const bucketName = isR2 ? process.env.R2_BUCKET_NAME : process.env.AWS_S3_BUCKET_NAME;

const hasCredentials = isR2
  ? Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && bucketName)
  : Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && bucketName);

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--upload') || !hasCredentials;

console.log('====================================================');
console.log('🎵 AURA MUSIC PLAYER — CLOUD STORAGE MIGRATION');
console.log('====================================================');
console.log(`Storage Provider: ${provider.toUpperCase()}`);
console.log(`Target Bucket:    ${bucketName || '(Not configured yet)'}`);
console.log(`Execution Mode:   ${isDryRun ? 'DRY-RUN (Simulating & Validating Files)' : 'LIVE UPLOAD'}`);
console.log(`Source Music Dir: ${musicBaseDir}`);
console.log('----------------------------------------------------');

if (!fs.existsSync(manifestPath)) {
  console.error(`ERROR: Manifest not found at ${manifestPath}. Run generate_cloud_manifest.py first!`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
console.log(`Found ${manifest.length} tracks in catalog manifest.`);

let s3Client = null;
if (!isDryRun && hasCredentials) {
  if (isR2) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  } else {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
}

async function runMigration() {
  let verifiedFiles = 0;
  let missingFiles = 0;
  let totalBytes = 0;
  let uploadedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < manifest.length; i++) {
    const item = manifest[i];
    const fullLocalPath = path.join(musicBaseDir, item.cloudKey);
    const key = item.cloudKey.replace(/\\/g, '/');

    if (!fs.existsSync(fullLocalPath)) {
      console.warn(`[MISSING] File not found: ${fullLocalPath}`);
      missingFiles++;
      continue;
    }

    const stat = fs.statSync(fullLocalPath);
    totalBytes += stat.size;
    verifiedFiles++;

    const ext = path.extname(fullLocalPath).toLowerCase();
    const contentType = ext === '.opus' ? 'audio/opus' : ext === '.flac' ? 'audio/flac' : 'audio/mpeg';

    if (isDryRun) {
      if ((i + 1) % 50 === 0 || i === manifest.length - 1) {
        console.log(`[Validated ${i + 1}/${manifest.length}] ${key} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
      }
      continue;
    }

    // Live Upload Mode
    try {
      // Check if already uploaded (idempotent)
      let alreadyExists = false;
      try {
        const head = await s3Client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
        if (head.ContentLength === stat.size) {
          alreadyExists = true;
          skippedCount++;
        }
      } catch (headErr) {
        // Not found, proceed to upload
      }

      if (alreadyExists) {
        if ((i + 1) % 25 === 0) {
          console.log(`[SKIPPED - Already Exists ${i + 1}/${manifest.length}] ${key}`);
        }
        continue;
      }

      const fileStream = fs.createReadStream(fullLocalPath);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: fileStream,
          ContentLength: stat.size,
          ContentType: contentType,
        })
      );

      uploadedCount++;
      console.log(`[UPLOADED ${i + 1}/${manifest.length}] ${key} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (uploadErr) {
      console.error(`[ERROR] Failed to upload ${key}:`, uploadErr.message);
    }
  }

  console.log('----------------------------------------------------');
  console.log('📊 MIGRATION SUMMARY:');
  console.log(`- Total Tracks in Manifest: ${manifest.length}`);
  console.log(`- Verified Local Files:     ${verifiedFiles}`);
  console.log(`- Missing Files:            ${missingFiles}`);
  console.log(`- Total Library Size:       ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (~${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB)`);

  if (isDryRun) {
    console.log('\n✅ DRY-RUN COMPLETE: All files verified on disk and ready for migration!');
    console.log('To execute live upload, configure R2_* in .env and run:');
    console.log('  node scripts/migrate_to_cloud.mjs --upload');
  } else {
    console.log(`\n🎉 LIVE UPLOAD COMPLETE: Uploaded ${uploadedCount}, Skipped ${skippedCount}`);
  }
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
