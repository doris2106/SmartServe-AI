const { PutLogEventsCommand, CreateLogStreamCommand, DescribeLogStreamsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');
const { logsClient, cwClient } = require('../config/aws');

const LOG_GROUP = '/smartserve/app';
const LOG_STREAM = `api-server-${new Date().toISOString().split('T')[0]}`;
let sequenceToken = null;
let streamCreated = false;

async function ensureLogStream() {
  if (streamCreated) return;
  try {
    await logsClient.send(new CreateLogStreamCommand({
      logGroupName: LOG_GROUP,
      logStreamName: LOG_STREAM
    }));
    streamCreated = true;
  } catch (err) {
    if (err.name === 'ResourceAlreadyExistsException') {
      streamCreated = true;
    }
  }
}

/**
 * Logs application events to Amazon CloudWatch Logs
 */
async function logToCloudWatch(message, level = 'INFO') {
  try {
    await ensureLogStream();
    const event = {
      message: JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        msg: message
      }),
      timestamp: Date.now()
    };

    await logsClient.send(new PutLogEventsCommand({
      logGroupName: LOG_GROUP,
      logStreamName: LOG_STREAM,
      logEvents: [event]
    }));
  } catch (err) {
    // CloudWatch failure shouldn't crash the API
  }
}

/**
 * Pushes custom metrics to Amazon CloudWatch
 */
async function recordMetric(metricName, value = 1, unit = 'Count') {
  try {
    await cwClient.send(new PutMetricDataCommand({
      Namespace: 'SmartServe/CampusOps',
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date()
        }
      ]
    }));
  } catch (err) {
    // Non-blocking
  }
}

module.exports = {
  logToCloudWatch,
  recordMetric
};

