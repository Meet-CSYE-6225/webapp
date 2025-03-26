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
      // You can optionally set additional parameters like submissionInterval, batchSize, etc.
    })
  ]
});

// Optionally, during development, add console output so you can see logs locally as well.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console());
}

module.exports = logger;
