const { S3Client } = require('@aws-sdk/client-s3');
const { SSMClient } = require('@aws-sdk/client-ssm');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { SNSClient } = require('@aws-sdk/client-sns');
const { CloudWatchLogsClient } = require('@aws-sdk/client-cloudwatch-logs');
const { CloudWatchClient } = require('@aws-sdk/client-cloudwatch');

const REGION = process.env.AWS_REGION || 'eu-north-1';

// Standard AWS Clients using Default Credential Provider Chain (IAM Instance Profile on EC2, or AWS CLI env)
const s3Client = new S3Client({ region: REGION });
const ssmClient = new SSMClient({ region: REGION });
const sqsClient = new SQSClient({ region: REGION });
const snsClient = new SNSClient({ region: REGION });
const logsClient = new CloudWatchLogsClient({ region: REGION });
const cwClient = new CloudWatchClient({ region: REGION });

module.exports = {
  REGION,
  s3Client,
  ssmClient,
  sqsClient,
  snsClient,
  logsClient,
  cwClient
};

