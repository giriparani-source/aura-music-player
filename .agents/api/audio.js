import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

let s3ClientInstance = null;

function getS3Client() {
  if (s3ClientInstance) return s3ClientInstance;

  const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase().trim();
  if (provider === 'r2') {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!accountId || !accessKeyId || !secretAccessKey) return null;

    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey }
    });
    return s3ClientInstance;
  }

  if (provider === 's3') {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || 'us-east-1';
    if (!accessKeyId || !secretAccessKey) return null;

    s3ClientInstance = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey }
    });
    return s3ClientInstance;
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const relPath = req.query.path;
  if (!relPath) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const decodedRelPath = decodeURIComponent(relPath).replace(/^[\\/]+/, '').replace(/\\/g, '/');
  const client = getS3Client();

  if (client) {
    try {
      const bucket = process.env.STORAGE_PROVIDER === 'r2'
        ? process.env.R2_BUCKET_NAME
        : process.env.AWS_S3_BUCKET_NAME;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: decodedRelPath,
        Range: req.headers.range
      });

      const response = await client.send(command);
      res.statusCode = response.ContentRange ? 206 : 200;
      if (response.ContentType) res.setHeader('Content-Type', response.ContentType);
      if (response.ContentLength) res.setHeader('Content-Length', response.ContentLength);
      if (response.ContentRange) res.setHeader('Content-Range', response.ContentRange);

      if (response.Body && typeof response.Body.pipe === 'function') {
        response.Body.pipe(res);
        return;
      }
    } catch (err) {
      console.warn('[api/audio] Cloud audio retrieval error:', err.message);
    }
  }

  return res.status(404).json({
    error: 'Audio stream unavailable in serverless environment without cloud storage credentials.',
    hint: 'Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in your Vercel Project Settings to stream your library tracks in production.'
  });
}
