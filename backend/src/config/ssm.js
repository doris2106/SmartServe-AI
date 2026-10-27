const { GetParametersByPathCommand, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { ssmClient } = require('./aws');

let cachedConfig = null;

async function loadConfigFromSSM() {
  if (cachedConfig) return cachedConfig;

  console.log('[SSM] Fetching configuration from AWS Systems Manager Parameter Store (/smartserve/*)...');
  try {
    const command = new GetParametersByPathCommand({
      Path: '/smartserve/',
      Recursive: true,
      WithDecryption: true
    });

    const response = await ssmClient.send(command);
    const configMap = {};

    if (response.Parameters && response.Parameters.length > 0) {
      for (const p of response.Parameters) {
        const key = p.Name.replace('/smartserve/', '');
        configMap[key] = p.Value;
      }
      console.log(`[SSM] Successfully loaded ${response.Parameters.length} parameters from Parameter Store.`);
    }

    cachedConfig = {
      dbHost: configMap['db/host'] || process.env.DB_HOST || 'localhost',
      dbPort: parseInt(configMap['db/port'] || process.env.DB_PORT || '3306'),
      dbName: configMap['db/name'] || process.env.DB_NAME || 'smartserve_db',
      dbUser: configMap['db/user'] || process.env.DB_USER || 'smartserve_admin',
      dbPassword: configMap['db/password'] || process.env.DB_PASSWORD || '',
      jwtSecret: configMap['jwt/secret'] || process.env.JWT_SECRET || 'smartserve_local_jwt_secret_key_change_in_production',
      s3Bucket: configMap['s3/bucket'] || process.env.S3_BUCKET || 'smartserve-attachments-bucket',
      sqsQueueUrl: configMap['sqs/queue_url'] || process.env.SQS_QUEUE_URL || '',
      snsTopicArn: configMap['sns/topic_arn'] || process.env.SNS_TOPIC_ARN || '',
      region: configMap['aws/region'] || process.env.AWS_REGION || 'eu-north-1'
    };

    return cachedConfig;
  } catch (err) {
    console.warn(`[SSM] Notice: Could not load from Parameter Store (${err.message}). Falling back to environment variables.`);
    cachedConfig = {
      dbHost: process.env.DB_HOST || 'localhost',
      dbPort: parseInt(process.env.DB_PORT || '3306'),
      dbName: process.env.DB_NAME || 'smartserve_db',
      dbUser: process.env.DB_USER || 'smartserve_admin',
      dbPassword: process.env.DB_PASSWORD || '',
      jwtSecret: process.env.JWT_SECRET || 'smartserve_local_jwt_secret_key_change_in_production',
      s3Bucket: process.env.S3_BUCKET || 'smartserve-attachments-bucket',
      sqsQueueUrl: process.env.SQS_QUEUE_URL || '',
      snsTopicArn: process.env.SNS_TOPIC_ARN || '',
      region: process.env.AWS_REGION || 'eu-north-1'
    };
    return cachedConfig;
  }
}

module.exports = { loadConfigFromSSM };

