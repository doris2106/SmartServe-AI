const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const { sqsClient } = require('../config/aws');
const { loadConfigFromSSM } = require('../config/ssm');

/**
 * Enqueues a complaint event to Amazon SQS for asynchronous processing
 */
async function sendComplaintToQueue(complaintData) {
  try {
    const config = await loadConfigFromSSM();
    if (!config.sqsQueueUrl) {
      console.log('[SQS] Notice: Queue URL not set, skipping SQS dispatch.');
      return;
    }

    const payload = {
      eventType: 'COMPLAINT_SUBMITTED',
      timestamp: new Date().toISOString(),
      complaint: complaintData
    };

    const command = new SendMessageCommand({
      QueueUrl: config.sqsQueueUrl,
      MessageBody: JSON.stringify(payload),
      MessageAttributes: {
        TicketId: { DataType: 'String', StringValue: complaintData.ticket_id || 'UNKNOWN' },
        Priority: { DataType: 'String', StringValue: complaintData.priority || 'Medium' }
      }
    });

    const res = await sqsClient.send(command);
    console.log(`[SQS] Dispatched complaint ${complaintData.ticket_id} to SQS Queue (MessageId: ${res.MessageId})`);
    return res.MessageId;
  } catch (err) {
    console.warn(`[SQS] Warning: Failed to send to SQS (${err.message}). Application continuing seamlessly.`);
  }
}

module.exports = { sendComplaintToQueue };

