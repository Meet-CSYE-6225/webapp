// logger.js
const winston = require('winston');
require('winston-cloudwatch');

const transports = [];

// Only add CloudWatch transport if not running in test environment
if (process.env.NODE_ENV !== 'test') {
  transports.push(new winston.transports.CloudWatch({
    logGroupName: process.env.CLOUDWATCH_LOG_GROUP || 'csye6225-app-logs',
    logStreamName: process.env.CLOUDWATCH_LOG_STREAM || 'app-logs',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    jsonMessage: true,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  }));
}

// Always add console transport for local development and tests
transports.push(new winston.transports.Console());

const logger = winston.createLogger({
  transports,
});

module.exports = logger;
