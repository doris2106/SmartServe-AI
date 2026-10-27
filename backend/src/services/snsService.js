const { PublishCommand } = require('@aws-sdk/client-sns');
const { snsClient } = require('../config/aws');
const { loadConfigFromSSM } = require('../config/ssm');

/**
 * Publishes alert/status notifications to Amazon SNS Topic
 */
async function publishNotification(subject, message, attributes = {}) {
  try {
    const config = await loadConfigFromSSM();
    if (!config.snsTopicArn) {
      console.log('[SNS] Notice: Topic ARN not set, skipping SNS publish.');
      return;
    }

    const command = new PublishCommand({
      TopicArn: config.snsTopicArn,
      Subject: subject.substring(0, 100),
      Message: message,
      MessageAttributes: {
        Source: { DataType: 'String', StringValue: 'SmartServeAI' },
        ...attributes
      }
    });

    const res = await snsClient.send(command);
    console.log(`[SNS] Published notification "${subject}" to SNS Topic (MessageId: ${res.MessageId})`);
    return res.MessageId;
  } catch (err) {
    console.warn(`[SNS] Warning: Failed to publish to SNS (${err.message}). Application continuing seamlessly.`);
  }
}

module.exports = { publishNotification };

