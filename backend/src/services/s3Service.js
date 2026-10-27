const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client } = require('../config/aws');
const { loadConfigFromSSM } = require('../config/ssm');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Uploads a file buffer directly to private S3 bucket
 */
async function uploadAttachment(file) {
  const config = await loadConfigFromSSM();
  const fileExt = path.extname(file.originalname).toLowerCase();
  const s3Key = `complaints/${Date.now()}-${uuidv4().substring(0, 8)}${fileExt}`;

  const command = new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: s3Key,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: {
      originalName: file.originalname,
      uploadedAt: new Date().toISOString()
    }
  });

  await s3Client.send(command);
  console.log(`[S3] Successfully uploaded attachment to s3://${config.s3Bucket}/${s3Key}`);

  return {
    s3Key,
    filename: file.originalname,
    bucket: config.s3Bucket
  };
}

/**
 * Generates a secure, time-limited presigned GET URL for viewing private attachments
 */
async function getAttachmentViewUrl(s3Key, expiresInSeconds = 3600) {
  if (!s3Key) return null;
  const config = await loadConfigFromSSM();

  const command = new GetObjectCommand({
    Bucket: config.s3Bucket,
    Key: s3Key
  });

  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

module.exports = {
  uploadAttachment,
  getAttachmentViewUrl
};

