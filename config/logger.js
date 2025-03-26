// logger.js
const winston = require('winston');
require('winston-cloudwatch');

// Create a logger instance that sends logs directly to CloudWatch
const logger = winston.createLogger({
  transports: [
    new winston.transports.CloudWatch({
      logGroupName: process.env.CLOUDWATCH_LOG_GROUP || 'csye6225-app-logs',
      logStreamName: process.env.CLOUDWATCH_LOG_STREAM || 'app-logs',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      jsonMessage: true,
      // Explicitly set credentials from environment variables
      awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
      awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
      // Optionally, you can add parameters like submissionInterval or batchSize here
    })
  ]
});

// Optionally, during development, add console output so you can see logs locally as well.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console());
}

module.exports = logger;
